import { Propuesta } from '../models/Propuesta.js'
import { RepositorioEscritura } from './RepositorioEscritura.js'

// PATRÓN REPOSITORY — PROPUESTAS
// Una propuesta no se borra: se rechaza con su motivo.
export class PropuestaRepositorio extends RepositorioEscritura {
    constructor(db) {
        super(db, 'propuestas')
    }

    async listarPorCliente(clienteId, contexto) {
        return this.coleccion.find({ clienteId }, { session: contexto }).toArray()
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async crearIndices() {
        await this.prepararColeccion(Propuesta.esquemaMongo())

        // La colección de contadores alimenta los códigos CLI-0001, PRO-0001...
        const existeContadores = await this.db.listCollections({ name: 'contadores' }).hasNext()
        if (!existeContadores) await this.db.createCollection('contadores')

        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        await this.coleccion.createIndex({ estado: 1 })
    }
}
