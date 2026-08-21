import { enDias } from '../dominio/valores.js'
import { ValidacionError } from '../errors/errores.js'
import { Modelo } from './Modelo.js'

// MODELO PROYECTO
export class Proyecto extends Modelo {
    static entidad = 'proyecto'
    static ESTADOS = ['activo', 'finalizado', 'cancelado']

    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        propuestaId: { tipo: 'id', etiqueta: 'propuesta de origen' },
        clienteId: { tipo: 'id', etiqueta: 'cliente' },
        nombre: { tipo: 'texto', min: 5, max: 150, etiqueta: 'nombre' },
        descripcion: { tipo: 'texto', max: 1000, opcional: true, etiqueta: 'descripción' },
        monto: { tipo: 'numero', min: 0.01, max: 99999999, etiqueta: 'monto' },
        estado: { tipo: 'lista', valores: Proyecto.ESTADOS, etiqueta: 'estado' },
        avance: { tipo: 'numero', min: 0, max: 100, etiqueta: 'avance' },
        // Sin mínimo a propósito: son acumulados que se mueven con $inc y una
        // anulación los devuelve a cero. Un redondeo a la baja no debe romper
        // la escritura.
        cobrado: { tipo: 'numero', etiqueta: 'total cobrado' },
        gastado: { tipo: 'numero', etiqueta: 'total gastado' },
        fechaInicio: { tipo: 'fecha', etiqueta: 'fecha de inicio' },
        fechaFinEstimada: { tipo: 'fecha', etiqueta: 'fin previsto' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de creación' },
    }

    constructor({
        propuestaId,
        clienteId,
        codigo = null,
        nombre,
        descripcion,
        monto,
        plazoDias,
        estado = 'activo',
        avance = 0,
        cobrado = 0,
        gastado = 0,
        fechaInicio,
        fechaFinEstimada,
        creadoEn,
    }) {
        super()
        this.propuestaId = propuestaId
        this.clienteId = clienteId
        this.codigo = codigo
        this.nombre = nombre?.trim() || null
        this.descripcion = descripcion?.trim() || null
        this.monto = Number(monto)
        this.estado = estado
        this.avance = Number(avance)
        this.cobrado = Number(cobrado)
        this.gastado = Number(gastado)
        this.fechaInicio = fechaInicio ?? new Date()
        this.fechaFinEstimada = fechaFinEstimada ?? enDias(plazoDias)
        this.creadoEn = creadoEn ?? new Date()
    }

    /**
     * FACTORY METHOD sobre la propuesta: el proyecto sabe derivarse de ella.
     * Si mañana el proyecto hereda un campo más de la propuesta, se cambia
     * aquí y en ningún otro sitio.
     */
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

    validarReglasPropias() {
        if (this.fechaFinEstimada < this.fechaInicio) {
            throw new ValidacionError(
                'La fecha de fin no puede ser anterior al inicio del proyecto.',
                { campo: 'fechaFinEstimada' },
            )
        }
    }

    estaAbierto() {
        return this.estado === 'activo'
    }
}
