import { MongoClient } from 'mongodb'
import 'dotenv/config'


//  PATRÓN SINGLETON

class Database {
    static instancia = null

    constructor() {
        // Si ya existe una instancia, devolvemos esa en vez de crear otra.
        if (Database.instancia) return Database.instancia

        this.client = new MongoClient(process.env.MONGODB_URI)
        this.db = null
        Database.instancia = this
    }

    //ABRE LA CONEXIÓN. SOLO HACE FALTA LLAMARLO UNA VEZ, AL ARRANCAR.
    async conectar() {
        if (this.db) return this.db 

        await this.client.connect()

        const nombreBd = process.env.MONGODB_DB_V2 ?? process.env.MONGODB_DB
        this.db = this.client.db(nombreBd)
        this.nombre = nombreBd

        return this.db
    }

    obtenerCliente() {
        return this.client
    }

    async cerrar() {
        await this.client.close()
    }
}

// EXPORTAMOS LA INSTANCIA YA CREADA: TODO EL PROYECTO IMPORTA ESTE MISMO OBJETO.
export const database = new Database()
