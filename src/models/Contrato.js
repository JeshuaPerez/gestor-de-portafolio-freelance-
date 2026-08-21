import { enDias } from '../dominio/valores.js'
import { ValidacionError } from '../errors/errores.js'
import { Modelo } from './Modelo.js'

// MODELO CONTRATO
export class Contrato extends Modelo {
    static entidad = 'contrato'
    static ESTADOS = ['borrador', 'activo', 'finalizado', 'cancelado']
    static CONDICIONES_POR_DEFECTO = 'Condiciones pendientes de redactar.'

    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        proyectoId: { tipo: 'id', etiqueta: 'proyecto' },
        clienteId: { tipo: 'id', etiqueta: 'cliente' },
        condiciones: { tipo: 'texto', min: 10, max: 4000, etiqueta: 'condiciones' },
        valor: { tipo: 'numero', min: 0.01, max: 99999999, etiqueta: 'valor' },
        formaPago: { tipo: 'texto', min: 3, max: 120, etiqueta: 'forma de pago' },
        estado: { tipo: 'lista', valores: Contrato.ESTADOS, etiqueta: 'estado' },
        fechaInicio: { tipo: 'fecha', etiqueta: 'fecha de inicio' },
        fechaFin: { tipo: 'fecha', etiqueta: 'fecha de fin' },
        firmadoEn: { tipo: 'fecha', opcional: true, etiqueta: 'fecha de firma' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de creación' },
    }

    constructor({
        proyectoId,
        clienteId,
        codigo = null,
        condiciones,
        valor,
        formaPago,
        plazoDias,
        estado = 'borrador',
        fechaInicio,
        fechaFin,
        firmadoEn = null,
        creadoEn,
    }) {
        super()
        this.proyectoId = proyectoId
        this.clienteId = clienteId
        this.codigo = codigo
        this.condiciones = condiciones?.trim() || Contrato.CONDICIONES_POR_DEFECTO
        this.valor = Number(valor)
        this.formaPago = formaPago?.trim() || 'Por definir'
        this.estado = estado
        this.fechaInicio = fechaInicio ?? new Date()
        this.fechaFin = fechaFin ?? enDias(plazoDias)
        this.firmadoEn = firmadoEn
        this.creadoEn = creadoEn ?? new Date()
    }

    /** FACTORY METHOD: el contrato se deriva del proyecto recién creado. */
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

    validarReglasPropias() {
        if (this.fechaFin <= this.fechaInicio) {
            throw new ValidacionError('La fecha de fin debe ser posterior a la de inicio.', {
                campo: 'fechaFin',
            })
        }
        if (this.estado === 'activo' && !this.firmadoEn) {
            throw new ValidacionError('Un contrato activo tiene que tener fecha de firma.', {
                campo: 'firmadoEn',
            })
        }
    }

    /** Un contrato sin condiciones redactadas no se puede firmar. */
    tieneCondicionesRedactadas() {
        return (
            Boolean(this.condiciones) && this.condiciones !== Contrato.CONDICIONES_POR_DEFECTO
        )
    }

    puedeEditarse() {
        return this.estado === 'borrador'
    }
}
