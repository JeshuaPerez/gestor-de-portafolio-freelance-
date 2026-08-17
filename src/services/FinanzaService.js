import { Movimiento } from '../models/Movimiento.js'
import { aFechaLocal, finDelDiaLocal, redondearDinero } from '../utils/formato.js'

/**
 * Reglas de negocio del dinero.
 *
 * Es el servicio más delicado: aquí un error significa que tu contabilidad
 * miente. La tercera transacción del proyecto vive aquí.
 */
export class FinanzaService {
    constructor(movimientoRepositorio, proyectoRepositorio, clienteRepositorio, mongoClient) {
        this.movimientos = movimientoRepositorio
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.mongoClient = mongoClient
    }

    /**
     * ⭐ REGISTRAR MOVIMIENTO — OPERACIÓN TRANSACCIONAL
     *
     * Dos colecciones:
     *   1. se guarda el movimiento                        (movimientos)
     *   2. se actualiza el acumulado del proyecto con $inc (proyectos)
     *
     * Si se guardara el movimiento pero fallara el acumulado, el proyecto
     * diría que le deben dinero que ya cobró. El balance dejaría de cuadrar
     * y encontrar el descuadre después es una pesadilla.
     */
    async registrar(datos) {
        const session = this.mongoClient.startSession()

        try {
            let registrado = null

            await session.withTransaction(async () => {
                const proyecto = await this.proyectos.buscarPorIdOCodigo(datos.proyectoId, session)
                if (!proyecto) {
                    throw new Error(
                        `No existe ningún proyecto con la referencia "${datos.proyectoId}".`,
                    )
                }

                const movimiento = new Movimiento({
                    ...datos,
                    proyectoId: proyecto._id,
                    clienteId: proyecto.clienteId, // lo heredamos del proyecto
                })
                movimiento.validar()

                const documento = movimiento.aDocumento()

                // ----- ANTI-DUPLICIDAD (primera defensa) -----
                // Si la referencia ya existe, es el mismo pago otra vez.
                const repetido = await this.movimientos.buscarPorReferencia(
                    documento.referencia,
                    session,
                )
                if (repetido) {
                    throw new Error(
                        `La referencia ${documento.referencia} ya está registrada ` +
                            `(${repetido.concepto}). Ese pago ya se contabilizó.`,
                    )
                }
                // La segunda defensa es el índice único de MongoDB sobre
                // `referencia`. Ver MovimientoRepositorio.crearIndices().

                // ----- REGLA: no puedes cobrar más de lo pactado -----
                if (documento.tipo === 'ingreso') {
                    // Redondeado: si el pendiente arrastrara un residuo de
                    // coma flotante, el pago final exacto se rechazaría por
                    // una millonésima de quetzal.
                    const pendiente = redondearDinero(proyecto.monto - (proyecto.cobrado ?? 0))
                    if (documento.monto > pendiente) {
                        throw new Error(
                            `El ingreso supera el saldo pendiente del proyecto ` +
                                `(pendiente: ${pendiente}). Revisa el monto.`,
                        )
                    }
                }

                // --- Paso 1: guardar el movimiento ---
                // El código se pide DENTRO de la transacción y con la sesión:
                // si la transacción se deshace, el contador también vuelve
                // atrás y no se queda un MOV-0007 quemado sin movimiento.
                documento.codigo = await this.movimientos.siguienteCodigo('MOV', session)
                const id = await this.movimientos.crear(documento, session)

                // --- Paso 2: actualizar el acumulado del proyecto ---
                const campo = documento.tipo === 'ingreso' ? 'cobrado' : 'gastado'
                await this.proyectos.incrementarAcumulado(
                    String(proyecto._id),
                    campo,
                    documento.monto,
                    session,
                )

                registrado = { _id: id, ...documento }
            })

            return registrado
        } finally {
            await session.endSession()
        }
    }

    /**
     * ⭐ ANULAR — también transaccional, y en sentido contrario.
     *
     * Un movimiento no se borra nunca (perderías el rastro contable): se
     * marca como anulado y se RESTA del acumulado. Fíjate en el `-monto`:
     * es el mismo $inc, pero con signo negativo.
     */
    async anular(referencia, motivo) {
        const session = this.mongoClient.startSession()

        try {
            let anulado = null

            await session.withTransaction(async () => {
                const movimiento = await this.movimientos.buscarPorIdOCodigo(referencia, session)
                if (!movimiento) {
                    throw new Error(`No existe ningún movimiento con la referencia "${referencia}".`)
                }

                if (movimiento.anulado) {
                    throw new Error('Ese movimiento ya estaba anulado.')
                }
                if (!motivo || motivo.trim().length < 5) {
                    throw new Error('Debes indicar el motivo de la anulación (mínimo 5 caracteres).')
                }

                // Paso 1: marcarlo como anulado
                await this.movimientos.actualizar(
                    movimiento._id,
                    { anulado: true, motivoAnulacion: motivo.trim(), anuladoEn: new Date() },
                    session,
                )

                // Paso 2: revertir el acumulado (restando)
                const campo = movimiento.tipo === 'ingreso' ? 'cobrado' : 'gastado'
                await this.proyectos.incrementarAcumulado(
                    String(movimiento.proyectoId),
                    campo,
                    -movimiento.monto, // <-- el signo menos es toda la reversión
                    session,
                )

                anulado = movimiento
            })

            return anulado
        } finally {
            await session.endSession()
        }
    }

