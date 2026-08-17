import { aFechaLocal } from '../utils/formato.js'

/**
 * POO: MODELO Entregable.
 *
 * Un entregable es un hito del proyecto: "diseño aprobado", "backend
 * terminado". Cada uno tiene un PESO: cuánto representa dentro del total.
 * Con los pesos se calcula el avance del proyecto automáticamente.
 */
export class Entregable {
    static ESTADOS = ['pendiente', 'entregado', 'aprobado', 'rechazado']

    /**
     * Transiciones permitidas: desde cada estado, a cuáles se puede pasar.
     *
     * Tener esto en una tabla (en vez de una cadena de ifs) hace que añadir
     * un estado nuevo sea cambiar una línea, no reescribir la lógica.
     */
    static TRANSICIONES = {
        pendiente: ['entregado'],
        entregado: ['aprobado', 'rechazado'],
        rechazado: ['entregado'], // se corrige y se vuelve a entregar
        aprobado: [], // estado final: ya no se mueve
    }

    constructor({ proyectoId, titulo, descripcion, fechaLimite, peso }) {
        // ENT-0001. Lo asigna el servicio antes de guardar (ver Cliente.js).
        this.codigo = null
        this.proyectoId = proyectoId
        this.titulo = titulo
        this.descripcion = descripcion
        // `aFechaLocal` en vez de `new Date(...)`: con el texto "2026-09-15",
        // `new Date` entiende medianoche en UTC y en Guatemala eso cae en el
        // día anterior. Ver la explicación larga en utils/formato.js.
        this.fechaLimite = aFechaLocal(fechaLimite)
        this.peso = Number(peso)
        this.estado = 'pendiente'
        this.historial = [] // cada cambio de estado queda registrado aquí
        this.creadoEn = new Date()
    }

    /** ¿Se puede pasar de `estadoActual` a `estadoNuevo`? */
    static puedeCambiar(estadoActual, estadoNuevo) {
        return Entregable.TRANSICIONES[estadoActual]?.includes(estadoNuevo) ?? false
    }

    validar() {
        if (!this.proyectoId) throw new Error('El entregable debe pertenecer a un proyecto.')
        if (!this.titulo || this.titulo.trim().length < 3) {
            throw new Error('El título del entregable es obligatorio (mínimo 3 caracteres).')
        }
        // isNaN sobre una fecha inválida: new Date("hola") da "Invalid Date".
        if (Number.isNaN(this.fechaLimite.getTime())) {
            throw new Error('La fecha límite no es válida. Usa el formato AAAA-MM-DD.')
        }
        if (!Number.isFinite(this.peso) || this.peso <= 0) {
            throw new Error('El peso debe ser un número mayor que 0.')
        }
    }

    aDocumento() {
        return {
            codigo: this.codigo,
            proyectoId: this.proyectoId,
            titulo: this.titulo.trim(),
            descripcion: this.descripcion?.trim() || null,
            fechaLimite: this.fechaLimite,
            peso: this.peso,
            estado: this.estado,
            historial: this.historial,
            creadoEn: this.creadoEn,
        }
    }
}
