// POO: MODELO PROYECTO.
export class Proyecto {
    static ESTADOS = ['activo', 'finalizado', 'cancelado']

    constructor({ propuestaId, clienteId, codigo, nombre, descripcion, monto, plazoDias }) {
        this.propuestaId = propuestaId
        this.clienteId = clienteId
        this.codigo = codigo
        this.nombre = nombre
        this.descripcion = descripcion
        this.monto = Number(monto)
        this.estado = 'activo'
        this.avance = 0 
        this.cobrado = 0
        this.gastado = 0
        this.fechaInicio = new Date()
        this.fechaFinEstimada = Proyecto.enDias(Number(plazoDias))
        this.creadoEn = new Date()
    }

    static enDias(dias) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + dias)
        return fecha
    }

    // FACTORY METHOD (PATRÓN DE DISEÑO).
    static desdePropuesta(propuesta, codigo) {
        return new Proyecto({
            propuestaId: propuesta._id,
            clienteId: propuesta.clienteId,
            codigo,
            nombre: propuesta.titulo,
            descripcion: propuesta.descripcion,
            monto: propuesta.monto,
            plazoDias: propuesta.plazoDias,
        })
    }

    validar() {
        if (!this.propuestaId) throw new Error('El proyecto debe venir de una propuesta.')
        if (!this.clienteId) throw new Error('El proyecto debe pertenecer a un cliente.')
        if (!this.nombre || this.nombre.trim().length < 5) {
            throw new Error('El nombre del proyecto es obligatorio (mínimo 5 caracteres).')
        }
        if (!Number.isFinite(this.monto) || this.monto <= 0) {
            throw new Error('El monto del proyecto debe ser mayor que 0.')
        }
    }

    aDocumento() {
        return {
            propuestaId: this.propuestaId,
            clienteId: this.clienteId,
            codigo: this.codigo,
            nombre: this.nombre.trim(),
            descripcion: this.descripcion ?? null,
            monto: this.monto,
            estado: this.estado,
            avance: this.avance,
            cobrado: this.cobrado,
            gastado: this.gastado,
            fechaInicio: this.fechaInicio,
            fechaFinEstimada: this.fechaFinEstimada,
            creadoEn: this.creadoEn,
        }
    }
}
