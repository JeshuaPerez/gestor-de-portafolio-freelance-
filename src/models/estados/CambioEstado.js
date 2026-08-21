import { Modelo } from '../Modelo.js'
import { EstadoEntregable } from './EstadoEntregable.js'

// UNA ENTRADA DEL HISTORIAL DE ESTADOS
//
// El historial ya se guardaba, pero como un objeto anónimo montado a mano
// dentro del modelo Entregable:
//
//     { desde, hasta, motivo, fecha: new Date() }
//
// Eso tenía dos agujeros. El primero es que nadie lo validaba: el campo
// `historial` estaba declarado como `libre`, y `aEsquemaMongo()` se salta ese
// tipo, así que la colección aceptaba cualquier cosa dentro del array — un
// `hasta` con un estado que no existe, una `fecha` guardada como texto o una
// entrada a la que le falta la mitad de los campos. Un historial es un
// registro de auditoría: si admite basura, deja de servir como prueba de lo
// que pasó, que es justo para lo único que existe.
//
// El segundo es que la forma de la entrada estaba escrita en el modelo y
// releída a mano en la consola (`ultimo.desde` + ' → ' + `ultimo.hasta`).
// Dos sitios que había que cambiar a la vez.
//
// Ahora cada entrada es un Modelo con sus propias REGLAS, y de esas reglas
// salen las dos cosas de siempre: la validación en memoria y el trozo de
// $jsonSchema que MongoDB aplica a cada elemento del array.
export class CambioEstado extends Modelo {
    static entidad = 'cambio de estado'

    static REGLAS = {
        // El alta no viene de ningún sitio, por eso `desde` es opcional: es
        // el único caso legítimo en el que la entrada no tiene estado anterior.
        desde: {
            tipo: 'lista',
            valores: EstadoEntregable.claves(),
            opcional: true,
            etiqueta: 'estado anterior',
        },
        hasta: {
            tipo: 'lista',
            valores: EstadoEntregable.claves(),
            etiqueta: 'estado nuevo',
        },
        motivo: { tipo: 'texto', max: 300, opcional: true, etiqueta: 'motivo' },
        fecha: { tipo: 'fecha', etiqueta: 'fecha del cambio' },
    }

    constructor({ desde = null, hasta, motivo = null, fecha = null }) {
        super()
        this.desde = desde ?? null
        this.hasta = hasta
        this.motivo = typeof motivo === 'string' ? motivo.trim() || null : null
        this.fecha = fecha ? new Date(fecha) : new Date()
    }

    /** Primera entrada: el entregable nace en su estado inicial. */
    static alta(hasta) {
        return new CambioEstado({ desde: null, hasta })
    }

    /** Un salto entre dos estados de la máquina. */
    static transicion(desde, hasta, motivo = null) {
        return new CambioEstado({ desde, hasta, motivo })
    }

    /**
     * Reconstruye el historial guardado en Mongo.
     *
     * Ordena por fecha en vez de fiarse del orden del array. En la práctica
     * `$push` ya lo deja cronológico, pero el historial se lee para auditar:
     * si alguien tocó la colección por fuera de la aplicación, la consulta
     * tiene que seguir contando los hechos en el orden en que ocurrieron.
     */
    static listaDesdeDocumento(historial) {
        return (historial ?? [])
            .map((entrada) => new CambioEstado(entrada))
            .sort((uno, otro) => uno.fecha - otro.fecha)
    }

    esAlta() {
        return this.desde === null
    }

    /** "pendiente → entregado". En el alta, "alta → pendiente". */
    describir() {
        return `${this.desde ?? 'alta'} → ${this.hasta}`
    }
}
