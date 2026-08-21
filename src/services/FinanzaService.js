import { aFechaLocal, finDelDiaLocal, redondearDinero } from '../dominio/valores.js'
import { ConflictoError, NoEncontradoError, ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { Movimiento } from '../models/Movimiento.js'

// REGLAS DE NEGOCIO PARA FINANZAS
export class FinanzaService {
    constructor(movimientoRepositorio, proyectoRepositorio, clienteRepositorio, unidadDeTrabajo) {
        this.movimientos = movimientoRepositorio
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.unidadDeTrabajo = unidadDeTrabajo
    }

    async #exigirMovimiento(referencia, contexto) {
        const movimiento = await this.movimientos.buscarPorIdOCodigo(referencia, contexto)
        if (!movimiento) throw new NoEncontradoError('movimiento', referencia)
        return movimiento
    }

    // REGISTRAR — atómico: crea el movimiento y mueve el acumulado del proyecto.
    async registrar(datos) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const proyecto = await this.proyectos.buscarPorIdOCodigo(datos.proyectoId, contexto)
            if (!proyecto) throw new NoEncontradoError('proyecto', datos.proyectoId)

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
                contexto,
            )
            if (repetido) {
                throw new ConflictoError(
                    `La referencia ${documento.referencia} ya está registrada ` +
                        `(${repetido.concepto}). Ese pago ya se contabilizó.`,
                )
            }

            // REGLA: no se puede cobrar más de lo pactado en el proyecto.
            if (movimiento.esIngreso()) {
                const pendiente = redondearDinero(proyecto.monto - (proyecto.cobrado ?? 0))
                if (documento.monto > pendiente) {
                    throw new ReglaNegocioError(
                        `El ingreso supera el saldo pendiente del proyecto ` +
                            `(pendiente: ${pendiente}). Revisa el monto.`,
                    )
                }
            }

            // PASO 1: crear el movimiento con su código único
            documento.codigo = await this.movimientos.siguienteCodigo('MOV', contexto)
            const id = await this.movimientos.crear(documento, contexto)

            // PASO 2: actualizar el acumulado del proyecto
            await this.proyectos.incrementarAcumulado(
                String(proyecto._id),
                movimiento.campoAcumulado(),
                documento.monto,
                contexto,
            )

            return { _id: id, ...documento }
        })
    }

    // ANULAR — atómico: marca el movimiento y revierte el acumulado.
    async anular(referencia, motivo) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const documento = await this.#exigirMovimiento(referencia, contexto)

            if (documento.anulado) {
                throw new ReglaNegocioError('Ese movimiento ya estaba anulado.')
            }
            if (!motivo || motivo.trim().length < 5) {
                throw new ValidacionError(
                    'Debes indicar el motivo de la anulación (mínimo 5 caracteres).',
                    { campo: 'motivo' },
                )
            }

            // Paso 1: marcarlo como anulado
            await this.movimientos.actualizar(
                documento._id,
                { anulado: true, motivoAnulacion: motivo.trim(), anuladoEn: new Date() },
                contexto,
            )

            // Paso 2: revertir el acumulado (el signo menos ES la reversión)
            const movimiento = Movimiento.desdeDocumento(documento)
            await this.proyectos.incrementarAcumulado(
                String(documento.proyectoId),
                movimiento.campoAcumulado(),
                -documento.monto,
                contexto,
            )

            return documento
        })
    }

    /**
     * REGLA: los importes NO se editan. Un importe mal puesto se anula y se
     * vuelve a registrar, para que quede rastro. Solo se corrige el concepto.
     */
    async editarConcepto(referencia, concepto) {
        const documento = await this.#exigirMovimiento(referencia)

        if (documento.anulado) {
            throw new ReglaNegocioError('Ese movimiento está anulado: no se puede editar.')
        }

        const editado = Movimiento.desdeDocumento(documento, { concepto })
        editado.validar()

        await this.movimientos.actualizar(documento._id, {
            concepto: editado.concepto,
            actualizadoEn: new Date(),
        })

        return { ...documento, concepto: editado.concepto }
    }

    async listar(filtros) {
        return this.movimientos.listarFiltrado(filtros)
    }

    async listarProyectos() {
        return this.proyectos.listar()
    }

    // BALANCE GENERAL: ingresos, egresos y utilidad, opcionalmente por fechas.
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
            if (totales.ingresos === 0 && totales.egresos === 0) continue
            filas.push({ cliente: cliente.nombre, ...totales })
        }

        return filas.sort((a, b) => b.balance - a.balance)
    }

    // RENTABILIDAD DE UN PROYECTO.
    async rentabilidad(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new NoEncontradoError('proyecto', referencia)

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
                totales.ingresos === 0 ? 0 : Math.round((totales.balance / totales.ingresos) * 100),
        }
    }
}
