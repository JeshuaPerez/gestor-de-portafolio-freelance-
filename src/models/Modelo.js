import { soloDefinidos } from '../dominio/valores.js'
import { aEsquemaMongo, validarContra } from '../validacion/reglas.js'

// BASE DE TODOS LOS MODELOS (Template Method)
//
// Los seis modelos repetían la misma estructura: un `validar()` con ifs a
// mano y un `aDocumento()` copiando campo por campo. Aquí queda el esqueleto
// una sola vez; cada modelo solo declara sus REGLAS y, si las tiene, sus
// comprobaciones entre campos.
export class Modelo {
    static REGLAS = {}
    static entidad = 'registro'

    /**
     * Comprueba el modelo contra sus reglas y luego llama al gancho de reglas
     * propias. Este es el ÚNICO validar() del proyecto: crear y editar pasan
     * los dos por aquí, así que ya no puede haber una edición que se salte
     * una regla del alta.
     */
    validar() {
        validarContra(this, this.constructor.REGLAS, this.constructor.entidad)
        this.validarReglasPropias()
        return this
    }

    /** Gancho: comprobaciones que cruzan dos campos. Por defecto, ninguna. */
    validarReglasPropias() {}

    /** El $jsonSchema que MongoDB aplicará a la colección. */
    static esquemaMongo() {
        return aEsquemaMongo(this.REGLAS)
    }

    /**
     * Reconstruye el modelo desde un documento de MongoDB, con cambios encima.
     * Es la pieza que hace que EDITAR valide exactamente igual que CREAR.
     */
    static desdeDocumento(documento, cambios = {}) {
        return new this({ ...documento, ...soloDefinidos(cambios) })
    }

    /** Objeto plano para MongoDB: solo los campos declarados en REGLAS. */
    aDocumento() {
        const documento = {}
        for (const campo of Object.keys(this.constructor.REGLAS)) {
            documento[campo] = this[campo] === undefined ? null : this[campo]
        }
        return documento
    }
}
