import { Cliente } from '../models/Cliente.js'

/**
 * CAPA DE SERVICIO — aquí viven las REGLAS DE NEGOCIO.
 *
 * SRP (Responsabilidad Única, la S de SOLID):
 *   - el menú     -> solo habla con el usuario (preguntas y mensajes)
 *   - el servicio -> solo decide qué es válido y qué no  <-- ESTE ARCHIVO
 *   - el repositorio -> solo lee y escribe en MongoDB
 *
 * En tu app.js, `createUser` hacía las tres cosas a la vez. Separarlas
 * significa que estas reglas se pueden probar sin abrir la consola, y
 * reutilizar desde cualquier sitio (una API web, por ejemplo).
 *
 * DIP (Inversión de Dependencias, la D de SOLID):
 * el repositorio llega por el constructor, no se crea aquí dentro. Este
 * servicio no sabe si por debajo hay MongoDB, PostgreSQL o un array.
 */
export class ClienteService {
    constructor(clienteRepositorio) {
        this.repositorio = clienteRepositorio
    }

    /** REGLA: el email no se puede repetir. */
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

        // El código legible se pide aquí, no en el modelo: generarlo toca la
        // base de datos (colección `contadores`) y eso es cosa del servicio.
        documento.codigo = await this.repositorio.siguienteCodigo('CLI')

        await this.repositorio.crear(documento)
        return documento.codigo // devolvemos el código, no el ObjectId
    }

    async listar() {
        return this.repositorio.listar()
    }

    /**
     * Solo los clientes activos.
     *
     * Lo usan las listas donde hay que ELEGIR un cliente: no tiene sentido
     * ofrecer uno desactivado si luego la regla de negocio va a rechazarlo.
     * Mejor no enseñar lo que no se puede elegir.
     */
    async listarActivos() {
        return this.repositorio.listar({ activo: true })
    }

    /** Los desactivados. Solo se usa en la pantalla de reactivar. */
    async listarInactivos() {
        return this.repositorio.listar({ activo: false })
    }

    async buscar(texto) {
        if (!texto || texto.trim().length < 2) {
            throw new Error('Escribe al menos 2 caracteres para buscar.')
        }
        return this.repositorio.buscarPorTexto(texto.trim())
    }

    /**
     * REGLA: un cliente NUNCA se elimina, se desactiva.
     *
     * Motivo real de negocio: si borráramos el cliente, sus propuestas,
     * proyectos y facturas quedarían apuntando a un cliente inexistente y el
     * histórico contable se rompería. Desactivar conserva la trazabilidad.
     */
    /**
     * Edita los datos de un cliente.
     *
     * TRUCO PARA NO DUPLICAR LAS VALIDACIONES:
     *
     * en vez de escribir aquí otra vez "el nombre necesita 3 caracteres, el
     * email necesita una arroba…", mezclamos lo que ya había con lo que llega
     * nuevo y construimos un `Cliente` completo con el resultado. Ese objeto
     * se valida solo, igual que al crearlo.
     *
     * Así las reglas viven en un único sitio: el modelo. Si mañana el email
     * pasa a exigir algo más, crear y editar lo respetan sin tocar nada aquí.
     */
    async editar(referencia, cambios) {
        const cliente = await this.repositorio.buscarPorIdOCodigo(referencia)
        if (!cliente) throw new Error(`No existe ningún cliente con la referencia "${referencia}".`)

        // `??` y no `||`: si el usuario borra la empresa a propósito, llega
        // como null y queremos respetarlo. Con `||` un valor vacío legítimo
        // se sustituiría por el anterior.
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
