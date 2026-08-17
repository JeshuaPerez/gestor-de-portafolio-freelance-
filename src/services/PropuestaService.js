import { Propuesta } from '../models/Propuesta.js'
import { Proyecto } from '../models/Proyecto.js'
import { Contrato } from '../models/Contrato.js'

/**
 * =====================================================================
 *  ESTE ES EL ARCHIVO MÁS IMPORTANTE DEL PROYECTO.
 *  Aquí vive la TRANSACCIÓN.
 * =====================================================================
 *
 * El servicio recibe todo lo que necesita por el constructor (DIP):
 * los repositorios con los que trabaja y el cliente de MongoDB, que hace
 * falta para abrir sesiones de transacción.
 */
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

    /**
     * Solo las pendientes: las únicas que se pueden aceptar o rechazar.
     *
     * Las listas de elegir usan esto en vez de `listar()`. Ofrecer una
     * propuesta ya aceptada solo sirve para que el usuario la elija y se
     * lleve un error. Mejor no enseñar lo que no se puede usar.
     */
    async listarPendientes() {
        return this.propuestas.listarPorEstado('pendiente')
    }

    /**
     * Los clientes a los que se les puede hacer una propuesta.
     *
     * El menú de propuestas necesita enseñar esta lista para que elijas.
     * Se la damos desde aquí, y no inyectando ClienteService en el menú,
     * porque este servicio YA tiene el repositorio de clientes (lo usa para
     * validar) y así el menú sigue hablando con un único servicio.
     */
    async listarClientesDisponibles() {
        return this.clientes.listar({ activo: true })
    }

    /**
     * =================================================================
     *  ⭐ ACEPTAR PROPUESTA — OPERACIÓN TRANSACCIONAL
     * =================================================================
     *
     * Al aceptar una propuesta pasan TRES cosas en TRES colecciones:
     *
     *   1. la propuesta cambia a estado 'aceptada'   (colección propuestas)
     *   2. nace un proyecto derivado de ella          (colección proyectos)
     *   3. nace su contrato en borrador               (colección contratos)
     *
     * EL PROBLEMA SIN TRANSACCIÓN: imagina que el paso 1 se guarda y el
     * paso 2 falla (se cae la red, el código ya existe...). Te quedas con
     * una propuesta marcada como "aceptada" que no tiene ningún proyecto.
     * Datos incoherentes, y nadie se entera hasta que es tarde.
     *
     * LA SOLUCIÓN: meter los tres pasos en una transacción. MongoDB los trata
     * como uno solo: o se guardan LOS TRES, o no se guarda NINGUNO (rollback).
     *
     * La clave está en pasar la MISMA `session` a todas las operaciones.
     * Si olvidas pasarla en una sola de ellas, esa operación queda fuera de
     * la transacción y no se deshace. Es el fallo más típico.
     */
    async aceptar(propuestaId) {
        const session = this.mongoClient.startSession()

        try {
            let proyectoCreado = null

            // Todo lo que ocurra dentro de esta función es "todo o nada".
            // Si lanzamos un error aquí dentro, MongoDB deshace lo hecho.
            await session.withTransaction(async () => {
                // --- Paso 0: comprobaciones (leyendo DENTRO de la transacción) ---
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

                // --- Paso 1: marcar la propuesta como aceptada ---
                // Usamos `propuesta._id`, no lo que escribió el usuario: si
                // vino un código (PRO-0001), aquí ya hace falta el _id real.
                await this.propuestas.actualizar(
                    propuesta._id,
                    { estado: 'aceptada', aceptadaEn: new Date() },
                    session, // <-- la sesión: sin esto, no forma parte de la transacción
                )

                // --- Paso 2: crear el proyecto derivado ---
                const codigo = await this.proyectos.siguienteCodigo('PRY', session)
                const proyecto = Proyecto.desdePropuesta(propuesta, codigo) // Factory Method
                proyecto.validar()

                const proyectoId = await this.proyectos.crear(proyecto.aDocumento(), session)

                // --- Paso 3: crear el contrato en borrador ---
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
            // `finally` se ejecuta siempre, haya ido bien o mal. Las sesiones
            // sin cerrar dejan recursos abiertos en el servidor.
            await session.endSession()
        }
    }

    /**
     * Edita una propuesta.
     *
     * REGLA: solo mientras esté PENDIENTE.
     *
     * En cuanto se acepta, esa propuesta ya generó un proyecto y un contrato
     * que copiaron su monto y su plazo. Cambiarla después dejaría al proyecto
     * diciendo una cifra y a la propuesta otra, sin que nada avise. Si hay
     * que corregir algo de una propuesta aceptada, se corrige en el contrato,
     * que es el documento que vale.
     */
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

    /** REGLA: solo se rechazan propuestas pendientes, y con motivo. */
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

        // Aquí NO hace falta transacción: solo tocamos una colección.
        // Usar transacciones donde no se necesitan es un error común: cuestan
        // rendimiento y complican el código sin aportar nada.
        await this.propuestas.actualizar(propuesta._id, {
            estado: 'rechazada',
            motivoRechazo: motivo.trim(),
            rechazadaEn: new Date(),
        })

        return propuesta
    }

    /** Tasa de conversión: cuántas propuestas acaban en proyecto. */
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
            // Evitamos dividir entre 0 cuando aún no hay propuestas.
            conversion: total === 0 ? 0 : Math.round((aceptadas / total) * 100),
        }
    }
}
