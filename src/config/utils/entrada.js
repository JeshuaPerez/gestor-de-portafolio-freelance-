import inquirer from 'inquirer'
import { estilo } from './estilo.js'

/**
 * =====================================================================
 *  ENTRADA DE DATOS POR CONSOLA — preguntar Y validar en el mismo sitio
 * =====================================================================
 *
 * ---------------------------------------------------------------------
 * ESTE ARCHIVO CAMBIÓ DE LIBRERÍA POR DENTRO, Y NADIE SE ENTERÓ
 * ---------------------------------------------------------------------
 * Antes esto estaba montado sobre `readline/promises`, con un `while(true)`
 * por función que volvía a preguntar cuando el dato estaba mal.
 *
 * Ahora usa INQUIRER. Cambió absolutamente todo aquí dentro y NO se tocó
 * ni una línea de lógica de los seis menús. Eso es lo que se compra al
 * separar en capas: los menús dependen de lo que este archivo PROMETE
 * (`pedirTexto`, `elegirDeLista`...), no de cómo lo cumple.
 *
 * Si el proyecto hubiera llamado a `rl.question()` directamente desde cada
 * menú, este cambio habría tocado los seis archivos y unas 40 llamadas.
 *
 * ---------------------------------------------------------------------
 * QUÉ APORTA INQUIRER
 * ---------------------------------------------------------------------
 *   - `validate`: se le pasa la regla y ÉL repite la pregunta. Adiós a los
 *     `while (true)` escritos a mano.
 *   - `type: 'list'`: menús que se recorren con las flechas del teclado.
 *   - `filter`: limpia el dato (quitar espacios) antes de validarlo.
 *
 * Lo que NO cambió: las reglas. Un email sigue necesitando su @, un peso
 * sigue teniendo que ser mayor que 0. Eso es del negocio, no de la librería.
 */

/** Palabra que el usuario puede escribir en cualquier momento para abortar. */
const PALABRA_CANCELAR = 'cancelar'

/**
 * HERENCIA aplicada a los errores.
 *
 * Cancelar no es un fallo: el usuario cambió de opinión y ya está. Pero nos
 * viene bien que viaje como excepción, porque así corta la operación a medias
 * sin tener que comprobar `if (x === null)` después de CADA pregunta.
 *
 * Al ser una clase propia que extiende Error, el menú puede distinguirla:
 *     catch (error) {
 *         if (error instanceof OperacionCancelada) -> aviso tranquilo
 *         else                                     -> error de verdad
 *     }
 */
export class OperacionCancelada extends Error {
    constructor() {
        super('Operación cancelada.')
        this.name = 'OperacionCancelada'
    }
}

/** Aviso que conviene enseñar al empezar un formulario de varios pasos. */
export const AVISO_CANCELAR = estilo.tenue(
    `  (escribe "${PALABRA_CANCELAR}" en cualquier momento para abortar)`,
)

/**
 * El "preguntador" de inquirer.
 *
 * Por defecto habla con el teclado y la pantalla de verdad. Se guarda en una
 * variable en vez de usar `inquirer.prompt` directamente para poder
 * sustituirlo en las pruebas por uno que lea de un stream falso: así se
 * puede probar la consola sin que haya nadie tecleando.
 *
 * Es inyección de dependencias otra vez, pero a nivel de módulo.
 */
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

/**
 * Lanza una pregunta de texto y corta si el usuario canceló.
 * Es el ladrillo con el que están hechas pedirTexto, pedirNumero y compañía.
 */
/**
 * Lanza una pregunta de texto y corta si el usuario canceló.
 *
 * Si se le pasa , inquirer lo precarga: el usuario ve el valor que
 * ya había y lo conserva pulsando Enter, o lo cambia escribiendo encima.
 * Es lo que convierte un formulario de alta en uno de edición sin duplicar
 * ni una línea de código.
 */
/**
 * Lanza una pregunta de texto y corta si el usuario canceló.
 *
 * Si recibe `actual`, se lo pasa a inquirer como valor por defecto: el
 * usuario ve lo que ya había escrito, lo conserva pulsando Enter o lo
 * cambia escribiendo encima.
 *
 * Eso es lo que convierte un formulario de alta en uno de edición sin
 * duplicar ni una línea: las mismas preguntas, con los datos precargados.
 */
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

/**
 * ---------------------------------------------------------------------
 * TEXTO
 * ---------------------------------------------------------------------
 * opciones: { min, max, opcional, ejemplo }
 * Devuelve el texto ya recortado, o null si era opcional y lo dejó vacío.
 */
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

/**
 * ---------------------------------------------------------------------
 * EMAIL
 * ---------------------------------------------------------------------
 *
 * ¿NO ESTÁ ESTO REPETIDO? El modelo Cliente también valida el email.
 * Sí, y es a propósito. Es la misma DOBLE DEFENSA que usamos con los pagos
 * duplicados (comprobación + índice único):
 *
 *   - aquí   -> para que el usuario lo corrija en el momento, sin perder
 *               los otros campos que ya había escrito;
 *   - modelo -> porque el servicio puede llamarse desde otro sitio que no
 *               sea esta consola (una API web, un script de importación) y
 *               ahí no hay nadie a quien volver a preguntar.
 */
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

