import { aFechaLocal, finDelDiaLocal } from '../utils/formato.js'
import { BaseRepositorio } from './BaseRepositorio.js'

export class MovimientoRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'movimientos')
    }

    //CLAVE PARA NO REGISTRAR DOS VECES EL MISMO PAGO.
    async buscarPorReferencia(referencia, session) {
        return this.coleccion.findOne({ referencia: referencia.trim().toUpperCase() }, { session })
    }

    async listarFiltrado({ proyectoId, clienteId, tipo, desde, hasta } = {}) {
        const filtro = { anulado: false }

        if (proyectoId) filtro.proyectoId = proyectoId
        if (clienteId) filtro.clienteId = clienteId
        if (tipo) filtro.tipo = tipo
        if (desde || hasta) {
            filtro.fecha = {}
            if (desde) filtro.fecha.$gte = aFechaLocal(desde)
            if (hasta) filtro.fecha.$lte = finDelDiaLocal(hasta)
        }

        return this.coleccion.find(filtro).sort({ fecha: -1 }).toArray()
    }

    async sumarPorTipo(filtro = {}) {
        const resultado = await this.coleccion
            .aggregate([
                { $match: { ...filtro, anulado: false } }, // 1. FILTRA
                { $group: { _id: '$tipo', total: { $sum: '$monto' } } }, // 2. AGRUPA Y SUMA
            ])
            .toArray()

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
        await this.coleccion.createIndex({ referencia: 1 }, { unique: true })
        await this.coleccion.createIndex({ proyectoId: 1 })
        await this.coleccion.createIndex({ fecha: -1 })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
