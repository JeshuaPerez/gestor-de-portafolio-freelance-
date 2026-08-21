import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'

// Estas tres son del DOMINIO, no de la presentacion: viven en /dominio y
// aqui solo se reexportan para que la consola las siga importando de un sitio.
export { aFechaLocal, finDelDiaLocal, redondearDinero } from '../dominio/valores.js'

dayjs.extend(relativeTime)
dayjs.locale('es')

const LOCALE_POR_DEFECTO = 'es-GT'
const MONEDA_POR_DEFECTO = 'GTQ' // el quetzal

//FORMATEADOR DE DINERO
let formateadorDinero = null

function obtenerFormateadorDinero() {
    if (!formateadorDinero) {
        formateadorDinero = new Intl.NumberFormat(process.env.APP_LOCALE ?? LOCALE_POR_DEFECTO, {
            style: 'currency',
            currency: process.env.APP_CURRENCY ?? MONEDA_POR_DEFECTO,
            // DECIMALES
        })
    }
    return formateadorDinero
}

export function formatearDinero(monto) {
    return obtenerFormateadorDinero().format(monto ?? 0)
}




export function formatearFecha(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('DD/MM/YYYY')
}

export function formatearFechaLarga(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('D [de] MMMM [de] YYYY')
}

/**
 * Con la hora. En un historial de auditoría el día no basta: dos cambios de
 * estado del mismo entregable pueden caer en la misma fecha, y sin la hora no
 * hay forma de saber cuál pasó antes.
 */
export function formatearFechaHora(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('DD/MM/YYYY HH:mm')
}

export function fechaRelativa(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).fromNow()
}

/**
 * Cuánto tiempo separa dos momentos: "3 días", "2 horas", "un mes".
 * A diferencia de `fechaRelativa`, no dice "hace": no es un punto en el
 * tiempo, es un intervalo. La usa el historial para contar cuánto estuvo el
 * entregable en cada estado.
 */
export function duracionEntre(inicio, fin) {
    if (!inicio || !fin) return '-'
    return dayjs(fin).from(dayjs(inicio), true)
}

export function estaVencida(fecha) {
    return dayjs(fecha).isBefore(dayjs(), 'day')
}

export function diasHasta(fecha) {
    return dayjs(fecha).startOf('day').diff(dayjs().startOf('day'), 'day')
}
