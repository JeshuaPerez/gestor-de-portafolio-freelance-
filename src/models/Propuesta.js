/**
 * POO: MODELO Propuesta.
 *
 * Una propuesta es la oferta que le haces a un cliente: "te hago tu web por
 * X pesos en Y días". Si la acepta, se convierte en proyecto.
 */
export class Propuesta {
    // Estados posibles. Tenerlos aquí evita escribir 'aceptada' mal en
    // cualquier otra parte del código.
    static ESTADOS = ['pendiente', 'aceptada', 'rechazada']

    constructor({ clienteId, codigo, titulo, descripcion, monto, plazoDias, fechaVencimiento }) {
        this.clienteId = clienteId
        this.codigo = codigo ?? null // lo asigna el servicio: PRO-0001, PRO-0002...
        this.titulo = titulo
        this.descripcion = descripcion
        this.monto = Number(monto) // llega como texto desde la consola
        this.plazoDias = Number(plazoDias)
        this.estado = 'pendiente' // toda propuesta nace pendiente
        this.motivoRechazo = null

        // Si no indican vencimiento, damos 30 días por defecto.
        this.fechaVencimiento = fechaVencimiento ?? Propuesta.enDias(30)
        this.creadoEn = new Date()
    }

    /** Devuelve la fecha de hoy + N días. */
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
        // Number.isFinite descarta NaN: si el usuario escribe "abc" en el
        // monto, Number("abc") da NaN y aquí lo cazamos.
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
