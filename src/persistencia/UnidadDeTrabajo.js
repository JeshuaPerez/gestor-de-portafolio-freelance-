// PATRÓN UNIT OF WORK — y el arreglo del DIP
//
// El problema: los servicios recibían `mongoClient` y hacían esto ellos mismos:
//
//     const session = this.mongoClient.startSession()
//     try { await session.withTransaction(...) } finally { await session.endSession() }
//
// O sea: la capa de negocio sabía qué es una sesión de MongoDB, cómo se abre
// y cómo se cierra. Eso es exactamente lo que el principio de Inversión de
// Dependencias prohíbe — la política de alto nivel dependía del detalle.
//
// Ahora los servicios dependen de esta abstracción y solo dicen "haz esto de
// forma atómica". Quién lo haga (MongoDB, otra base, o nada en los tests) da
// igual: el servicio no cambia.

export class UnidadDeTrabajo {
    /**
     * Ejecuta `trabajo` de forma atómica: o pasa todo, o no pasa nada.
     * `trabajo` recibe un contexto opaco que debe pasar a los repositorios
     * sin mirarlo — para el servicio no significa nada.
     */
    async ejecutar() {
        throw new Error('ejecutar() debe implementarlo la unidad de trabajo concreta.')
    }
}

// IMPLEMENTACIÓN REAL: transacciones de MongoDB.
// Este es el ÚNICO archivo de todo el proyecto, fuera de /repositories, que
// sabe que la base de datos es MongoDB.
export class UnidadDeTrabajoMongo extends UnidadDeTrabajo {
    constructor(mongoClient) {
        super()
        this.mongoClient = mongoClient
    }

    async ejecutar(trabajo) {
        const session = this.mongoClient.startSession()

        try {
            let resultado = null
            await session.withTransaction(async () => {
                resultado = await trabajo(session)
            })
            return resultado
        } finally {
            await session.endSession()
        }
    }
}

// IMPLEMENTACIÓN DE PRUEBA: ejecuta sin transacción.
// Sirve para probar un servicio sin levantar un replica set.
export class UnidadDeTrabajoDirecta extends UnidadDeTrabajo {
    async ejecutar(trabajo) {
        return trabajo(undefined)
    }
}
