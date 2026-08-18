import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'

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

export function aFechaLocal(valor) {
    if (valor instanceof Date) return valor
    if (typeof valor !== 'string') return new Date(valor)

    const partes = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!partes) return new Date(valor) // no tiene la forma esperada: que lo intente Date

    const [, anio, mes, dia] = partes
    return new Date(Number(anio), Number(mes) - 1, Number(dia))
}

export function finDelDiaLocal(valor) {
    const fecha = aFechaLocal(valor)
    fecha.setHours(23, 59, 59, 999)
    return fecha
}

export function redondearDinero(monto) {
    return Math.round((Number(monto) + Number.EPSILON) * 100) / 100
}

export function formatearFecha(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('DD/MM/YYYY')
}

export function formatearFechaLarga(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).format('D [de] MMMM [de] YYYY')
}

export function fechaRelativa(fecha) {
    if (!fecha) return '-'
    return dayjs(fecha).fromNow()
}

export function estaVencida(fecha) {
    return dayjs(fecha).isBefore(dayjs(), 'day')
}

export function diasHasta(fecha) {
    return dayjs(fecha).startOf('day').diff(dayjs().startOf('day'), 'day')
}
