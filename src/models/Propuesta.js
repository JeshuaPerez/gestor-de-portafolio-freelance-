import { enDias } from '../dominio/valores.js'
import { ReglaNegocioError } from '../errors/errores.js'
import { Modelo } from './Modelo.js'

// MODELO PROPUESTA
export class Propuesta extends Modelo {
    static entidad = 'propuesta'
    static ESTADOS = ['pendiente', 'aceptada', 'rechazada']

    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        clienteId: { tipo: 'id', etiqueta: 'cliente' },
        titulo: { tipo: 'texto', min: 5, max: 150, etiqueta: 'título' },
        descripcion: { tipo: 'texto', max: 1000, opcional: true, etiqueta: 'descripción' },
        monto: { tipo: 'numero', min: 0.01, max: 99999999, etiqueta: 'monto' },
        plazoDias: { tipo: 'numero', entero: true, min: 1, max: 3650, etiqueta: 'plazo en días' },
        estado: { tipo: 'lista', valores: Propuesta.ESTADOS, etiqueta: 'estado' },
        motivoRechazo: {
            tipo: 'texto',
            min: 5,
            max: 500,
            opcional: true,
            etiqueta: 'motivo del rechazo',
        },
        fechaVencimiento: { tipo: 'fecha', etiqueta: 'fecha de vencimiento' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de creación' },
    }

    constructor({
        clienteId,
        codigo = null,
        titulo,
        descripcion,
        monto,
        plazoDias,
        estado = 'pendiente',
        motivoRechazo = null,
        fechaVencimiento,
        creadoEn,
    }) {
        super()
        this.clienteId = clienteId
        this.codigo = codigo
        this.titulo = titulo?.trim() || null
        this.descripcion = descripcion?.trim() || null
        this.monto = Number(monto)
        this.plazoDias = Number(plazoDias)
        this.estado = estado
        this.motivoRechazo = motivoRechazo?.trim() || null
        this.fechaVencimiento = fechaVencimiento ?? enDias(30)
        this.creadoEn = creadoEn ?? new Date()
    }

    // Regla que cruza dos campos: no cabe en una regla suelta.
    validarReglasPropias() {
        if (this.estado === 'rechazada' && !this.motivoRechazo) {
            throw new ReglaNegocioError('Una propuesta rechazada tiene que llevar el motivo.')
        }
    }

    puedeEditarse() {
        return this.estado === 'pendiente'
    }
}
