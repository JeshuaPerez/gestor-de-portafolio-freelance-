/**
 * POO: MODELO Cliente
 *
 * En tu app.js el usuario era un objeto literal:
 *     const user = { name, email, age, ... }
 * Un objeto así solo guarda datos: no sabe si está bien o mal formado.
 *
 * Una CLASE junta los datos con su comportamiento. Este Cliente sabe
 * validarse a sí mismo antes de que nadie intente guardarlo.
 */
export class Cliente {
    constructor({ nombre, email, empresa, telefono, activo = true }) {
        // El código legible (CLI-0001) lo asigna el servicio justo antes de
        // guardar, porque generarlo exige hablar con la base de datos y un
        // modelo no debe saber que MongoDB existe.
        this.codigo = null
        this.nombre = nombre
        this.email = email
        this.empresa = empresa
        this.telefono = telefono
        this.activo = activo // los clientes no se borran, se desactivan
        this.creadoEn = new Date()
    }

    /**
     * Valida los campos. Si algo está mal, lanza un error con el motivo.
     *
     * Buena práctica: validar ANTES de tocar la base de datos. Es más rápido
     * y el mensaje de error es mucho más claro para el usuario que el que
     * devolvería MongoDB.
     */
    validar() {
        if (!this.nombre || this.nombre.trim().length < 3) {
            throw new Error('El nombre es obligatorio (mínimo 3 caracteres).')
        }

        // Validación de email suficiente para este proyecto:
        // algo@algo.algo, sin espacios.
        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!formatoEmail.test(this.email ?? '')) {
            throw new Error('El email no tiene un formato válido.')
        }

        // El teléfono es opcional, pero si lo escriben debe tener sentido.
        if (this.telefono && this.telefono.replace(/\D/g, '').length < 7) {
            throw new Error('El teléfono debe tener al menos 7 dígitos.')
        }
    }

    /**
     * Convierte la instancia en un objeto plano para guardarlo en MongoDB.
     *
     * ¿Por qué no guardar `this` directamente? Porque así controlamos
     * exactamente qué campos van a la base de datos. Si mañana añadimos una
     * propiedad temporal a la clase, no se cuela sin querer en Mongo.
     */
    aDocumento() {
        return {
            codigo: this.codigo,
            nombre: this.nombre.trim(),
            email: this.email.trim().toLowerCase(), // normalizamos: evita duplicados por mayúsculas
            empresa: this.empresa?.trim() || null,
            telefono: this.telefono?.trim() || null,
            activo: this.activo,
            creadoEn: this.creadoEn,
        }
    }
}
