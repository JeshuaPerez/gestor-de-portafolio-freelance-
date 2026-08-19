import { ObjectId } from 'mongodb'
import { BaseRepositorio } from './BaseRepositorio.js'

export class ProyectoRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'proyectos')
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async buscarPorPropuesta(propuestaId, session) {
        return this.coleccion.findOne({ propuestaId }, { session })
    }

    async incrementarAcumulado(id, campo, cantidad, session) {
        await this.coleccion.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { [campo]: cantidad } },
            { session },
        )

        await this.coleccion.updateOne(
            { _id: new ObjectId(id) },
            [{ $set: { [campo]: { $round: [`$${campo}`, 2] } } }],
            { session },
        )
    }

    async crearIndices() {
        await this.prepararColeccion()
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        await this.coleccion.createIndex({ propuestaId: 1 }, { unique: true })
    }
}
