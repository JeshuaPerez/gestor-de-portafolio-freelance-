import { Propuesta } from '../models/Propuesta.js'
import { Proyecto } from '../models/Proyecto.js'
import { Contrato } from '../models/Contrato.js'

// TRANSACCIONES 
export class PropuestaService {
    constructor(
        propuestaRepositorio,
        proyectoRepositorio,
        contratoRepositorio,
        clienteRepositorio,
        mongoClient,
    ) {
        this.propuestas = propuestaRepositorio
        this.proyectos = proyectoRepositorio
        this.contratos = contratoRepositorio
        this.clientes = clienteRepositorio
        this.mongoClient = mongoClient
    }

    /** REGLA: la propuesta debe ir a un cliente que exista y esté activo. */
    async crear(datos) {
        const cliente = await this.clientes.buscarPorIdOCodigo(datos.clienteId)
        if (!cliente) throw new Error(`No existe ningún cliente con la referencia "${datos.clienteId}".`)
        if (!cliente.activo) {
            throw new Error(`El cliente "${cliente.nombre}" está desactivado.`)
        }

        const propuesta = new Propuesta({ ...datos, clienteId: cliente._id })
        propuesta.validar()

        propuesta.codigo = await this.propuestas.siguienteCodigo('PRO')
        await this.propuestas.crear(propuesta.aDocumento())
        return propuesta.codigo
    }

    async listar(estado) {
        // Sin filtro devolvemos todas; con filtro, solo las de ese estado.
        return estado ? this.propuestas.listarPorEstado(estado) : this.propuestas.listar()
    }

    // SOLO PENDIENTES
    async listarPendientes() {
        return this.propuestas.listarPorEstado('pendiente')
    }

    // CLIENTES ACTIVOS: solo se pueden aceptar propuestas de clientes activos.
    async listarClientesDisponibles() {
        return this.clientes.listar({ activo: true })
    }

    // ACEPTAR PROPUESTA: crea proyecto y contrato en borrador, todo en una transacción.
    async aceptar(propuestaId) {
        const session = this.mongoClient.startSession()

        try {
            let proyectoCreado = null

            await session.withTransaction(async () => {
                // PASO 0 COMPROBACIONES 
                const propuesta = await this.propuestas.buscarPorIdOCodigo(propuestaId, session)
                if (!propuesta) {
                    throw new Error(`No existe ninguna propuesta con la referencia "${propuestaId}".`)
                }

                if (propuesta.estado !== 'pendiente') {
                    throw new Error(
                        `La propuesta ${propuesta.codigo} ya está ${propuesta.estado}. ` +
                            'Solo se pueden aceptar propuestas pendientes.',
                    )
                }

                // PASO 1: marcar la propuesta como aceptada
                await this.propuestas.actualizar(
                    propuesta._id,
                    { estado: 'aceptada', aceptadaEn: new Date() },
                    session,
                )

                // PASO 2: crear el proyecto a partir de la propuesta
                const codigo = await this.proyectos.siguienteCodigo('PRY', session)
                const proyecto = Proyecto.desdePropuesta(propuesta, codigo) // Factory Method
                proyecto.validar()

                const proyectoId = await this.proyectos.crear(proyecto.aDocumento(), session)

                // PASO 3: crear el contrato en borrador
                const codigoContrato = await this.contratos.siguienteCodigo('CON', session)
                const contrato = Contrato.desdeProyecto(proyecto, proyectoId, codigoContrato)
                contrato.validar()
                await this.contratos.crear(contrato.aDocumento(), session)

                proyectoCreado = {
                    _id: proyectoId,
                    codigo,
                    nombre: proyecto.nombre,
                    codigoContrato,
                }
            })

            return proyectoCreado
        } finally {
            await session.endSession()
        }
    }

    // EDITAR PROPUESTA: solo se pueden editar las pendientes, y se valida todo el modelo.
    async editar(referencia, cambios) {
        const propuesta = await this.propuestas.buscarPorIdOCodigo(referencia)
        if (!propuesta) {
            throw new Error(`No existe ninguna propuesta con la referencia "${referencia}".`)
        }

        if (propuesta.estado !== 'pendiente') {
            throw new Error(
                `La propuesta ${propuesta.codigo} está ${propuesta.estado}: ya no se puede editar. ` +
                    'Solo se editan las pendientes.',
            )
        }

        // Se reconstruye el modelo completo para que se valide solo.
        const fusionada = new Propuesta({
            clienteId: propuesta.clienteId,
            codigo: propuesta.codigo,
            titulo: cambios.titulo ?? propuesta.titulo,
            descripcion: cambios.descripcion === undefined ? propuesta.descripcion : cambios.descripcion,
            monto: cambios.monto ?? propuesta.monto,
            plazoDias: cambios.plazoDias ?? propuesta.plazoDias,
            fechaVencimiento: propuesta.fechaVencimiento,
        })
        fusionada.validar()

        const documento = fusionada.aDocumento()

        await this.propuestas.actualizar(propuesta._id, {
            titulo: documento.titulo,
            descripcion: documento.descripcion,
            monto: documento.monto,
            plazoDias: documento.plazoDias,
            actualizadoEn: new Date(),
        })

        return { ...propuesta, ...documento }
    }

    // REGLA DE NEGOCIO: rechazar propuesta
    async rechazar(propuestaId, motivo) {
        const propuesta = await this.propuestas.buscarPorIdOCodigo(propuestaId)
        if (!propuesta) {
            throw new Error(`No existe ninguna propuesta con la referencia "${propuestaId}".`)
        }

        if (propuesta.estado !== 'pendiente') {
            throw new Error(`La propuesta ${propuesta.codigo} ya está ${propuesta.estado}.`)
        }
        if (!motivo || motivo.trim().length < 5) {
            throw new Error('Debes indicar el motivo del rechazo (mínimo 5 caracteres).')
        }
        await this.propuestas.actualizar(propuesta._id, {
            estado: 'rechazada',
            motivoRechazo: motivo.trim(),
            rechazadaEn: new Date(),
        })

        return propuesta
    }

    // REGLA DE NEGOCIO: estadísticas de conversión
    async estadisticas() {
        const total = await this.propuestas.contar()
        const aceptadas = await this.propuestas.contar({ estado: 'aceptada' })
        const rechazadas = await this.propuestas.contar({ estado: 'rechazada' })
        const pendientes = await this.propuestas.contar({ estado: 'pendiente' })

        return {
            total,
            aceptadas,
            rechazadas,
            pendientes,
            conversion: total === 0 ? 0 : Math.round((aceptadas / total) * 100),
        }
    }
}
