import { ReglaNegocioError, ValidacionError } from '../../errors/errores.js'

// PATRÓN STATE (GoF)
//
// Antes esto era una tabla `TRANSICIONES` y tres reglas sueltas repartidas
// por el código:
//
//   EntregableService.cambiarEstado  ->  ¿puedo pasar de X a Y?
//   EntregableService.editar         ->  ['pendiente','rechazado'].includes(estado)
//   EntregableService.eliminar       ->  if (estado === 'aprobado') throw
//   EntregableService.calcularAvance ->  filter(e => e.estado === 'aprobado')
//   commands/entregables.js          ->  Entregable.TRANSICIONES[estado]
//
// Cinco sitios que hay que revisar al añadir un estado. Con State, cada
// estado es una clase que responde por sí misma a todas esas preguntas.
// Añadir "en_revision" es crear UNA clase y registrarla: nada más cambia.

export class EstadoEntregable {
    // Nombre con el que el estado se guarda en MongoDB.
    static clave = null

    get clave() {
        return this.constructor.clave
    }

    /** A qué estados se puede saltar desde aquí. */
    siguientes() {
        return []
    }

    /** Un estado final ya no se mueve. */
    esFinal() {
        return this.siguientes().length === 0
    }

    puedeIrA(clave) {
        return this.siguientes().includes(clave)
    }

    /** ¿El peso de este entregable suma al avance del proyecto? */
    cuentaParaAvance() {
        return false
    }

    /** ¿Se pueden todavía cambiar título, fecha o peso? */
    permiteEdicion() {
        return false
    }

    /** ¿Se puede borrar de la base de datos? */
    permiteEliminacion() {
        return true
    }

    /** ¿Llegar a este estado exige que el usuario explique por qué? */
    exigeMotivo() {
        return false
    }

    /**
     * Cómo se le pide ese motivo al usuario. Cada estado lo redacta a su
     * manera: "el motivo del rechazo" se entiende mejor que un texto genérico.
     */
    mensajeMotivo() {
        return `Pasar a "${this.clave}" exige indicar el motivo (mínimo 5 caracteres).`
    }

    /**
     * Intenta la transición. Si no es legal, explica exactamente qué se puede
     * hacer desde aquí — ese mensaje ya no se construye en el servicio.
     */
    transicionarA(clave, motivo = null) {
        if (!this.puedeIrA(clave)) {
            throw new ReglaNegocioError(
                `No se puede pasar de "${this.clave}" a "${clave}". ` +
                    (this.esFinal()
                        ? `"${this.clave}" es un estado final.`
                        : `Desde "${this.clave}" solo se puede ir a: ${this.siguientes().join(', ')}.`),
            )
        }

        const destino = EstadoEntregable.desde(clave)

        if (destino.exigeMotivo() && (!motivo || motivo.trim().length < 5)) {
            throw new ValidacionError(destino.mensajeMotivo(), { campo: 'motivo' })
        }

        return destino
    }

    // FACTORY METHOD (GoF) — el que decide la clase concreta a instanciar.
    // Los servicios nunca hacen `new EstadoAprobado()`: piden el estado por
    // su clave y esta función elige la implementación.
    static desde(clave) {
        const Clase = EstadoEntregable.registro.get(clave)
        if (!Clase) {
            throw new ReglaNegocioError(
                `Estado de entregable desconocido: "${clave}". ` +
                    `Los válidos son: ${EstadoEntregable.claves().join(', ')}.`,
            )
        }
        return new Clase()
    }

    static claves() {
        return [...EstadoEntregable.registro.keys()]
    }

    static inicial() {
        return new EstadoPendiente()
    }
}

// RECIÉN CREADO: solo puede entregarse.
export class EstadoPendiente extends EstadoEntregable {
    static clave = 'pendiente'

    siguientes() {
        return ['entregado']
    }

    permiteEdicion() {
        return true
    }
}

// ENTREGADO AL CLIENTE: espera veredicto.
export class EstadoEntregado extends EstadoEntregable {
    static clave = 'entregado'

    siguientes() {
        return ['aprobado', 'rechazado']
    }
}

// APROBADO: cuenta para el avance y es historia, ya no se toca.
export class EstadoAprobado extends EstadoEntregable {
    static clave = 'aprobado'

    siguientes() {
        return []
    }

    cuentaParaAvance() {
        return true
    }

    permiteEliminacion() {
        return false
    }
}

// RECHAZADO: vuelve a manos del freelancer, que puede corregir y reentregar.
export class EstadoRechazado extends EstadoEntregable {
    static clave = 'rechazado'

    siguientes() {
        return ['entregado']
    }

    permiteEdicion() {
        return true
    }

    exigeMotivo() {
        return true
    }

    mensajeMotivo() {
        return 'Debes indicar el motivo del rechazo (mínimo 5 caracteres).'
    }
}

// REGISTRO: el único sitio que conoce todas las implementaciones.
// Añadir un estado nuevo es añadir una línea aquí (OCP).
EstadoEntregable.registro = new Map([
    [EstadoPendiente.clave, EstadoPendiente],
    [EstadoEntregado.clave, EstadoEntregado],
    [EstadoAprobado.clave, EstadoAprobado],
    [EstadoRechazado.clave, EstadoRechazado],
])
