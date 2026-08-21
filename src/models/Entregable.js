import { aFechaLocal } from '../dominio/valores.js'
import { Modelo } from './Modelo.js'
import { EstadoEntregable } from './estados/EstadoEntregable.js'

// MODELO ENTREGABLE
//
// Ya no tiene la tabla TRANSICIONES ni el método puedeCambiar(): todo eso
// vive ahora en las clases de estado (patrón State). El modelo guarda la
// CLAVE del estado, que es lo que va a MongoDB, y sabe darte el objeto de
// estado cuando hace falta preguntarle algo.
export class Entregable extends Modelo {
    static entidad = 'entregable'

    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        proyectoId: { tipo: 'id', etiqueta: 'proyecto' },
        titulo: { tipo: 'texto', min: 3, max: 150, etiqueta: 'título' },
        descripcion: { tipo: 'texto', max: 1000, opcional: true, etiqueta: 'descripción' },
        fechaLimite: { tipo: 'fecha', etiqueta: 'fecha límite' },
        peso: { tipo: 'numero', min: 1, max: 1000, etiqueta: 'peso' },
        estado: { tipo: 'lista', valores: EstadoEntregable.claves(), etiqueta: 'estado' },
        historial: { tipo: 'libre', etiqueta: 'historial' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de creación' },
    }

    constructor({
        proyectoId,
        codigo = null,
        titulo,
        descripcion,
        fechaLimite,
        peso,
        estado = EstadoEntregable.inicial().clave,
        historial = [],
        creadoEn,
    }) {
        super()
        this.codigo = codigo
        this.proyectoId = proyectoId
        this.titulo = titulo?.trim() || null
        this.descripcion = descripcion?.trim() || null
        this.fechaLimite = fechaLimite ? aFechaLocal(fechaLimite) : null
        this.peso = Number(peso)
        this.estado = estado
        this.historial = historial
        this.creadoEn = creadoEn ?? new Date()
    }

    /**
     * El objeto de estado. Aquí es donde el modelo delega TODAS las preguntas
     * sobre qué se puede hacer con este entregable:
     *
     *   entregable.estadoActual().permiteEdicion()
     *   entregable.estadoActual().cuentaParaAvance()
     *   entregable.estadoActual().transicionarA('aprobado')
     */
    estadoActual() {
        return EstadoEntregable.desde(this.estado)
    }

    /** Anota el cambio en el historial y devuelve la entrada creada. */
    anotarCambio(desde, hasta, motivo = null) {
        const entrada = { desde, hasta, motivo: motivo?.trim() || null, fecha: new Date() }
        this.historial = [...(this.historial ?? []), entrada]
        return entrada
    }
}
