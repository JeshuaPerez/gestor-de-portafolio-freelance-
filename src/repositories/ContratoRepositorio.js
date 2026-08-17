import { BaseRepositorio } from './BaseRepositorio.js'

export class ContratoRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'contratos')
    }

    async buscarPorProyecto(proyectoId, session) {
        return this.coleccion.findOne({ proyectoId }, { session })
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async crearIndices() {
        await this.prepararColeccion()
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        // REGLA EN LA BASE DE DATOS: un proyecto, un solo contrato.
        await this.coleccion.createIndex({ proyectoId: 1 }, { unique: true })
    }
}
