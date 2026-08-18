import { Cliente } from '../models/Cliente.js'

// CAPA DE SERVICIO: reglas de negocio sobre clientes. Se encarga de validar, crear, editar, desactivar y reactivar clientes.
export class ClienteService {
    constructor(clienteRepositorio) {
        this.repositorio = clienteRepositorio
    }

    // REGLA: el email no se puede repetir.
    async crear(datos) {
        const cliente = new Cliente(datos)
        cliente.validar() // el propio objeto se valida (POO)

        const documento = cliente.aDocumento()

        const yaExiste = await this.repositorio.buscarPorEmail(documento.email)
        if (yaExiste) {
            throw new Error(
                `Ya existe un cliente con el email ${documento.email}: ` +
                    `${yaExiste.codigo ?? ''} ${yaExiste.nombre}`.trim() + '.',
            )
        }

        documento.codigo = await this.repositorio.siguienteCodigo('CLI')

        await this.repositorio.crear(documento)
        return documento.codigo // devolvemos el código, no el ObjectId
    }

    async listar() {
        return this.repositorio.listar()
    }

    // REGLA: solo los activos se pueden usar en propuestas y proyectos.
    async listarActivos() {
        return this.repositorio.listar({ activo: true })
    }

    // Los desactivados. Solo se usa en la pantalla de reactivar.
    async listarInactivos() {
        return this.repositorio.listar({ activo: false })
    }

    async buscar(texto) {
        if (!texto || texto.trim().length < 2) {
            throw new Error('Escribe al menos 2 caracteres para buscar.')
        }
        return this.repositorio.buscarPorTexto(texto.trim())
    }

    // REGLA: NO SE PUEDE ELIMINAR UN CLIENTE. Solo se puede desactivar y reactivar.
    async editar(referencia, cambios) {
        const cliente = await this.repositorio.buscarPorIdOCodigo(referencia)
        if (!cliente) throw new Error(`No existe ningún cliente con la referencia "${referencia}".`)

        const fusionado = new Cliente({
            nombre: cambios.nombre ?? cliente.nombre,
            email: cambios.email ?? cliente.email,
            empresa: cambios.empresa === undefined ? cliente.empresa : cambios.empresa,
            telefono: cambios.telefono === undefined ? cliente.telefono : cambios.telefono,
            activo: cliente.activo,
        })
        fusionado.validar()

        const documento = fusionado.aDocumento()

        // REGLA: si cambia el email, no puede chocar con el de otro cliente.
        if (documento.email !== cliente.email) {
            const ocupado = await this.repositorio.buscarPorEmail(documento.email)
            if (ocupado) {
                throw new Error(
                    `Ya existe otro cliente con el email ${documento.email}: ` +
                        `${ocupado.codigo ?? ''} ${ocupado.nombre}`.trim() + '.',
                )
            }
        }

        await this.repositorio.actualizar(cliente._id, {
            nombre: documento.nombre,
            email: documento.email,
            empresa: documento.empresa,
            telefono: documento.telefono,
            actualizadoEn: new Date(),
        })

        return { ...cliente, ...documento }
    }

    async desactivar(referencia) {
        // `buscarPorIdOCodigo` acepta tanto CLI-0001 como el _id de Mongo.
        const cliente = await this.repositorio.buscarPorIdOCodigo(referencia)
        if (!cliente) throw new Error(`No existe ningún cliente con la referencia "${referencia}".`)

        if (!cliente.activo) {
            throw new Error(`El cliente "${cliente.nombre}" ya estaba desactivado.`)
        }

        // `actualizar` lo heredamos de BaseRepositorio: no hubo que escribirlo.
        await this.repositorio.actualizar(cliente._id, { activo: false })
        return cliente
    }

    async reactivar(referencia) {
        const cliente = await this.repositorio.buscarPorIdOCodigo(referencia)
        if (!cliente) throw new Error(`No existe ningún cliente con la referencia "${referencia}".`)

        if (cliente.activo) {
            throw new Error(`El cliente "${cliente.nombre}" ya estaba activo.`)
        }

        await this.repositorio.actualizar(cliente._id, { activo: true })
        return cliente
    }
}
