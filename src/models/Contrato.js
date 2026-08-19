//POO: MODELO CONTRATO.

export class Contrato {
    static ESTADOS = ['borrador', 'activo', 'finalizado', 'cancelado']

    constructor({ proyectoId, clienteId, codigo, condiciones, valor, formaPago, plazoDias }) {
        this.proyectoId = proyectoId
        this.clienteId = clienteId
        this.codigo = codigo
        this.condiciones = condiciones ?? 'Condiciones pendientes de redactar.'
        this.valor = Number(valor)
        this.formaPago = formaPago ?? 'Por definir'
        this.estado = 'borrador'
        this.fechaInicio = new Date()
        this.fechaFin = Contrato.enDias(Number(plazoDias))
        this.firmadoEn = null
        this.creadoEn = new Date()
    }

    static enDias(dias) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + dias)
        return fecha
    }

    //FACTORY METHOD: EL CONTRATO SE DERRIVA DEL PROYECTO RECIENTE CREADO.
    static desdeProyecto(proyecto, proyectoId, codigo) {
        return new Contrato({
            proyectoId,
            clienteId: proyecto.clienteId,
            codigo,
            valor: proyecto.monto,
            plazoDias: Math.max(
                1,
                Math.round((proyecto.fechaFinEstimada - proyecto.fechaInicio) / 86400000),
            ),
        })
    }

    validar() {
        if (!this.proyectoId) throw new Error('El contrato debe pertenecer a un proyecto.')
        if (!Number.isFinite(this.valor) || this.valor <= 0) {
            throw new Error('El valor del contrato debe ser mayor que 0.')
        }
        if (this.fechaFin <= this.fechaInicio) {
            throw new Error('La fecha de fin debe ser posterior a la de inicio.')
        }
    }

    aDocumento() {
        return {
            proyectoId: this.proyectoId,
            clienteId: this.clienteId,
            codigo: this.codigo,
            condiciones: this.condiciones,
            valor: this.valor,
            formaPago: this.formaPago,
            estado: this.estado,
            fechaInicio: this.fechaInicio,
            fechaFin: this.fechaFin,
            firmadoEn: this.firmadoEn,
            creadoEn: this.creadoEn,
        }
    }
}
