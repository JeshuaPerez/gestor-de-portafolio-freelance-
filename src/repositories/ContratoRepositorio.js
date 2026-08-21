import { Contrato } from '../models/Contrato.js'
import { RepositorioEscritura } from './RepositorioEscritura.js'

// PATRÓN REPOSITORY — CONTRATOS
// Un contrato no se borra: se cancela. Es un documento legal.
export class ContratoRepositorio extends RepositorioEscritura {
    constructor(db) {
        super(db, 'contratos')
    }

    async buscarPorProyecto(proyectoId, contexto) {
        return this.coleccion.findOne({ proyectoId }, { session: contexto })
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async crearIndices() {
        await this.prepararColeccion(Contrato.esquemaMongo())
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        // REGLA EN LA BASE DE DATOS: UN PROYECTO, UN SOLO CONTRATO.
        await this.coleccion.createIndex({ proyectoId: 1 }, { unique: true })
    }
}
