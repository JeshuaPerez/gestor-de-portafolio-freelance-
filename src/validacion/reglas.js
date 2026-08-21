import { ObjectId } from 'mongodb'
import { ValidacionError } from '../errors/errores.js'

// MOTOR DE VALIDACIÓN — UNA SOLA FUENTE DE VERDAD
//
// El problema que resuelve: "el título tiene mínimo 3 caracteres" estaba
// escrito en tres sitios (el modelo, el servicio y la pregunta de la consola).
// Cambiar la regla obligaba a acordarse de los tres.
//
// Ahora cada modelo declara sus REGLAS una vez, y de esa misma declaración
// salen las tres cosas:
//
//   validarContra()      -> la validación en memoria (modelos y servicios)
//   aEsquemaMongo()      -> el $jsonSchema que valida en la base de datos
//   aOpcionesDeEntrada() -> los límites que la consola le enseña al usuario
//
// Añadir una restricción es tocar UNA línea.

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const vacio = (valor) => valor === null || valor === undefined || valor === ''

// Cada tipo sabe comprobarse a sí mismo y describirse para Mongo.
const TIPOS = {
    texto: {
        comprobar(valor, regla) {
            if (typeof valor !== 'string') return 'tiene que ser texto'
            const limpio = valor.trim()
            if (regla.min && limpio.length < regla.min) {
                return `necesita al menos ${regla.min} caracteres (tiene ${limpio.length})`
            }
            if (regla.max && limpio.length > regla.max) {
                return `no puede pasar de ${regla.max} caracteres (tiene ${limpio.length})`
            }
            return null
        },
        bson: (regla) => ({
            bsonType: 'string',
            ...(regla.min ? { minLength: regla.min } : {}),
            ...(regla.max ? { maxLength: regla.max } : {}),
        }),
    },

    email: {
        comprobar(valor) {
            if (typeof valor !== 'string') return 'tiene que ser texto'
            if (!FORMATO_EMAIL.test(valor.trim())) {
                return 'no tiene un formato válido (tiene que ser algo@algo.algo)'
            }
            return null
        },
        // OJO: aquí el patrón es un STRING, no un regex literal, así que las
        // barras van dobladas. Si se escribe '\s' el motor lee una "s" suelta
        // y el esquema acabaría rechazando cualquier email que lleve esa letra.
        bson: () => ({ bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }),
    },

    telefono: {
        comprobar(valor, regla) {
            const digitos = String(valor).replace(/\D/g, '').length
            const min = regla.minimoDigitos ?? 7
            if (digitos < min) return `necesita al menos ${min} dígitos (tiene ${digitos})`
            return null
        },
        bson: () => ({ bsonType: 'string' }),
    },

    numero: {
        comprobar(valor, regla) {
            const n = Number(valor)
            if (!Number.isFinite(n)) return 'tiene que ser un número'
            if (regla.entero && !Number.isInteger(n)) return 'tiene que ser un número entero'
            if (regla.min !== undefined && n < regla.min) return `tiene que ser ${regla.min} o más`
            if (regla.max !== undefined && n > regla.max) return `tiene que ser ${regla.max} o menos`
            return null
        },
        bson: (regla) => ({
            // OJO: el driver guarda todo Number de JS como double. Si aqui
            // exigieramos 'int' para los enteros, Mongo rechazaria valores
            // correctos. El "es entero" se comprueba en memoria.
            bsonType: ['double', 'int', 'long', 'decimal'],
            ...(regla.min !== undefined ? { minimum: regla.min } : {}),
            ...(regla.max !== undefined ? { maximum: regla.max } : {}),
        }),
    },

    fecha: {
        comprobar(valor) {
            const fecha = valor instanceof Date ? valor : new Date(valor)
            if (Number.isNaN(fecha.getTime())) return 'no es una fecha válida (usa AAAA-MM-DD)'
            return null
        },
        bson: () => ({ bsonType: 'date' }),
    },

    lista: {
        comprobar(valor, regla) {
            if (!regla.valores.includes(valor)) {
                return `tiene que ser uno de: ${regla.valores.join(', ')}`
            }
            return null
        },
        bson: (regla) => ({ enum: regla.opcional ? [...regla.valores, null] : [...regla.valores] }),
    },

    id: {
        comprobar(valor) {
            if (valor instanceof ObjectId) return null
            if (typeof valor === 'string' && ObjectId.isValid(valor)) return null
            return 'no es una referencia válida'
        },
        bson: () => ({ bsonType: 'objectId' }),
    },

    booleano: {
        comprobar(valor) {
            return typeof valor === 'boolean' ? null : 'tiene que ser verdadero o falso'
        },
        bson: () => ({ bsonType: 'bool' }),
    },

    // Para campos que guardamos pero no restringimos (motivos libres).
    libre: {
        comprobar: () => null,
        bson: () => ({}),
    },

    // ARRAY DE SUBDOCUMENTOS — p. ej. el historial de estados del entregable.
    //
    // Antes el historial era `libre`, y `libre` no genera esquema: MongoDB
    // aceptaba cualquier cosa dentro del array. Este tipo cierra ese hueco
    // sin romper la idea de partida — la forma del subdocumento se declara
    // UNA vez, en las REGLAS del modelo que lo representa, y de ahí salen
    // tanto la comprobación en memoria como el `items` del $jsonSchema.
    subdocumentos: {
        comprobar(valor, regla) {
            if (!Array.isArray(valor)) return 'tiene que ser una lista'

            for (const [posicion, elemento] of valor.entries()) {
                try {
                    validarContra(elemento, regla.elemento, regla.etiqueta)
                } catch (error) {
                    // Se nombra la posición: en una lista de veinte entradas,
                    // "una entrada inválida" no le sirve a nadie.
                    return `tiene una entrada inválida en la posición ${posicion + 1} (${error.message})`
                }
            }

            return null
        },
        bson: (regla) => ({
            bsonType: 'array',
            items: aEsquemaMongo(regla.elemento).$jsonSchema,
        }),
    },
}

