import { Proyecto } from '../models/Proyecto.js'
import { RepositorioEscritura } from './RepositorioEscritura.js'
import { RepositorioLectura } from './RepositorioLectura.js'

// PATRÓN REPOSITORY — PROYECTOS
// Un proyecto no se borra: se cancela con su motivo.
export class ProyectoRepositorio extends RepositorioEscritura {
    constructor(db) {
        super(db, 'proyectos')
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    async buscarPorPropuesta(propuestaId, contexto) {
        return this.coleccion.findOne({ propuestaId }, { session: contexto })
    }

    /** Mueve un acumulado (cobrado/gastado) y lo deja redondeado a 2 decimales. */
    async incrementarAcumulado(id, campo, cantidad, contexto) {
        const _id = RepositorioLectura.normalizarId(id)

        await this.coleccion.updateOne(
            { _id },
            { $inc: { [campo]: cantidad } },
            { session: contexto },
        )

        await this.coleccion.updateOne(
            { _id },
            [{ $set: { [campo]: { $round: [`$${campo}`, 2] } } }],
            { session: contexto },
        )
    }

    async crearIndices() {
        await this.prepararColeccion(Proyecto.esquemaMongo())
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        await this.coleccion.createIndex({ propuestaId: 1 }, { unique: true })
    }
}