/**
 * ---------------------------------------------------------------------
 * TELÉFONO
 * ---------------------------------------------------------------------
 * Cuenta solo los dígitos, así que admite espacios, guiones y prefijos:
 * "+502 5512 3456" y "5512-3456" son igual de válidos.
 *
 * En Guatemala los números son de 8 dígitos, así que ese es el mínimo. Se
 * deja como opción por si algún día hay que aceptar otros países.
 */
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

/**
 * ---------------------------------------------------------------------
 * NÚMERO
 * ---------------------------------------------------------------------
 * opciones: { min, max, entero, opcional, ejemplo }
 */
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

    /*
     * LA COMA NO SIGNIFICA LO MISMO EN TODAS PARTES. Ojo con esto.
     *
     * En Guatemala (y en México, EE.UU., Centroamérica) la coma separa los
     * MILES y el punto los decimales:   1,500.50  =  mil quinientos y medio
     * En Colombia (y España) es al revés:  1.500,50
     *
     * Aquí antes se hacía `replace(',', '.')`, pensado para Colombia. Con
     * las reglas de Guatemala eso era un desastre silencioso:
     *
     *     escribes "20,000"  ->  "20.000"  ->  Number  ->  20
     *
     * Veinte mil quetzales se guardaban como veinte. Y sin error: el 20 es
     * un número perfectamente válido, así que nadie se enteraba hasta
     * cuadrar la contabilidad.
     *
     * Ahora la coma se trata como lo que es aquí: separador de miles, se
     * quita. Y también se quitan los espacios, que mucha gente los usa.
     */
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

            // OJO: Number('') devuelve 0, no NaN. Por eso el vacío se
            // comprueba ANTES. Es un fallo clásico y silencioso.
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

/**
 * ---------------------------------------------------------------------
 * FECHA
 * ---------------------------------------------------------------------
 * Devuelve el texto en formato AAAA-MM-DD (que es lo que esperan los modelos).
 */
export async function pedirFecha(texto, opciones = {}) {
    const { opcional = false, futura = false, actual = null } = opciones

    /*
     * TRAMPA DE JAVASCRIPT que conviene conocer:
     *
     *     new Date(2026, 1, 31)  ->  3 de marzo de 2026
     *
     * Si el día no existe, Date NO da error: DESBORDA al mes siguiente en
     * silencio. Un 31 de febrero se colaría como fecha válida.
     *
     * La comprobación fiable es de ida y vuelta: se construye la fecha y se
     * mira si los tres números salen tal y como entraron.
     */
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

/**
 * ---------------------------------------------------------------------
 * OPCIÓN DE UNA LISTA CERRADA
 * ---------------------------------------------------------------------
 * Para campos que solo admiten unos pocos valores (ingreso/egreso,
 * pendiente/entregado/aprobado...).
 *
 * Con inquirer se recorren con las flechas y se elige con Enter: ya no hay
 * que acordarse de cómo se escribía exactamente cada palabra, ni teclearla.
 */
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

/**
 * ---------------------------------------------------------------------
 * CONFIRMACIÓN
 * ---------------------------------------------------------------------
 * Devuelve true o false. Antes había que escribir "SI" en mayúsculas y
 * cualquier otra cosa se tomaba como un "no" silencioso.
 */
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

/**
 * ---------------------------------------------------------------------
 * ELEGIR UN REGISTRO DE UNA LISTA
 * ---------------------------------------------------------------------
 * LA MEJORA MÁS IMPORTANTE DE TODO EL ARCHIVO.
 *
 * Al principio del proyecto había que copiar y pegar un ID de MongoDB:
 *
 *     ID del cliente: 68a1f4c2b3d4e5f6a7b8c9d0
 *
 * Ahora se ve lo que hay y se elige con las flechas:
 *
 *     ? Elige un cliente (Usa las flechas)
 *     > CLI-0001  Ana Gómez   <ana@correo.com>
 *       CLI-0002  Luis Paz    <luis@correo.com>
 *
 * `describir` es una función que recibe un elemento y devuelve su texto.
 * Se la pasa quien llama, porque un cliente y una propuesta no se describen
 * igual. Eso es el patrón STRATEGY en su versión más simple: el "cómo se
 * pinta" se inyecta desde fuera en vez de estar escrito aquí dentro.
 */
export async function elegirDeLista(items, opciones = {}) {
    const {
        etiqueta = 'Elige una opción',
        describir = (item) => String(item),
        siVacio = 'No hay registros para elegir.',
    } = opciones

    // Que la lista esté vacía no es un fallo del programa, es información
    // útil para el usuario: se lo decimos con un mensaje suyo, no genérico.
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

/**
 * ---------------------------------------------------------------------
 * MENÚ DE ACCIONES
 * ---------------------------------------------------------------------
 * El menú de cada módulo. Recibe pares { nombre, valor } y devuelve el
 * `valor` elegido, en vez del '1', '2', '3' de antes.
 *
 * Ganamos legibilidad en los menús: `case 'crear'` se entiende sin mirar
 * arriba a ver qué era la opción 1.
 */
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
