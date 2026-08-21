import { EVENTOS } from '../eventos/EmisorEventos.js'
import { calculadoraPara } from './CalculadoraAvance.js'

// PATRÓN OBSERVER (GoF) — parte "observador"
//
// La regla "cuando le pasa algo a un entregable, el avance del proyecto se
// recalcula" estaba copiada CUATRO veces dentro de EntregableService: en
// cambiarEstado, en editar, en eliminar y a medias en crear. Las cuatro con
// el mismo bloque de leer hermanos, calcular y actualizar.
//
// Ahora EntregableService solo anuncia lo que ha pasado. Este observador
// escucha y recalcula. El servicio ya no sabe que el avance del proyecto
// existe, y si mañana hay que avisar también por correo, se suscribe otro
// observador sin tocar el servicio (eso es OCP).
export class SincronizadorAvance {
    constructor(entregableRepositorio, proyectoRepositorio) {
        this.entregables = entregableRepositorio
        this.proyectos = proyectoRepositorio
        this.ultimoAvance = null
    }

    /** Se engancha a todos los eventos que pueden mover el avance. */
    registrarEn(emisor) {
        const recalcular = (datos) => this.sincronizar(datos)

        emisor.suscribir(EVENTOS.ENTREGABLE_CREADO, recalcular)
        emisor.suscribir(EVENTOS.ENTREGABLE_CAMBIO_ESTADO, recalcular)
        emisor.suscribir(EVENTOS.ENTREGABLE_EDITADO, recalcular)
        emisor.suscribir(EVENTOS.ENTREGABLE_ELIMINADO, recalcular)

        return this
    }

    /**
     * Relee los entregables del proyecto y deja el avance a lo que digan.
     * Se ejecuta DENTRO de la transacción que lo disparó (por eso recibe el
     * contexto): si esto falla, el cambio del entregable se deshace también.
     */
    async sincronizar({ proyectoId, contexto }) {
        const entregables = await this.entregables.listarPorProyecto(proyectoId, contexto)

        // La estrategia decide la fórmula; el observador solo la aplica.
        const avance = calculadoraPara(null, entregables).calcular()

        await this.proyectos.actualizar(
            proyectoId,
            { avance, actualizadoEn: new Date() },
            contexto,
        )

        this.ultimoAvance = avance
        return avance
    }
}
