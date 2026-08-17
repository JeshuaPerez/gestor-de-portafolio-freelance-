import { ObjectId } from 'mongodb'

/**
 * CLASE PADRE de todos los repositorios (HERENCIA).
 *
 * ¿Por qué existe? Porque clientes, propuestas y proyectos necesitan
 * exactamente el mismo CRUD: crear, buscar por id, listar, actualizar.
 * Escribirlo tres veces sería copiar y pegar. Lo escribimos UNA vez aquí y
 * los demás lo heredan con `extends`.
 *
 * OCP (la O de SOLID, Abierto/Cerrado): esta clase no se modifica nunca.
 * Cuando un repositorio necesita algo especial (buscar por email, por
 * ejemplo), lo AÑADE en su propia clase. Extendemos sin tocar lo que ya
 * funciona.
 *
 * ---------------------------------------------------------------------
 * EL PARÁMETRO `session`
 * ---------------------------------------------------------------------
 * Todos los métodos aceptan una `session` opcional al final. Es la pieza
 * clave de las transacciones: si dos operaciones reciben la MISMA sesión,
 * MongoDB las trata como una sola unidad (o se guardan las dos, o ninguna).
 * Si no se pasa nada, la operación se ejecuta suelta, como siempre.
 */
export class BaseRepositorio {
    constructor(db, nombreColeccion) {
        this.db = db
        this.nombreColeccion = nombreColeccion
        this.coleccion = db.collection(nombreColeccion)
    }

