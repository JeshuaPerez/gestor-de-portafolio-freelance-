//POO: MODELO PROPUESTA.

export class Propuesta {

    static ESTADOS = ['pendiente', 'aceptada', 'rechazada']

    constructor({ clienteId, codigo, titulo, descripcion, monto, plazoDias, fechaVencimiento }) {
        this.clienteId = clienteId
        this.codigo = codigo ?? null 
        this.titulo = titulo
        this.descripcion = descripcion
        this.monto = Number(monto) 
        this.plazoDias = Number(plazoDias)
        this.estado = 'pendiente' 
        this.motivoRechazo = null
        this.fechaVencimiento = fechaVencimiento ?? Propuesta.enDias(30)
        this.creadoEn = new Date()
    }

    static enDias(dias) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + dias)
        return fecha
    }

    validar() {
        if (!this.clienteId) {
            throw new Error('La propuesta debe pertenecer a un cliente.')
        }
        if (!this.titulo || this.titulo.trim().length < 5) {
            throw new Error('El título es obligatorio (mínimo 5 caracteres).')
        }
        
        if (!Number.isFinite(this.monto) || this.monto <= 0) {
            throw new Error('El monto debe ser un número mayor que 0.')
        }
        if (!Number.isInteger(this.plazoDias) || this.plazoDias <= 0) {
            throw new Error('El plazo debe ser un número entero de días mayor que 0.')
        }
    }

    aDocumento() {
        return {
            clienteId: this.clienteId,
            codigo: this.codigo,
            titulo: this.titulo.trim(),
            descripcion: this.descripcion?.trim() || null,
            monto: this.monto,
            plazoDias: this.plazoDias,
            estado: this.estado,
            motivoRechazo: this.motivoRechazo,
            fechaVencimiento: this.fechaVencimiento,
            creadoEn: this.creadoEn,
        }
    }
}
