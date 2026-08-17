import { MongoClient } from 'mongodb'
import 'dotenv/config'

/**
 * PATRÓN SINGLETON
 *
 * Problema que resuelve: abrir una conexión a MongoDB es caro. Si cada
 * archivo hiciera `new MongoClient(...)`, tendríamos 10 conexiones abiertas
 * y las transacciones no funcionarían (una transacción vive dentro de UNA
 * conexión).
 *
 * Solución: esta clase garantiza que solo exista UNA instancia. La guardamos
 * en la propiedad estática `instancia`. Si alguien pide otra, devolvemos la
 * misma que ya existe.
 *
 * En tu app.js hacías esto con una constante global:
 *     const client = new MongoClient(dbConectionString)
 * Funciona igual, pero aquí nadie puede crear una segunda por accidente.
 */
class Database {
    static instancia = null

    constructor() {
        // Si ya existe una instancia, devolvemos esa en vez de crear otra.
        if (Database.instancia) return Database.instancia

        this.client = new MongoClient(process.env.MONGODB_URI)
        this.db = null
        Database.instancia = this
    }

    /** Abre la conexión. Solo hace falta llamarlo una vez, al arrancar. */
    async conectar() {
        if (this.db) return this.db // ya estaba conectado

        await this.client.connect()

        /*
         * Esta versión usa su PROPIA base de datos, separada de la del
         * proyecto original. Comparten el mismo cluster (el MONGODB_URI es
         * el mismo), pero no las mismas colecciones.
         *
         * Si no lo separáramos, las dos aplicaciones intentarían crear los
         * mismos índices con nombres distintos y MongoDB lo rechazaría
         * ("Index already exists with a different name"). Además veríamos
         * aquí documentos de la otra versión, con otros campos.
         *
         * El `??` es el operador de fusión de nulos: usa MONGODB_DB_V2 y,
         * solo si no está definida, cae en MONGODB_DB. Así el proyecto
         * sigue arrancando aunque falte la variable nueva.
         */
        const nombreBd = process.env.MONGODB_DB_V2 ?? process.env.MONGODB_DB
        this.db = this.client.db(nombreBd)
        this.nombre = nombreBd

        // Fíjate en que esta clase ya NO imprime nada.
        // Antes hacía un console.log aquí mismo, y eso le daba dos trabajos:
        // conectarse Y contarlo. Ahora solo se conecta; quien quiera avisar
        // al usuario que lo haga desde arriba (index.js lo hace con `ora`).
        // Es la S de SOLID otra vez, en un detalle pequeño.
        return this.db
    }

    /** Devuelve el cliente. Lo necesitamos para abrir sesiones/transacciones. */
    obtenerCliente() {
        return this.client
    }

    async cerrar() {
        await this.client.close()
    }
}

// Exportamos la instancia ya creada: todo el proyecto importa este mismo objeto.
export const database = new Database()
