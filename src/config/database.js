import 'dotenv/config'
import { MongoClient } from 'mongodb'

// PATRÓN SINGLETON (GoF)
//
// La versión anterior tenía esto en el constructor:
//
//     if (Database.instancia) return Database.instancia
//
// ...pero la clase nunca se exportaba, así que nadie podía llamar a `new`
// y esa línea no se ejecutaba jamás. Era código muerto: lo que había de
// verdad era un módulo con una instancia, no el patrón.
//
// Este sí es el patrón: el constructor está cerrado y la ÚNICA forma de
// obtener la instancia es `Database.obtenerInstancia()`. Si alguien intenta
// `new Database()`, revienta con un mensaje que le dice qué hacer.
class Database {
    static #instancia = null
    static #construccionAutorizada = false

    constructor() {
        if (!Database.#construccionAutorizada) {
            throw new Error(
                'Database es un Singleton: no se instancia con new. ' +
                    'Usa Database.obtenerInstancia().',
            )
        }

        this.client = null
        this.db = null
        this.nombre = null
    }

    /** El único punto de acceso a la instancia. */
    static obtenerInstancia() {
        if (!Database.#instancia) {
            Database.#construccionAutorizada = true
            Database.#instancia = new Database()
            Database.#construccionAutorizada = false
        }
        return Database.#instancia
    }

    /**
     * Abre la conexión. Es idempotente: llamarla dos veces no abre dos clientes.
     *
     * Por qué importa que haya UNA sola conexión: una transacción vive dentro
     * de una sesión, y una sesión pertenece a un cliente. Con varios clientes
     * los repositorios no podrían compartir la misma transacción.
     */
    async conectar() {
        if (this.db) return this.db

        const uri = process.env.MONGODB_URI
        if (!uri) {
            throw new Error(
                'Falta MONGODB_URI. Copia .env.example a .env y pon ahí tu cadena de conexión.',
            )
        }

        const nombreBd = process.env.MONGODB_DB_V2 ?? process.env.MONGODB_DB
        if (!nombreBd) {
            throw new Error('Falta MONGODB_DB en el archivo .env: no sé a qué base conectarme.')
        }

        this.client = new MongoClient(uri)
        await this.client.connect()

        this.db = this.client.db(nombreBd)
        this.nombre = nombreBd

        return this.db
    }

    obtenerCliente() {
        return this.client
    }

    async cerrar() {
        if (!this.client) return
        await this.client.close()
        this.client = null
        this.db = null
    }
}

export { Database }

// La instancia compartida por toda la aplicación.
export const database = Database.obtenerInstancia()
