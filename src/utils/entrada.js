import inquirer from 'inquirer'
import { OperacionCancelada } from '../errors/errores.js'
import { aOpcionesDeEntrada } from '../validacion/reglas.js'
import { estilo } from './estilo.js'

// ENTRADA DE DATOS - preguntas al usuario y validacion de lo que escribe
const PALABRA_CANCELAR = 'cancelar'

// Se reexporta para que los menus la sigan importando de aqui, pero la clase
// vive con el resto de errores del dominio.
export { OperacionCancelada }

// AVISO DE CÓMO CANCELAR
export const AVISO_CANCELAR = estilo.tenue(
    `  (escribe "${PALABRA_CANCELAR}" en cualquier momento para abortar)`,
)

// PREGUNTADOR DE INQUIRER
let preguntador = inquirer.createPromptModule()

/** Solo para las pruebas: hace que inquirer lea y escriba donde le digamos. */
export function usarStreams({ input, output }) {
    preguntador = inquirer.createPromptModule({ input, output })
}

/** Construye la etiqueta con sus pistas: "Monto (ej. 1500000):" */
function construirEtiqueta(texto, pistas) {
    const utiles = pistas.filter(Boolean)
    return utiles.length === 0 ? texto : `${texto} ${estilo.tenue(`(${utiles.join(', ')})`)}`
}

/** ¿El usuario escribió la palabra de cancelar? */
function esCancelar(valor) {
    return String(valor).trim().toLowerCase() === PALABRA_CANCELAR
}

// PREGUNTA CORTA
async function preguntarTexto(config) {
    const { actual, ...resto } = config
    config = actual === null || actual === undefined ? resto : { ...resto, default: String(actual) }
    const { valor } = await preguntador([
        {
            type: 'input',
            name: 'valor',
            // `filter` limpia ANTES de validar: así " ana " y "ana" son lo mismo.
            filter: (v) => String(v).trim(),
            ...config,
            // La validación de quien llama, pero dejando pasar "cancelar".
            validate: (v) => (esCancelar(v) ? true : config.validate(v)),
        },
    ])

    if (esCancelar(valor)) throw new OperacionCancelada()
    return valor
}

// TEXTO
export async function pedirTexto(texto, opciones = {}) {
    const { min = 1, max = 200, opcional = false, ejemplo = null, actual = null } = opciones

    const valor = await preguntarTexto({
        actual,
        message: construirEtiqueta(texto, [
            opcional ? 'opcional' : null,
            ejemplo ? `ej. ${ejemplo}` : null,
            min > 1 ? `mín. ${min} caracteres` : null,
        ]),
        validate: (v) => {
            if (!v) return opcional ? true : 'Este dato es obligatorio.'
            if (v.length < min) return `Escribe al menos ${min} caracteres (llevas ${v.length}).`
            if (v.length > max) return `Máximo ${max} caracteres (llevas ${v.length}).`
            return true
        },
    })

    return valor === '' ? null : valor
}

// EMAIL
export async function pedirEmail(texto, opciones = {}) {
    const { opcional = false, actual = null } = opciones
    const formato = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const valor = await preguntarTexto({
        actual,
        message: construirEtiqueta(texto, [
            opcional ? 'opcional' : null,
            'ej. ana@correo.com',
        ]),
        validate: (v) => {
            if (!v) return opcional ? true : 'Este dato es obligatorio.'
            if (!formato.test(v)) return `"${v}" no es un email válido. Tiene que ser algo@algo.algo`
            return true
        },
    })

    return valor === '' ? null : valor.toLowerCase()
}

// TELEFONO
export async function pedirTelefono(texto, opciones = {}) {
    const { opcional = false, minimoDigitos = 8, actual = null } = opciones

    const valor = await preguntarTexto({
        actual,
        message: construirEtiqueta(texto, [opcional ? 'opcional' : null, 'ej. 5512 3456']),
        validate: (v) => {
            if (!v) return opcional ? true : 'Este dato es obligatorio.'
            // \D = "todo lo que no sea un dígito". Lo quitamos y contamos.
            const digitos = v.replace(/\D/g, '').length
            if (digitos < minimoDigitos) {
                return `Un teléfono necesita al menos ${minimoDigitos} dígitos (contaste ${digitos}).`
            }
            return true
        },
    })

    return valor === '' ? null : valor
}

// NUMERO
export async function pedirNumero(texto, opciones = {}) {
    const {
        min = null,
        max = null,
        entero = false,
        opcional = false,
        ejemplo = null,
        actual = null,
    } = opciones

    // Describimos el rango en la propia pregunta: el usuario no adivina.
    let rango = null
    if (min !== null && max !== null) rango = `entre ${min} y ${max}`
    else if (min !== null) rango = `mínimo ${min}`
    else if (max !== null) rango = `máximo ${max}`

    const aNumero = (v) => Number(String(v).replace(/[\s,]/g, ''))

    const valor = await preguntarTexto({
        actual,
        message: construirEtiqueta(texto, [
            opcional ? 'opcional' : null,
            entero ? 'número entero' : 'número',
            rango,
            ejemplo ? `ej. ${ejemplo}` : null,
        ]),
        validate: (v) => {
            if (!v) return opcional ? true : 'Este dato es obligatorio.'

            const n = aNumero(v)

            if (!Number.isFinite(n)) return `"${v}" no es un número.`
            if (entero && !Number.isInteger(n)) return 'Tiene que ser un número entero.'
            if (min !== null && n < min) return `Tiene que ser ${min} o más.`
            if (max !== null && n > max) return `Tiene que ser ${max} o menos.`
            return true
        },
    })

    return valor === '' ? null : aNumero(valor)
}