/**
 * Recorre las reglas y acumula TODOS los fallos antes de lanzar.
 * Así el usuario ve de una vez todo lo que tiene mal, no de uno en uno.
 */
export function validarContra(datos, reglas, entidad = 'registro') {
    const detalles = []

    for (const [campo, regla] of Object.entries(reglas)) {
        const valor = datos[campo]
        const etiqueta = regla.etiqueta ?? campo

        if (vacio(valor)) {
            // `obligatorio: true` es lo normal; hay que declarar `opcional` para saltarlo.
            // `asignadoAlGuardar` son los campos que pone el repositorio justo
            // antes de insertar (el codigo consecutivo): en memoria todavia no
            // existen, pero en la base de datos son obligatorios.
            if (!regla.opcional && !regla.asignadoAlGuardar) {
                detalles.push({ campo, mensaje: `"${etiqueta}" es obligatorio` })
            }
            continue
        }

        const tipo = TIPOS[regla.tipo]
        if (!tipo) throw new Error(`Tipo de regla desconocido: "${regla.tipo}" en ${campo}.`)

        const fallo = tipo.comprobar(valor, regla)
        if (fallo) detalles.push({ campo, mensaje: `"${etiqueta}" ${fallo}` })
    }

    if (detalles.length > 0) throw ValidacionError.desdeLista(entidad, detalles)
}

/**
 * Traduce las mismas reglas al validador nativo de MongoDB.
 * La base de datos deja de aceptar basura aunque alguien escriba por fuera de la app.
 */
export function aEsquemaMongo(reglas) {
    const propiedades = {}
    const obligatorios = []

    for (const [campo, regla] of Object.entries(reglas)) {
        if (regla.tipo === 'libre') continue

        const descripcion = TIPOS[regla.tipo].bson(regla)

        if (regla.opcional) {
            // Un campo opcional puede llegar como null: hay que permitirlo.
            if (descripcion.enum) {
                propiedades[campo] = descripcion
            } else {
                const tipos = [].concat(descripcion.bsonType, 'null')
                propiedades[campo] = { ...descripcion, bsonType: tipos }
            }
        } else {
            propiedades[campo] = descripcion
            obligatorios.push(campo)
        }
    }

    return {
        $jsonSchema: {
            bsonType: 'object',
            ...(obligatorios.length ? { required: obligatorios } : {}),
            properties: propiedades,
        },
    }
}

/**
 * Traduce una regla a las opciones que entienden `pedirTexto`, `pedirNumero`...
 * La consola deja de repetir los límites a mano.
 */
export function aOpcionesDeEntrada(regla, extra = {}) {
    return {
        min: regla.min,
        max: regla.max,
        entero: regla.entero,
        opcional: Boolean(regla.opcional),
        minimoDigitos: regla.minimoDigitos,
        ...extra,
    }
}
