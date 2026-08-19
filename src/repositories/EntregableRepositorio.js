import { ObjectId } from 'mongodb'
import { BaseRepositorio } from './BaseRepositorio.js'

export class EntregableRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'entregables')
    }

    async listarPorProyecto(proyectoId, session) {
        return this.coleccion.find({ proyectoId }, { session }).sort({ fechaLimite: 1 }).toArray()
    }

    async listarVencidos() {
        return this.coleccion
            .find({
                fechaLimite: { $lt: new Date() },
                estado: { $ne: 'aprobado' }, // $ne = "distinto de"
            })
            .sort({ fechaLimite: 1 })
            .toArray()
    }

    async agregarAlHistorial(id, entrada, session) {
        await this.coleccion.updateOne(
            { _id: new ObjectId(id) },
            { $push: { historial: entrada } },
            { session },
        )
    }

    async crearIndices() {
        await this.prepararColeccion()
        await this.coleccion.createIndex({ proyectoId: 1 })
        await this.coleccion.createIndex({ fechaLimite: 1 })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
