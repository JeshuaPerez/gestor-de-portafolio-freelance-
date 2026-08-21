// PATRÓN OBSERVER (GoF) — parte "sujeto"
//
// Un emisor al que cualquiera se suscribe sin que el emisor sepa quién es.
//
// Detalle importante para este proyecto: los observadores se avisan EN SERIE
// y con `await`. Estos eventos se disparan dentro de transacciones de MongoDB,
// y el trabajo del observador tiene que terminar (y poder fallar, abortando
// la transacción) antes de que la transacción confirme.

export class EmisorEventos {
    constructor() {
        this.observadores = new Map()
    }

    /** Suscribe un observador. Devuelve la función para darse de baja. */
    suscribir(evento, manejador) {
        if (!this.observadores.has(evento)) this.observadores.set(evento, [])
        this.observadores.get(evento).push(manejador)

        return () => {
            const lista = this.observadores.get(evento) ?? []
            const posicion = lista.indexOf(manejador)
            if (posicion !== -1) lista.splice(posicion, 1)
        }
    }

    /** Avisa a todos los suscritos. Si uno falla, el fallo sube (y revienta la transacción). */
    async emitir(evento, datos) {
        for (const manejador of this.observadores.get(evento) ?? []) {
            await manejador(datos)
        }
    }

    cuantosEscuchan(evento) {
        return (this.observadores.get(evento) ?? []).length
    }
}

// CATÁLOGO DE EVENTOS — evita erratas en los nombres.
export const EVENTOS = {
    ENTREGABLE_CAMBIO_ESTADO: 'entregable.cambioEstado',
    ENTREGABLE_EDITADO: 'entregable.editado',
    ENTREGABLE_CREADO: 'entregable.creado',
    ENTREGABLE_ELIMINADO: 'entregable.eliminado',
}
