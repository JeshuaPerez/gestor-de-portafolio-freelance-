import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'

/**
 * Pequeñas ayudas para que la consola se vea decente.
 * Son funciones puras: entra un dato, sale un texto. Nada más.
 *
 * ---------------------------------------------------------------------
 * POR QUÉ DAYJS Y NO `new Date()` A PELO
 * ---------------------------------------------------------------------
 * Antes usábamos `toLocaleDateString(...)`, que funciona pero se queda
 * corto: no sabe decir "hace 3 días" ni "vence en 2 semanas", y calcular
 * eso a mano son restas de milisegundos que nadie quiere leer.
 *
 * dayjs pesa 2 KB y lo resuelve. Se le añaden capacidades con PLUGINS: por
 * defecto no sabe hacer fechas relativas, hay que enchufarle `relativeTime`.
 * Ese es el patrón que usa la librería para no cargar lo que no usas.
 */
dayjs.extend(relativeTime)
dayjs.locale('es')

/**
 * ---------------------------------------------------------------------
 * EL PAÍS NO SE ESCRIBE EN EL CÓDIGO
 * ---------------------------------------------------------------------
 * La moneda y el formato de los números salen del `.env`, no de aquí:
 *
 *     APP_LOCALE=es-GT
 *     APP_CURRENCY=GTQ
 *
 * Al principio el proyecto tenía 'es-CO' y 'COP' escritos a fuego en esta
 * línea. Mudarse de país significaba buscar y reemplazar por el código.
 * Ahora es cambiar dos líneas del `.env`, sin tocar un solo archivo `.js`.
 *
 * Los valores por defecto son los de Guatemala, por si falta el `.env`.
 */
const LOCALE_POR_DEFECTO = 'es-GT'
const MONEDA_POR_DEFECTO = 'GTQ' // el quetzal

/*
 * El formateador se crea la PRIMERA vez que hace falta, no al cargar el
 * archivo. ¿Por qué? Porque al cargarse este módulo puede que dotenv
 * todavía no haya leído el `.env`, y entonces cogeríamos los valores por
 * defecto aunque el `.env` dijera otra cosa. Creándolo tarde, nos aseguramos
 * de que las variables ya están puestas.
 */
let formateadorDinero = null

function obtenerFormateadorDinero() {
    if (!formateadorDinero) {
        formateadorDinero = new Intl.NumberFormat(process.env.APP_LOCALE ?? LOCALE_POR_DEFECTO, {
            style: 'currency',
            currency: process.env.APP_CURRENCY ?? MONEDA_POR_DEFECTO,
            /*
             * Los decimales los decide la MONEDA, no nosotros.
             *
             * Antes había aquí un `maximumFractionDigits: 0`, heredado de
             * cuando esto era en pesos colombianos: allí nadie factura
             * centavos y quitarlos limpia la pantalla.
             *
             * Con el quetzal eso era un error: Q 1,500.50 se enseñaba como
             * Q 1,501. Medio quetzal de más en cada línea, y una factura que
             * no cuadra con lo que dice la base de datos.
             *
             * Sin la opción, Intl usa lo que corresponde a cada moneda: dos
             * decimales para GTQ, y lo suyo para cualquier otra.
             */
        })
    }
    return formateadorDinero
}

/** 20000 -> "Q 20,000.00" (en Guatemala) */
export function formatearDinero(monto) {
    return obtenerFormateadorDinero().format(monto ?? 0)
}

/**
 * =====================================================================
 *  EL BUG DE LA ZONA HORARIA (uno de los clásicos de JavaScript)
 * =====================================================================
 *
 * Escribes "2026-09-15" como fecha límite y en la tabla aparece 14/09/2026.
 * Un día menos. Siempre.
 *
 * ¿POR QUÉ? Porque `new Date('2026-09-15')` NO significa "el 15 de
 * septiembre". Al llevar solo la fecha, JavaScript la interpreta como
 * medianoche en UTC, o sea:
 *
 *     2026-09-15T00:00:00Z
 *
 * Guatemala va seis horas por detrás de UTC (UTC−6). Esa medianoche en
 * Londres son las 18:00 del DÍA ANTERIOR aquí. Al mostrarla en hora local
 * sale el 14.
 *
 * En Europa (UTC+1 o +2) el fallo no se nota, porque van por delante. Por
 * eso este bug se escapa tan a menudo: depende de dónde estés sentado.
 *
 * LA SOLUCIÓN: no dejar que JavaScript adivine. Partimos el texto en año,
 * mes y día y construimos la fecha con el constructor de tres números, que
 * SÍ trabaja en hora local:
 *
 *     new Date(2026, 8, 15)  ->  15/09/2026 a las 00:00 de Guatemala
 *
 * OJO con el mes: va de 0 a 11, así que septiembre es el 8. Otra trampa.
 */
export function aFechaLocal(valor) {
    if (valor instanceof Date) return valor
    if (typeof valor !== 'string') return new Date(valor)

    const partes = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!partes) return new Date(valor) // no tiene la forma esperada: que lo intente Date

    const [, anio, mes, dia] = partes
    return new Date(Number(anio), Number(mes) - 1, Number(dia))
}

/**
 * El ÚLTIMO instante de ese día, en hora local: 23:59:59.999.
 *
 * Hace falta para los filtros "hasta esta fecha". Si comparas con la
 * medianoche del día indicado, `$lte` deja fuera todo lo que pasó ese día,
 * que es justo lo que el usuario quería incluir al escribirlo.
 */
export function finDelDiaLocal(valor) {
    const fecha = aFechaLocal(valor)
    fecha.setHours(23, 59, 59, 999)
    return fecha
}

/**
 * Redondea a dos decimales (los centavos).
 *
 * Los números con decimales en JavaScript no son exactos: 0.1 + 0.2 da
 * 0.30000000000000004, no 0.3. Con dinero eso se acumula y acaba
 * apareciendo en la contabilidad.
 */
export function redondearDinero(monto) {
    return Math.round((Number(monto) + Number.EPSILON) * 100) / 100
}

/** Date -> "14/08/2026" */
export function formatearFecha(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('DD/MM/YYYY')
}

/** Date -> "14 de agosto de 2026" (para el documento del contrato) */
export function formatearFechaLarga(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('D [de] MMMM [de] YYYY')
}

/**
 * Date -> "en 3 días" / "hace 2 meses"
 *
 * Es lo que convierte una fecha en información útil de un vistazo: en una
 * lista de entregables, "vence en 2 días" se entiende mucho más rápido que
 * "20/08/2026", que obliga a mirar el calendario.
 */
export function fechaRelativa(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).fromNow()
}

/** ¿Esta fecha ya pasó? */
export function estaVencida(fecha) {
    return dayjs(fecha).isBefore(dayjs(), 'day')
}

/** Días que faltan (negativo si ya pasó). Útil para decidir colores. */
export function diasHasta(fecha) {
    return dayjs(fecha).startOf('day').diff(dayjs().startOf('day'), 'day')
}