// FECHA
export async function pedirFecha(texto, opciones = {}) {
    const { opcional = false, futura = false, actual = null } = opciones

    const existeEnElCalendario = (texto) => {
        const [anio, mes, dia] = texto.split('-').map(Number)
        const fecha = new Date(anio, mes - 1, dia)
        return (
            fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
        )
    }

    const valor = await preguntarTexto({
        actual,
        message: construirEtiqueta(texto, [
            opcional ? 'opcional' : null,
            'AAAA-MM-DD',
            `ej. ${new Date().getFullYear()}-12-31`,
        ]),
        validate: (v) => {
            if (!v) return opcional ? true : 'Este dato es obligatorio.'
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                return 'El formato tiene que ser AAAA-MM-DD. Ejemplo: 2026-03-15.'
            }
            if (!existeEnElCalendario(v)) return `El día ${v} no existe en el calendario.`
            if (futura && new Date(`${v}T00:00:00`) < new Date(new Date().toDateString())) {
                return 'La fecha no puede estar en el pasado.'
            }
            return true
        },
    })

    return valor === '' ? null : valor
}

// LISTA CERRADA
export async function pedirOpcion(texto, valores) {
    const { valor } = await preguntador([
        {
            type: 'list',
            name: 'valor',
            message: texto,
            choices: [
                ...valores.map((v) => ({ name: v, value: v })),
                new inquirer.Separator(),
                { name: estilo.tenue('Cancelar'), value: Symbol.for('cancelar') },
            ],
        },
    ])

    if (valor === Symbol.for('cancelar')) throw new OperacionCancelada()
    return valor
}

// CONFIRMACION
export async function confirmar(texto, opciones = {}) {
    const { porDefecto = false } = opciones

    const { valor } = await preguntador([
        {
            type: 'confirm',
            name: 'valor',
            message: texto,
            // Lo destructivo empieza en "no": si el usuario aporrea Enter sin
            // leer, no pasa nada malo.
            default: porDefecto,
        },
    ])

    return valor
}

// ELEGIR UN REGISTRO DE UNA LISTA
export async function elegirDeLista(items, opciones = {}) {
    const {
        etiqueta = 'Elige una opción',
        describir = (item) => String(item),
        siVacio = 'No hay registros para elegir.',
    } = opciones

    if (items.length === 0) throw new Error(siVacio)

    const { valor } = await preguntador([
        {
            type: 'list',
            name: 'valor',
            message: etiqueta,
            pageSize: 15, // si hay más, inquirer hace scroll solo
            choices: [
                ...items.map((item) => ({ name: describir(item), value: item })),
                new inquirer.Separator(),
                { name: estilo.tenue('Cancelar'), value: Symbol.for('cancelar') },
            ],
        },
    ])

    if (valor === Symbol.for('cancelar')) throw new OperacionCancelada()
    return valor
}

// MENU DE ACCIONES
export async function elegirAccion(titulo, acciones) {
    const { valor } = await preguntador([
        {
            type: 'list',
            name: 'valor',
            message: estilo.titulo(titulo),
            pageSize: 15,
            loop: false,
            choices: acciones.map((a) =>
                a.separador ? new inquirer.Separator() : { name: a.nombre, value: a.valor },
            ),
        },
    ])

    return valor
}

// ---------------------------------------------------------------------------
// PUENTE ENTRE LAS REGLAS DEL MODELO Y LAS PREGUNTAS DE LA CONSOLA
//
// Antes los limites se repetian a mano en cada menu:
//
//     await pedirTexto('Titulo', { min: 3 })      <- y el modelo decia 3 tambien
//
// Si el modelo cambiaba a 5, la consola seguia aceptando 3 y el error saltaba
// despues, ya en el servicio. Ahora la pregunta SALE de la regla, asi que los
// limites que ve el usuario son siempre los que valida el modelo.
// ---------------------------------------------------------------------------

// Un mapa en vez de un switch: anadir un tipo de regla no obliga a tocar
// la funcion de abajo (OCP).
const PREGUNTA_POR_TIPO = {
    texto: (texto, config) => pedirTexto(texto, config),
    email: (texto, config) => pedirEmail(texto, config),
    telefono: (texto, config) => pedirTelefono(texto, config),
    numero: (texto, config) => pedirNumero(texto, config),
    fecha: (texto, config) => pedirFecha(texto, config),
    lista: (texto, config, regla) => pedirOpcion(texto, regla.valores),
}

/**
 * Pregunta un campo usando la regla que el modelo declara para el.
 *
 *     await pedirSegunRegla('Titulo', Entregable.REGLAS.titulo)
 *
 * `extra` sirve para lo que la regla no sabe: el valor actual al editar,
 * un ejemplo, o forzar que sea opcional en esta pantalla concreta.
 */
export async function pedirSegunRegla(texto, regla, extra = {}) {
    const preguntar = PREGUNTA_POR_TIPO[regla.tipo]
    if (!preguntar) throw new Error(`No se como preguntar un campo de tipo "${regla.tipo}".`)

    return preguntar(texto, aOpcionesDeEntrada(regla, extra), regla)
}
