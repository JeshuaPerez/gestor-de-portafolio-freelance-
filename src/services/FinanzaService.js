import { Movimiento } from '../models/Movimiento.js'
import { aFechaLocal, finDelDiaLocal, redondearDinero } from '../utils/formato.js'

// REGLAS DE NEGOCIO PARA FINANZAS
export class FinanzaService {
    constructor(movimientoRepositorio, proyectoRepositorio, clienteRepositorio, mongoClient) {
        this.movimientos = movimientoRepositorio
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.mongoClient = mongoClient
    }

    // REGLA: REGISTRAR MOVIMIENTO (ingreso o egreso) — transaccional
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

                // REFERENCIA ÚNICA: no se puede registrar dos veces el mismo pago.
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

                // REGLA: no se puede registrar un ingreso que supere lo pactado en el proyecto.
                if (documento.tipo === 'ingreso') {
                    const pendiente = redondearDinero(proyecto.monto - (proyecto.cobrado ?? 0))
                    if (documento.monto > pendiente) {
                        throw new Error(
                            `El ingreso supera el saldo pendiente del proyecto ` +
                                `(pendiente: ${pendiente}). Revisa el monto.`,
                        )
                    }
                }

                // PASO 1: crear el movimiento y asignarle un código único
                documento.codigo = await this.movimientos.siguienteCodigo('MOV', session)
                const id = await this.movimientos.crear(documento, session)

                // PASO 2: actualizar el acumulado del proyecto
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

    // ANULAR MOVIMIENTO — transaccional
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

    // EDITAR CONCEPTO DE MOVIMIENTO 
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

    async listarProyectos() {
        return this.proyectos.listar()
    }

    // BALANCE GENERAL: ingresos, egresos y utilidad, opcionalmente filtrado por fecha
    async balance({ desde, hasta } = {}) {
        const filtro = {}
        if (desde || hasta) {
            filtro.fecha = {}
            if (desde) filtro.fecha.$gte = aFechaLocal(desde)
            if (hasta) filtro.fecha.$lte = finDelDiaLocal(hasta)
        }
        return this.movimientos.sumarPorTipo(filtro)
    }

    // Balance de cada cliente, ordenado por el que más deja.
    async balancePorCliente() {
        const clientes = await this.clientes.listar()
        const filas = []

        for (const cliente of clientes) {
            const totales = await this.movimientos.sumarPorTipo({ clienteId: cliente._id })
            // No mostramos clientes sin ningún movimiento
            if (totales.ingresos === 0 && totales.egresos === 0) continue
            filas.push({ cliente: cliente.nombre, ...totales })
        }

        return filas.sort((a, b) => b.balance - a.balance)
    }

    // RENTABILIDAD DE UN PROYECTO: cuánto ha costado, cuánto se ha cobrado y el margen
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
            margen:
                totales.ingresos === 0
                    ? 0
                    : Math.round((totales.balance / totales.ingresos) * 100),
        }
    }
}
