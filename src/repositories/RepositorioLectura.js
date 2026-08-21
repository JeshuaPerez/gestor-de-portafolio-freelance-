import { ObjectId } from 'mongodb'
import { ConflictoError, ValidacionError } from '../errors/errores.js'

// PATRÓN REPOSITORY — NIVEL 1: SOLO LEER
//
// Esta división en tres niveles arregla una violación de ISP que había antes:
// `BaseRepositorio` daba `eliminar()` a los seis repositorios, incluido
// `ClienteRepositorio`, cuando la propia regla del negocio dice que un cliente
// NUNCA se borra (se desactiva). Heredar un método que tienes prohibido usar
// es justo lo que ISP quiere evitar.
//
//   RepositorioLectura     -> consultar
//   RepositorioEscritura   -> consultar + crear/actualizar
//   RepositorioEliminable  -> consultar + crear/actualizar + borrar
//
// Cada repositorio hereda solo lo que le corresponde poder hacer.

export class RepositorioLectura {
    constructor(db, nombreColeccion) {
        this.db = db
        this.nombreColeccion = nombreColeccion
        this.coleccion = db.collection(nombreColeccion)
    }

    static escaparRegex(texto) {
        return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /** Traduce los errores del driver a errores del dominio. */
    static traducirError(error) {
        // 121 = el documento no pasó el $jsonSchema de la colección.
        if (error?.code === 121) {
            return new ValidacionError(
                'La base de datos rechazó el documento: no cumple el esquema de la colección.',
                { causa: error },
            )
        }

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

        return new ConflictoError(`Ya existe un registro con ${queEs}${conValor}.`)
    }

    /**
     * Acepta un ObjectId o su texto y devuelve siempre un ObjectId.
     * Antes `actualizar` hacía `new ObjectId(id)` a pelo: si le llegaba un
     * código como "PRY-0001" reventaba con un error críptico del driver,
     * mientras que `buscarPorIdOCodigo` sí lo aceptaba. Dos métodos de la
     * misma clase con contratos distintos — un problema de sustitución.
     */
    static normalizarId(valor) {
        if (valor instanceof ObjectId) return valor
        if (ObjectId.isValid(valor)) return new ObjectId(valor)

        throw new ValidacionError(
            `"${valor}" no es un identificador interno válido. ` +
                'Para buscar por código usa buscarPorIdOCodigo().',
        )
    }

    async buscarPorId(id, contexto) {
        if (!ObjectId.isValid(id)) return null
        return this.coleccion.findOne({ _id: new ObjectId(id) }, { session: contexto })
    }

    async buscarPorIdOCodigo(valor, contexto) {
        if (valor === null || valor === undefined) return null

        if (typeof valor !== 'string') return this.buscarPorId(valor, contexto)

        const texto = valor.trim()
        if (!texto) return null

        // TRES LETRAS, UN GUION Y CUATRO DÍGITOS: CLI-0001, PRY-0012...
        if (/^[a-z]{3}-\d{4}$/i.test(texto)) {
            return this.coleccion.findOne({ codigo: texto.toUpperCase() }, { session: contexto })
        }

        return this.buscarPorId(texto, contexto)
    }

    async listar(filtro = {}, contexto, orden = { codigo: 1 }) {
        return this.coleccion.find(filtro, { session: contexto }).sort(orden).toArray()
    }

    async contar(filtro = {}) {
        return this.coleccion.countDocuments(filtro)
    }

    /**
     * Crea la colección si no existe y le aplica el validador de esquema.
     * Si ya existe, actualiza el validador con collMod: así el esquema se
     * mantiene al día sin tener que borrar la base de datos.
     */
    async prepararColeccion(esquema = null) {
        const existe = await this.db.listCollections({ name: this.nombreColeccion }).hasNext()

        if (!existe) {
            await this.db.createCollection(this.nombreColeccion, {
                ...(esquema ? { validator: esquema, validationLevel: 'moderate' } : {}),
            })
            return
        }

        if (esquema) {
            await this.db.command({
                collMod: this.nombreColeccion,
                validator: esquema,
                validationLevel: 'moderate',
            })
        }
    }
}
