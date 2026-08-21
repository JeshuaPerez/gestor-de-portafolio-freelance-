import { ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { EstadoEntregable } from '../models/estados/EstadoEntregable.js'

// PATRÓN STRATEGY (GoF)
//
// Un proyecto calcula su avance de dos formas incompatibles:
//
//   · si tiene entregables -> el avance SALE de los pesos aprobados
//   · si no los tiene      -> el freelancer lo escribe a mano
//
// Antes esa decisión era un `if` escondido dentro de ProyectoService, con un
// `throw` en medio, y la fórmula de los pesos vivía en EntregableService.
// Es decir: una sola decisión repartida en dos servicios.
//
// Ahora cada forma de calcular es una estrategia intercambiable, y hay un
// único sitio que decide cuál toca.

export class CalculadoraAvance {
    /** Porcentaje 0-100 que le corresponde al proyecto. */
    calcular() {
        throw new Error('calcular() debe implementarlo la estrategia concreta.')
    }

    /** ¿El usuario puede teclear el avance directamente? */
    permiteRegistroManual() {
        return false
    }

    /** Texto para la consola: por qué el avance es el que es. */
    descripcion() {
        return 'Avance del proyecto'
    }
}

// EL AVANCE LO MANDAN LOS ENTREGABLES: peso aprobado sobre peso total.
export class AvancePorEntregables extends CalculadoraAvance {
    constructor(entregables) {
        super()
        this.entregables = entregables
    }

    calcular() {
        const pesoTotal = this.entregables.reduce((suma, e) => suma + Number(e.peso ?? 0), 0)
        if (pesoTotal === 0) return 0

        const pesoLogrado = this.entregables
            .filter((e) => EstadoEntregable.desde(e.estado).cuentaParaAvance())
            .reduce((suma, e) => suma + Number(e.peso ?? 0), 0)

        return Math.round((pesoLogrado / pesoTotal) * 100)
    }

    permiteRegistroManual() {
        return false
    }

    descripcion() {
        return `Calculado sobre ${this.entregables.length} entregable(s) aprobados`
    }
}

// SIN ENTREGABLES: el avance es un dato que el freelancer reporta.
export class AvanceManual extends CalculadoraAvance {
    constructor(avanceActual = 0) {
        super()
        this.avanceActual = Number(avanceActual) || 0
    }

    calcular(porcentajeNuevo) {
        // Si nadie propone un valor nuevo, el avance se queda como está.
        if (porcentajeNuevo === undefined || porcentajeNuevo === null) return this.avanceActual

        const nuevo = Number(porcentajeNuevo)

        if (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 100) {
            throw new ValidacionError('El avance debe ser un número entre 0 y 100.', {
                campo: 'avance',
            })
        }
        // Un trabajo hecho no se deshace.
        if (nuevo < this.avanceActual) {
            throw new ReglaNegocioError(
                `El avance no puede retroceder (actual: ${this.avanceActual}%).`,
            )
        }

        return nuevo
    }

    permiteRegistroManual() {
        return true
    }

    descripcion() {
        return 'Reportado manualmente (el proyecto no tiene entregables)'
    }
}

/**
 * El ÚNICO sitio que elige la estrategia. Los servicios preguntan aquí en vez
 * de repetir el `if (entregables.length > 0)`.
 */
export function calculadoraPara(proyecto, entregables = []) {
    return entregables.length > 0
        ? new AvancePorEntregables(entregables)
        : new AvanceManual(proyecto?.avance ?? 0)
}
