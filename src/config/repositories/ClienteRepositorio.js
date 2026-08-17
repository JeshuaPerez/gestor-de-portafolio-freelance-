import { BaseRepositorio } from './BaseRepositorio.js'

/**
 * PATRÓN REPOSITORY — clientes.
 *
 * Hereda el CRUD completo de BaseRepositorio (crear, buscarPorId, listar,
 * actualizar...). Aquí solo añadimos lo que es EXCLUSIVO de clientes.
 * Fíjate en lo corta que quedó la clase: eso es la herencia trabajando.
 */
export class ClienteRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'clientes') // `super` llama al constructor del padre
    }

    /** Necesario para la regla de "email único". */
    async buscarPorEmail(email, session) {
        return this.coleccion.findOne({ email: email.trim().toLowerCase() }, { session })
    }

    /**
     * Busca por nombre, empresa o email con coincidencia parcial.
     * $regex con la opción 'i' = no distingue mayúsculas de minúsculas.
     */
    async buscarPorTexto(texto) {
        // El texto se escapa antes de meterlo en $regex. Sin esto, buscar
        // "C++" o "(web)" reventaba la consulta, y buscar ".*" devolvía
        // todos los clientes. Ver BaseRepositorio.escaparRegex.
        const patron = BaseRepositorio.escaparRegex(texto)

        return this.coleccion
            .find({
                $or: [
                    { codigo: { $regex: patron, $options: 'i' } },
                    { nombre: { $regex: patron, $options: 'i' } },
                    { empresa: { $regex: patron, $options: 'i' } },
                    { email: { $regex: patron, $options: 'i' } },
                ],
            })
            .toArray()
    }

    /**
     * DOBLE DEFENSA contra emails duplicados: el servicio comprueba antes de
     * insertar, pero entre la comprobación y el insert podrían pasar
     * milisegundos. El índice único es la garantía real, porque la aplica
     * MongoDB, no nuestro código.
     */
    async crearIndices() {
        await this.prepararColeccion()
        await this.coleccion.createIndex({ email: 1 }, { unique: true })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
