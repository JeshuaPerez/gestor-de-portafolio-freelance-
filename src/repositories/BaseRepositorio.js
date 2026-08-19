import { ObjectId } from 'mongodb'

export class BaseRepositorio {
    constructor(db, nombreColeccion) {
        this.db = db
        this.nombreColeccion = nombreColeccion
        this.coleccion = db.collection(nombreColeccion)
    }

    static escaparRegex(texto) {
        return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    static traducirError(error) {
        if (error?.code !== 11000) return error

        const campo = Object.keys(error.keyPattern ?? {})[0]
        const valor = error.keyValue?.[campo]

        const nombres = {
            email: 'el email',
            codigo: 'el código',
            referencia: 'la referencia',
            proyectoId: 'ese proyecto (ya tiene contrato)',
            propuestaId: 'esa propuesta (ya generó un proyecto)',
        }

        const queEs = nombres[campo] ?? `el campo ${campo}`
        const conValor = valor !== undefined ? ` "${valor}"` : ''

        return new Error(`Ya existe un registro con ${queEs}${conValor}.`)
    }

    async crear(documento, session) {
        try {
            const resultado = await this.coleccion.insertOne(documento, { session })
            return resultado.insertedId
        } catch (error) {
            throw BaseRepositorio.traducirError(error)
        }
    }

    async buscarPorId(id, session) {
        if (!ObjectId.isValid(id)) return null
        return this.coleccion.findOne({ _id: new ObjectId(id) }, { session })
    }

    async buscarPorIdOCodigo(valor, session) {
        if (valor === null || valor === undefined) return null

        if (typeof valor !== 'string') return this.buscarPorId(valor, session)

        const texto = valor.trim()
        if (!texto) return null

        // TRES LETRAS, UN GUION Y CUATRO DÍGITOS: CLI-0001, PRY-0012...
        if (/^[a-z]{3}-\d{4}$/i.test(texto)) {
            return this.coleccion.findOne({ codigo: texto.toUpperCase() }, { session })
        }

        return this.buscarPorId(texto, session)
    }

    async listar(filtro = {}, session, orden = { codigo: 1 }) {
        return this.coleccion.find(filtro, { session }).sort(orden).toArray()
    }

     // DEVUELVE TRUE SI ENCONTRÓ EL DOCUMENTO; FALSE SI EL ID NO EXISTE.
    async actualizar(id, cambios, session) {
        try {
            const resultado = await this.coleccion.updateOne(
                { _id: new ObjectId(id) },
                { $set: cambios },
                { session },
            )
            return resultado.matchedCount > 0
        } catch (error) {
            throw BaseRepositorio.traducirError(error)
        }
    }

    async eliminar(id, session) {
        const resultado = await this.coleccion.deleteOne({ _id: new ObjectId(id) }, { session })
        return resultado.deletedCount > 0
    }

    async contar(filtro = {}) {
        return this.coleccion.countDocuments(filtro)
    }

    async siguienteCodigo(prefijo, session) {
        const resultado = await this.db.collection('contadores').findOneAndUpdate(
            { _id: prefijo },
            { $inc: { secuencia: 1 } },
            { upsert: true, returnDocument: 'after', session },
        )
       
        const numero = resultado?.secuencia ?? resultado?.value?.secuencia ?? 1
        return `${prefijo}-${String(numero).padStart(4, '0')}`
    }

    async prepararColeccion() {
        const existe = await this.db.listCollections({ name: this.nombreColeccion }).hasNext()
        if (!existe) await this.db.createCollection(this.nombreColeccion)
    }
}
