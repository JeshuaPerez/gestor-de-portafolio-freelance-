// VALORES DEL DOMINIO
//
// Los modelos necesitaban interpretar fechas y redondear dinero, y para eso
// importaban `utils/formato.js`. Pero utils es la capa de presentación (usa
// dayjs e Intl para PINTAR cosas): el dominio no puede depender de ella.
//
// Aquí quedan las operaciones que son del negocio, sin ninguna dependencia.
// `utils/formato.js` las reexporta para que la consola siga usándolas.

/** Interpreta "2026-03-15" como el día 15 en hora LOCAL, no en UTC. */
export function aFechaLocal(valor) {
    if (valor instanceof Date) return valor
    if (typeof valor !== 'string') return new Date(valor)

    const partes = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!partes) return new Date(valor)

    const [, anio, mes, dia] = partes
    return new Date(Number(anio), Number(mes) - 1, Number(dia))
}

export function finDelDiaLocal(valor) {
    const fecha = aFechaLocal(valor)
    fecha.setHours(23, 59, 59, 999)
    return fecha
}

/** Dinero a dos decimales, esquivando los errores del punto flotante. */
export function redondearDinero(monto) {
    return Math.round((Number(monto) + Number.EPSILON) * 100) / 100
}

/** Suma días a hoy. La usan Propuesta, Proyecto y Contrato para sus plazos. */
export function enDias(dias) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + Number(dias))
    return fecha
}

/**
 * Quita las claves que valen `undefined`.
 * Al editar, "no me han pasado este campo" (undefined) y "ponlo a vacío"
 * (null) significan cosas distintas: sin esto, un `{...documento, ...cambios}`
 * borraría datos que el usuario no quería tocar.
 */
export function soloDefinidos(objeto) {
    return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined))
}
