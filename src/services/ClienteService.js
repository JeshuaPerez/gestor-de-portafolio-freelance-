import { ConflictoError, NoEncontradoError, ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { Cliente } from '../models/Cliente.js'

// REGLAS DE NEGOCIO PARA CLIENTES
export class ClienteService {
    constructor(clienteRepositorio) {
        this.repositorio = clienteRepositorio
    }

    async #exigir(referencia) {
        const cliente = await this.repositorio.buscarPorIdOCodigo(referencia)
        if (!cliente) throw new NoEncontradoError('cliente', referencia)
        return cliente
    }

    /** REGLA: el email no se puede repetir. */
    async crear(datos) {
        const cliente = new Cliente(datos)
        cliente.validar()

        const documento = cliente.aDocumento()

        const yaExiste = await this.repositorio.buscarPorEmail(documento.email)
        if (yaExiste) {
            throw new ConflictoError(
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

    /** REGLA: solo los activos se pueden usar en propuestas y proyectos. */
    async listarActivos() {
        return this.repositorio.listar({ activo: true })
    }

    async listarInactivos() {
        return this.repositorio.listar({ activo: false })
    }

    async buscar(texto) {
        if (!texto || texto.trim().length < 2) {
            throw new ValidacionError('Escribe al menos 2 caracteres para buscar.', {
                campo: 'texto',
            })
        }
        return this.repositorio.buscarPorTexto(texto.trim())
    }

    // EDITAR — el modelo se reconstruye entero, así que valida igual que el alta.
    async editar(referencia, cambios) {
        const documento = await this.#exigir(referencia)

        const editado = Cliente.desdeDocumento(documento, {
            nombre: cambios.nombre,
            email: cambios.email,
            empresa: cambios.empresa,
            telefono: cambios.telefono,
        })
        editado.validar()

        const actualizado = editado.aDocumento()

        // REGLA: si cambia el email, no puede chocar con el de otro cliente.
        if (actualizado.email !== documento.email) {
            const ocupado = await this.repositorio.buscarPorEmail(actualizado.email)
            if (ocupado) {
                throw new ConflictoError(
                    `Ya existe otro cliente con el email ${actualizado.email}: ` +
                        `${ocupado.codigo ?? ''} ${ocupado.nombre}`.trim() + '.',
                )
            }
        }

        await this.repositorio.actualizar(documento._id, {
            nombre: actualizado.nombre,
            email: actualizado.email,
            empresa: actualizado.empresa,
            telefono: actualizado.telefono,
            actualizadoEn: new Date(),
        })

        return { ...documento, ...actualizado }
    }

    // REGLA: UN CLIENTE NO SE ELIMINA. Se desactiva y se reactiva.
    // El repositorio ni siquiera tiene el método `eliminar` (ver ISP).
    async desactivar(referencia) {
        const cliente = await this.#exigir(referencia)

        if (!cliente.activo) {
            throw new ReglaNegocioError(`El cliente "${cliente.nombre}" ya estaba desactivado.`)
        }

        await this.repositorio.actualizar(cliente._id, { activo: false })
        return cliente
    }

    async reactivar(referencia) {
        const cliente = await this.#exigir(referencia)

        if (cliente.activo) {
            throw new ReglaNegocioError(`El cliente "${cliente.nombre}" ya estaba activo.`)
        }

        await this.repositorio.actualizar(cliente._id, { activo: true })
        return cliente
    }
}