    /**
     * Edita un movimiento — pero SOLO su concepto.
     *
     * ESTA ES LA DECISIÓN MÁS DELIBERADA DEL PROYECTO, y conviene poder
     * defenderla: un movimiento registrado es un APUNTE CONTABLE, y los
     * apuntes contables no se editan. Nunca.
     *
     * Si se pudiera cambiar el monto de un cobro ya registrado, el acumulado
     * del proyecto quedaría descuadrado en silencio —fue calculado con la
     * cifra vieja— y no habría forma de saber que alguien lo tocó. Lo mismo
     * con el tipo o la categoría: moverían el balance sin dejar rastro.
     *
     * Lo correcto cuando un importe está mal es ANULAR el movimiento (que
     * revierte el acumulado y deja constancia del motivo) y registrar uno
     * nuevo con la cifra correcta. El error queda visible, que es justo lo
     * que la contabilidad necesita.
     *
     * El `concepto` sí se puede corregir porque es una descripción para
     * leerlo, no un dato que entre en ningún cálculo.
     */
    async editarConcepto(referencia, concepto) {
        const movimiento = await this.movimientos.buscarPorIdOCodigo(referencia)
        if (!movimiento) {
            throw new Error(`No existe ningún movimiento con la referencia "${referencia}".`)
        }

        if (movimiento.anulado) {
            throw new Error('Ese movimiento está anulado: no se puede editar.')
        }
        if (!concepto || concepto.trim().length < 3) {
            throw new Error('El concepto es obligatorio (mínimo 3 caracteres).')
        }

        await this.movimientos.actualizar(movimiento._id, {
            concepto: concepto.trim(),
            actualizadoEn: new Date(),
        })

        return { ...movimiento, concepto: concepto.trim() }
    }

    async listar(filtros) {
        return this.movimientos.listarFiltrado(filtros)
    }

    /** Para las listas de elegir del menú de finanzas. */
    async listarProyectos() {
        return this.proyectos.listar()
    }

    /**
     * Balance general, opcionalmente entre dos fechas.
     *
     * Las fechas se interpretan en hora local y el "hasta" incluye el día
     * entero. Ver el comentario largo en MovimientoRepositorio.listarFiltrado.
     */
    async balance({ desde, hasta } = {}) {
        const filtro = {}
        if (desde || hasta) {
            filtro.fecha = {}
            if (desde) filtro.fecha.$gte = aFechaLocal(desde)
            if (hasta) filtro.fecha.$lte = finDelDiaLocal(hasta)
        }
        return this.movimientos.sumarPorTipo(filtro)
    }

    /** Balance de cada cliente, ordenado por el que más deja. */
    async balancePorCliente() {
        const clientes = await this.clientes.listar()
        const filas = []

        for (const cliente of clientes) {
            const totales = await this.movimientos.sumarPorTipo({ clienteId: cliente._id })
            // No mostramos clientes sin ningún movimiento: solo hacen ruido.
            if (totales.ingresos === 0 && totales.egresos === 0) continue
            filas.push({ cliente: cliente.nombre, ...totales })
        }

        return filas.sort((a, b) => b.balance - a.balance)
    }

    /**
     * Rentabilidad de un proyecto: lo pactado frente a lo cobrado y gastado.
     */
    async rentabilidad(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        const totales = await this.movimientos.sumarPorTipo({ proyectoId: proyecto._id })

        return {
            proyecto: proyecto.nombre,
            codigo: proyecto.codigo,
            presupuesto: proyecto.monto,
            cobrado: totales.ingresos,
            gastado: totales.egresos,
            utilidad: totales.balance,
            pendienteDeCobro: proyecto.monto - totales.ingresos,
            // Margen sobre lo cobrado. Si no ha cobrado nada, no hay margen
            // que calcular (y dividir entre 0 daría Infinity).
            margen:
                totales.ingresos === 0
                    ? 0
                    : Math.round((totales.balance / totales.ingresos) * 100),
        }
    }
}
