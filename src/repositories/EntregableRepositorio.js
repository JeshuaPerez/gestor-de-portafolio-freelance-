import { Entregable } from '../models/Entregable.js'
import { EstadoEntregable } from '../models/estados/EstadoEntregable.js'
import { RepositorioEliminable } from './RepositorioEliminable.js'
import { RepositorioLectura } from './RepositorioLectura.js'

// PATRÓN REPOSITORY — ENTREGABLES
//
// El ÚNICO que hereda de RepositorioEliminable: el entregable es el único
// registro del sistema que se borra de verdad. Los otros cinco repositorios
// ni siquiera tienen el método (ISP).
export class EntregableRepositorio extends RepositorioEliminable {
    constructor(db) {
        super(db, 'entregables')
    }

    async listarPorProyecto(proyectoId, contexto) {
        return this.coleccion
            .find({ proyectoId }, { session: contexto })
            .sort({ fechaLimite: 1 })
            .toArray()
    }

    /**
     * Vencidos: pasó la fecha y el entregable aún no ha llegado a un estado
     * que cuente como terminado. Qué estados cuentan lo deciden las clases
     * de estado, no una lista escrita a mano aquí.
     */
    async listarVencidos() {
        const terminados = EstadoEntregable.claves().filter((clave) =>
            EstadoEntregable.desde(clave).cuentaParaAvance(),
        )

        return this.coleccion
            .find({
                fechaLimite: { $lt: new Date() },
                estado: { $nin: terminados },
            })
            .sort({ fechaLimite: 1 })
            .toArray()
    }

    async agregarAlHistorial(id, entrada, contexto) {
        await this.coleccion.updateOne(
            { _id: RepositorioLectura.normalizarId(id) },
            { $push: { historial: entrada } },
            { session: contexto },
        )
    }

    async crearIndices() {
        await this.prepararColeccion(Entregable.esquemaMongo())
        await this.coleccion.createIndex({ proyectoId: 1 })
        await this.coleccion.createIndex({ fechaLimite: 1 })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
