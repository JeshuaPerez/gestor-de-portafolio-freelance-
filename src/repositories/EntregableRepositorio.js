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

    /**
     * Mueve el estado y anota el cambio EN UNA SOLA ESCRITURA.
     *
     * Antes esto eran dos llamadas seguidas desde el servicio: un `actualizar`
     * con el estado nuevo y un `agregarAlHistorial` con el $push. El resultado
     * era correcto porque las dos iban dentro de la misma transacción, pero
     * eran dos viajes a la base de datos para tocar EL MISMO documento, y
     * dejaban un instante en el que el estado ya había cambiado y el historial
     * todavía no lo contaba.
     *
     * Un único updateOne con $set y $push es atómico por sí mismo, a nivel de
     * documento, incluso fuera de una transacción. El historial no puede
     * quedar desincronizado del estado que describe.
     */
    async registrarCambioEstado(id, estado, cambio, contexto) {
        try {
            const resultado = await this.coleccion.updateOne(
                { _id: RepositorioLectura.normalizarId(id) },
                {
                    $set: { estado, actualizadoEn: new Date() },
                    $push: { historial: cambio },
                },
                { session: contexto },
            )
            return resultado.matchedCount > 0
        } catch (error) {
            throw RepositorioLectura.traducirError(error)
        }
    }

    /**
     * El historial de un entregable, buscándolo por _id o por código.
     *
     * La proyección es deliberada: de todo el documento solo se piden los
     * cuatro campos que la consulta va a pintar. No hace falta índice nuevo
     * para esto — se entra por `_id` o por `codigo`, y los dos ya lo tienen.
     */
    async historialDe(referencia, contexto) {
        return this.buscarPorIdOCodigo(referencia, contexto, {
            codigo: 1,
            titulo: 1,
            estado: 1,
            historial: 1,
        })
    }

    async crearIndices() {
        await this.prepararColeccion(Entregable.esquemaMongo())
        await this.coleccion.createIndex({ proyectoId: 1 })
        await this.coleccion.createIndex({ fechaLimite: 1 })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
