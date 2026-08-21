import { RepositorioLectura } from './RepositorioLectura.js'

// PATRÓN REPOSITORY — NIVEL 2: LEER Y ESCRIBIR (sin borrar)
//
// Lo heredan los cinco repositorios cuyos registros NUNCA se borran de verdad:
// clientes (se desactivan), propuestas (se rechazan), proyectos (se cancelan),
// contratos (se cancelan) y movimientos (se anulan).
export class RepositorioEscritura extends RepositorioLectura {
    async crear(documento, contexto) {
        try {
            const resultado = await this.coleccion.insertOne(documento, { session: contexto })
            return resultado.insertedId
        } catch (error) {
            throw RepositorioLectura.traducirError(error)
        }
    }

    // DEVUELVE TRUE SI ENCONTRÓ EL DOCUMENTO; FALSE SI EL ID NO EXISTE.
    async actualizar(id, cambios, contexto) {
        try {
            const resultado = await this.coleccion.updateOne(
                { _id: RepositorioLectura.normalizarId(id) },
                { $set: cambios },
                { session: contexto },
            )
            return resultado.matchedCount > 0
        } catch (error) {
            throw RepositorioLectura.traducirError(error)
        }
    }

    // CONTADOR ATÓMICO: de aquí salen CLI-0001, PRY-0012...
    async siguienteCodigo(prefijo, contexto) {
        const resultado = await this.db.collection('contadores').findOneAndUpdate(
            { _id: prefijo },
            { $inc: { secuencia: 1 } },
            { upsert: true, returnDocument: 'after', session: contexto },
        )

        const numero = resultado?.secuencia ?? resultado?.value?.secuencia ?? 1
        return `${prefijo}-${String(numero).padStart(4, '0')}`
    }
}
