// JERARQUÍA DE ERRORES DE LA APLICACIÓN
//
// Antes todo era `new Error(...)`: un fallo de validación, una regla de
// negocio rota y un error del driver de MongoDB llegaban a la consola
// exactamente iguales. Con estas clases cada capa lanza el error que le
// corresponde y la presentación puede tratarlos distinto.

export class AppError extends Error {
    constructor(mensaje, { campo = null, causa = null } = {}) {
        super(mensaje)
        this.name = new.target.name
        this.campo = campo
        this.causa = causa
        // Marca que distingue "error esperado del dominio" de "algo se rompió".
        this.esDelDominio = true
        Error.captureStackTrace?.(this, new.target)
    }
}

// El dato que entró no cumple la forma exigida (longitud, tipo, rango...).
export class ValidacionError extends AppError {
    constructor(mensaje, { campo = null, detalles = [] } = {}) {
        super(mensaje, { campo })
        this.detalles = detalles
    }

    // Junta varios fallos en un solo error legible.
    static desdeLista(entidad, detalles) {
        const cuerpo = detalles.map((d) => `  · ${d.mensaje}`).join('\n')
        return new ValidacionError(`El ${entidad} no es válido:\n${cuerpo}`, { detalles })
    }
}

// La forma del dato es correcta, pero la operación viola una regla del negocio.
export class ReglaNegocioError extends AppError {}

// Se pidió algo que no está en la base de datos.
export class NoEncontradoError extends AppError {
    constructor(entidad, referencia, { femenino = false } = {}) {
        const articulo = femenino ? 'ninguna' : 'ningún'
        super(`No existe ${articulo} ${entidad} con la referencia "${referencia}".`)
        this.entidad = entidad
        this.referencia = referencia
    }
}

// Choque con algo que ya existe: un email repetido, una referencia duplicada.
export class ConflictoError extends AppError {}

// El usuario abortó la operación escribiendo "cancelar".
export class OperacionCancelada extends AppError {
    constructor() {
        super('Operación cancelada.')
    }
}
