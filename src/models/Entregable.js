import { aFechaLocal } from '../utils/formato.js'

// POO: MODELO ENTREGABLE.

export class Entregable {
    static ESTADOS = ['pendiente', 'entregado', 'aprobado', 'rechazado']

    static TRANSICIONES = {
        pendiente: ['entregado'],
        entregado: ['aprobado', 'rechazado'],
        rechazado: ['entregado'], 
        aprobado: [], 
    }

    constructor({ proyectoId, titulo, descripcion, fechaLimite, peso }) {
        this.codigo = null
        this.proyectoId = proyectoId
        this.titulo = titulo
        this.descripcion = descripcion
        this.fechaLimite = aFechaLocal(fechaLimite)
        this.peso = Number(peso)
        this.estado = 'pendiente'
        this.historial = [] 
        this.creadoEn = new Date()
    }

    static puedeCambiar(estadoActual, estadoNuevo) {
        return Entregable.TRANSICIONES[estadoActual]?.includes(estadoNuevo) ?? false
    }

    validar() {
        if (!this.proyectoId) throw new Error('El entregable debe pertenecer a un proyecto.')
        if (!this.titulo || this.titulo.trim().length < 3) {
            throw new Error('El título del entregable es obligatorio (mínimo 3 caracteres).')
        }

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
