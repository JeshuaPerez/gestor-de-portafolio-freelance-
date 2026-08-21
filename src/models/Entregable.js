import { aFechaLocal } from '../dominio/valores.js'
import { Modelo } from './Modelo.js'
import { CambioEstado } from './estados/CambioEstado.js'
import { EstadoEntregable } from './estados/EstadoEntregable.js'

// MODELO ENTREGABLE
//
// Ya no tiene la tabla TRANSICIONES ni el método puedeCambiar(): todo eso
// vive ahora en las clases de estado (patrón State). El modelo guarda la
// CLAVE del estado, que es lo que va a MongoDB, y sabe darte el objeto de
// estado cuando hace falta preguntarle algo.
//
// El `historial` tampoco es ya una lista de objetos sueltos: cada entrada es
// un CambioEstado, con sus reglas propias. Ver ese archivo para el porqué.
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
        // La forma de cada entrada la declara CambioEstado, no este modelo.
        historial: {
            tipo: 'subdocumentos',
            elemento: CambioEstado.REGLAS,
            etiqueta: 'historial de estados',
        },
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
        this.historial = CambioEstado.listaDesdeDocumento(historial)
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

    /**
     * Abre el historial con el estado de nacimiento del entregable.
     *
     * Sin esta entrada el historial de un entregable recién creado sale vacío
     * y la primera línea que aparece es "pendiente → entregado", sin decir en
     * ningún momento cuándo empezó a estar pendiente. Con ella, la consulta
     * cuenta la vida entera del entregable desde el minuto cero.
     */
    anotarAlta() {
        this.historial = [CambioEstado.alta(this.estado)]
        return this.historial[0]
    }

    /** Anota una transición en el historial y devuelve la entrada creada. */
    anotarCambio(desde, hasta, motivo = null) {
        const cambio = CambioEstado.transicion(desde, hasta, motivo)
        this.historial = [...this.historial, cambio]
        return cambio
    }

    /** La última entrada del historial, o null si todavía no hay ninguna. */
    ultimoCambio() {
        return this.historial.at(-1) ?? null
    }

    /**
     * Igual que el de Modelo, pero aplanando el historial: al driver hay que
     * darle objetos planos, no instancias de CambioEstado.
     */
    aDocumento() {
        return {
            ...super.aDocumento(),
            historial: this.historial.map((cambio) => cambio.aDocumento()),
        }
    }
}
