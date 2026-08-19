import { BaseRepositorio } from './BaseRepositorio.js'

export class PropuestaRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'propuestas')
    }

    // PROPUESTAS DE UN CLIENTE CONCRETO.
    async listarPorCliente(clienteId, session) {
        return this.coleccion.find({ clienteId }, { session }).toArray()
    }

    // PROPUESTAS FILTRADAS POR ESTADO: PENDIENTE, ACEPTADA O RECHAZADA.
    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async crearIndices() {
        await this.prepararColeccion()
        
        const existeContadores = await this.db.listCollections({ name: 'contadores' }).hasNext()
        if (!existeContadores) await this.db.createCollection('contadores')

        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        await this.coleccion.createIndex({ estado: 1 })
    }
}
