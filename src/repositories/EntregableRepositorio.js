import { ObjectId } from 'mongodb'
import { BaseRepositorio } from './BaseRepositorio.js'

export class EntregableRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'entregables')
    }

    /**
     * Todos los entregables de un proyecto.
     *
     * Acepta `session` porque se llama DENTRO de la transacción que recalcula
     * el avance: necesitamos leer los datos tal y como van quedando dentro de
     * la transacción, no como están en disco.
     */
    async listarPorProyecto(proyectoId, session) {
        return this.coleccion.find({ proyectoId }, { session }).sort({ fechaLimite: 1 }).toArray()
    }

    /** Entregables cuya fecha límite ya pasó y siguen sin aprobar. */
    async listarVencidos() {
        return this.coleccion
            .find({
                fechaLimite: { $lt: new Date() },
                estado: { $ne: 'aprobado' }, // $ne = "distinto de"
            })
            .sort({ fechaLimite: 1 })
            .toArray()
    }

    /**
     * Añade una entrada al historial del entregable.
     * `$push` agrega un elemento a un array sin tocar los que ya había.
     */
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
