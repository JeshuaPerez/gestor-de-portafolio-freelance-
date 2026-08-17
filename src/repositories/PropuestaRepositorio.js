import { BaseRepositorio } from './BaseRepositorio.js'

export class PropuestaRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'propuestas')
    }

    /** Propuestas de un cliente concreto. */
    async listarPorCliente(clienteId, session) {
        return this.coleccion.find({ clienteId }, { session }).toArray()
    }

    /** Propuestas filtradas por estado: pendiente, aceptada o rechazada. */
    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async crearIndices() {
        await this.prepararColeccion()
        // La colección de contadores se usa para generar PRO-0001, PRO-0002...
        // Debe existir antes de la primera transacción.
        const existeContadores = await this.db.listCollections({ name: 'contadores' }).hasNext()
        if (!existeContadores) await this.db.createCollection('contadores')

        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        await this.coleccion.createIndex({ estado: 1 })
    }
}
