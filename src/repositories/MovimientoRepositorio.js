import { aFechaLocal, finDelDiaLocal } from '../utils/formato.js'
import { BaseRepositorio } from './BaseRepositorio.js'

export class MovimientoRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'movimientos')
    }

    /** Clave para no registrar dos veces el mismo pago. */
    async buscarPorReferencia(referencia, session) {
        return this.coleccion.findOne({ referencia: referencia.trim().toUpperCase() }, { session })
    }

    /**
     * Lista movimientos aplicando filtros opcionales.
     * Los movimientos anulados NUNCA se cuentan: siguen en la base de datos
     * (para tener rastro) pero no computan en ningún cálculo.
     */
    async listarFiltrado({ proyectoId, clienteId, tipo, desde, hasta } = {}) {
        const filtro = { anulado: false }

        if (proyectoId) filtro.proyectoId = proyectoId
        if (clienteId) filtro.clienteId = clienteId
        if (tipo) filtro.tipo = tipo

        /*
         * $gte = mayor o igual, $lte = menor o igual.
         *
         * DOS SUTILEZAS, y las dos daban resultados mal:
         *
         * 1. `new Date('2026-09-15')` es medianoche UTC, que en Guatemala
         *    cae en el día anterior. Por eso `aFechaLocal`.
         *
         * 2. El "hasta" tiene que ser el FINAL del día, no su principio. Si
         *    comparas con las 00:00 del 15, un cobro hecho el 15 a las 10 de
         *    la mañana queda fuera. El usuario que escribe "hasta el 15"
         *    espera que el 15 entre entero.
         */
        if (desde || hasta) {
            filtro.fecha = {}
            if (desde) filtro.fecha.$gte = aFechaLocal(desde)
            if (hasta) filtro.fecha.$lte = finDelDiaLocal(hasta)
        }

        return this.coleccion.find(filtro).sort({ fecha: -1 }).toArray()
    }

    /**
     * AGREGACIÓN: suma los montos agrupados por tipo.
     *
     * En vez de traer 5.000 movimientos a Node y sumarlos con un bucle, se lo
     * pedimos a MongoDB, que lo hace en el servidor. Con muchos datos la
     * diferencia es enorme.
     */
    async sumarPorTipo(filtro = {}) {
        const resultado = await this.coleccion
            .aggregate([
                { $match: { ...filtro, anulado: false } }, // 1. filtra
                { $group: { _id: '$tipo', total: { $sum: '$monto' } } }, // 2. agrupa y suma
            ])
            .toArray()

        // El resultado llega como [{_id:'ingreso', total:X}, ...].
        // Lo convertimos a un objeto cómodo de usar.
        const totales = { ingresos: 0, egresos: 0 }
        for (const fila of resultado) {
            if (fila._id === 'ingreso') totales.ingresos = fila.total
            if (fila._id === 'egreso') totales.egresos = fila.total
        }
        totales.balance = totales.ingresos - totales.egresos
        return totales
    }

    async crearIndices() {
        await this.prepararColeccion()
        // DOBLE DEFENSA contra pagos duplicados: el servicio comprueba la
        // referencia antes de insertar, pero este índice es la garantía real.
        await this.coleccion.createIndex({ referencia: 1 }, { unique: true })
        await this.coleccion.createIndex({ proyectoId: 1 })
        await this.coleccion.createIndex({ fecha: -1 })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