    /**
     * Escapa los caracteres que tienen significado especial en una expresión
     * regular, para poder buscar texto que el usuario escribió.
     *
     * EL PROBLEMA: `$regex` interpreta el texto como patrón, no como texto.
     * Si alguien busca "C++" o "Diseño (web)", esos símbolos son órdenes
     * para el motor de expresiones regulares y MongoDB responde con
     * "Regular expression is invalid". La búsqueda revienta por escribir un
     * paréntesis.
     *
     * Y al revés: buscar ".*" devolvía TODOS los registros, porque ".*"
     * significa "cualquier cosa". El usuario cree que busca un texto y en
     * realidad está programando el buscador sin querer.
     *
     * Poniendo una barra invertida delante de cada símbolo especial, el
     * texto vuelve a ser texto.
     */
    static escaparRegex(texto) {
        return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Traduce los errores de MongoDB que el usuario puede provocar.
     *
     * Cuando salta un índice único, MongoDB devuelve algo así:
     *
     *   E11000 duplicate key error collection: freelance.clientes
     *   index: email_1 dup key: { email: "ana@correo.com" }
     *
     * Eso es perfecto para un programador y espantoso para quien está
     * usando el programa. Aquí lo convertimos en una frase normal.
     *
     * Es la contrapartida de la DOBLE DEFENSA: los servicios comprueban
     * antes de escribir y dan buenos mensajes, pero el índice es la
     * garantía de verdad y también puede saltar (por ejemplo si dos
     * personas graban a la vez). Cuando salta, tiene que explicarse igual
     * de bien.
     */
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
            // `throw` con el error traducido: si no era un duplicado,
            // `traducirError` devuelve el mismo error sin tocarlo.
            throw BaseRepositorio.traducirError(error)
        }
    }

    async buscarPorId(id, session) {
        // Si el texto no es un ObjectId válido, `new ObjectId(id)` lanzaría
        // una excepción fea. Lo comprobamos antes y devolvemos null.
        if (!ObjectId.isValid(id)) return null
        return this.coleccion.findOne({ _id: new ObjectId(id) }, { session })
    }

    /**
     * Busca aceptando LAS DOS FORMAS de identificar un registro:
     *
     *     68a1f4c2b3d4e5f6a7b8c9d0   <- el _id de MongoDB
     *     CLI-0001                   <- el código legible
     *
     * ¿Por qué? Porque el _id lo necesita la máquina, pero es imposible de
     * recordar o de dictar por teléfono. El código sí. Aceptando ambos, el
     * usuario nunca tiene que ver un ObjectId, y el programa sigue pudiendo
     * usarlos internamente.
     *
     * El orden importa: miramos primero si tiene pinta de código, porque
     * `ObjectId.isValid()` devuelve true también para cualquier texto de 12
     * caracteres y podría "secuestrar" un código.
     */
    async buscarPorIdOCodigo(valor, session) {
        if (valor === null || valor === undefined) return null

        /*
         * OJO: aquí no siempre llega texto.
         *
         * Cuando el usuario elige de una lista, el menú nos pasa `x._id`, que
         * es un objeto ObjectId, no una cadena. Si lo descartáramos por no ser
         * texto, TODOS los menús dirían "no existe" justo después de que el
         * usuario eligiera de la lista.
         */
        if (typeof valor !== 'string') return this.buscarPorId(valor, session)

        const texto = valor.trim()
        if (!texto) return null

        // Tres letras, un guion y cuatro dígitos: CLI-0001, PRY-0012...
        if (/^[a-z]{3}-\d{4}$/i.test(texto)) {
            return this.coleccion.findOne({ codigo: texto.toUpperCase() }, { session })
        }

        return this.buscarPorId(texto, session)
    }

    /**
     * Lista registros ordenados por su código: CLI-0001, CLI-0002, CLI-0003…
     *
     * POR QUÉ POR CÓDIGO Y NO POR FECHA DE CREACIÓN, que es lo que hacía
     * antes: ordenar por fecha descendente pone lo más nuevo arriba, y
     * entonces el listado de clientes empieza en CLI-0007 y termina en
     * CLI-0001. Para un historial de movimientos eso está bien —lo último
     * es lo que interesa—, pero un listado de clientes o de proyectos se
     * lee como un directorio, y en un directorio uno espera el orden
     * natural.
     *
     * Funciona con una comparación de texto porque los códigos llevan los
     * ceros delante: "CLI-0002" va después de "CLI-0001" alfabéticamente.
     * Sin esos ceros, "CLI-10" quedaría antes que "CLI-2".
     *
     * El parámetro `orden` permite que un repositorio pida otra cosa: los
     * movimientos siguen ordenándose por fecha, y los entregables por su
     * fecha límite, porque ahí sí importa el tiempo.
     */
    async listar(filtro = {}, session, orden = { codigo: 1 }) {
        return this.coleccion.find(filtro, { session }).sort(orden).toArray()
    }

    /** Devuelve true si encontró el documento; false si el ID no existe. */
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

    /**
     * Genera códigos consecutivos: PRO-0001, PRO-0002, PRY-0001...
     *
     * Usa una colección `contadores` con `$inc`. ¿Por qué no contar los
     * documentos existentes y sumar 1? Porque si borras la propuesta 3, el
     * contador retrocedería y el siguiente código chocaría con uno ya usado.
     * `$inc` es atómico y nunca retrocede.
     */
    async siguienteCodigo(prefijo, session) {
        const resultado = await this.db.collection('contadores').findOneAndUpdate(
            { _id: prefijo },
            { $inc: { secuencia: 1 } },
            { upsert: true, returnDocument: 'after', session },
        )
        // El driver 6.x devuelve el documento directo; versiones antiguas lo
        // envuelven en `.value`. Aceptamos las dos formas.
        const numero = resultado?.secuencia ?? resultado?.value?.secuencia ?? 1
        return `${prefijo}-${String(numero).padStart(4, '0')}`
    }

    /**
     * Crea la colección si aún no existe.
     *
     * ERROR COMÚN: una transacción no puede crear colecciones en versiones
     * antiguas de MongoDB, y falla con un mensaje confuso. Creándolas al
     * arrancar nos quitamos el problema de encima.
     */
    async prepararColeccion() {
        const existe = await this.db.listCollections({ name: this.nombreColeccion }).hasNext()
        if (!existe) await this.db.createCollection(this.nombreColeccion)
    }
}
