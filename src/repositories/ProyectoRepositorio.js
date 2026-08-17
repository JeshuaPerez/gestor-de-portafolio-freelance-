import { ObjectId } from 'mongodb'
import { BaseRepositorio } from './BaseRepositorio.js'

export class ProyectoRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'proyectos')
    }

    async listarPorEstado(estado) {
        return this.coleccion.find({ estado }).sort({ codigo: 1 }).toArray()
    }

    /** ¿Esta propuesta ya generó un proyecto? Evita duplicados. */
    async buscarPorPropuesta(propuestaId, session) {
        return this.coleccion.findOne({ propuestaId }, { session })
    }

    /**
     * Suma (o resta) una cantidad a un acumulado del proyecto: `cobrado` o
     * `gastado`.
     *
     * ¿Por qué `$inc` y no leer, sumar en Node y volver a escribir?
     * Porque `$inc` es ATÓMICO: MongoDB hace la suma internamente. Si leyeras
     * y escribieras por separado, dos operaciones simultáneas podrían leer el
     * mismo valor y una pisaría a la otra. Con `$inc` eso no puede pasar.
     */
    async incrementarAcumulado(id, campo, cantidad, session) {
        await this.coleccion.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { [campo]: cantidad } },
            { session },
        )

        /*
         * SEGUNDO PASO: recortar a dos decimales.
         *
         * `$inc` suma con la aritmética de coma flotante, la misma que hace
         * que 0.1 + 0.2 dé 0.30000000000000004. Cada movimiento con centavos
         * deja un residuo minúsculo, y esos residuos se van acumulando.
         *
         * No es solo feo. `FinanzaService` calcula el saldo pendiente como
         * `monto - cobrado`; si `cobrado` arrastra basura, el pendiente sale
         * 0.000000001 en vez de 0 y el sistema RECHAZA el pago final exacto
         * diciendo que supera el saldo. El cliente no puede pagarte lo que
         * te debe.
         *
         * Este segundo update usa una TUBERÍA DE AGREGACIÓN (el array `[...]`
         * en vez de un objeto), que permite calcular a partir del valor
         * actual del propio documento. `$round` con 2 lo deja en centavos.
         *
         * Va con la misma `session`, así que forma parte de la transacción:
         * o se guardan la suma y el redondeo, o no se guarda ninguno.
         */
        await this.coleccion.updateOne(
            { _id: new ObjectId(id) },
            [{ $set: { [campo]: { $round: [`$${campo}`, 2] } } }],
            { session },
        )
    }

    async crearIndices() {
        await this.prepararColeccion()
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
        // REGLA A NIVEL DE BASE DE DATOS: una propuesta no puede generar dos
        // proyectos. Aunque nuestro código fallara, MongoDB lo impediría.
        await this.coleccion.createIndex({ propuestaId: 1 }, { unique: true })
    }
}
