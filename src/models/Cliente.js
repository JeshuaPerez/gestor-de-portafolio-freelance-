// POO: MODELO CLIENTE

export class Cliente {
    constructor({ nombre, email, empresa, telefono, activo = true }) {
        this.codigo = null
        this.nombre = nombre
        this.email = email
        this.empresa = empresa
        this.telefono = telefono
        this.activo = activo 
        this.creadoEn = new Date()
    }

    //VALIDA LOS CAMPOS. SI ALGO ESTÁ MAL, LANZA UN ERROR CON EL MOTIVO.
     
    validar() {
        if (!this.nombre || this.nombre.trim().length < 3) {
            throw new Error('El nombre es obligatorio (mínimo 3 caracteres).')
        }

        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!formatoEmail.test(this.email ?? '')) {
            throw new Error('El email no tiene un formato válido.')
        }

        if (this.telefono && this.telefono.replace(/\D/g, '').length < 7) {
            throw new Error('El teléfono debe tener al menos 7 dígitos.')
        }
    }

    // CONVIERTE LA instancia EN UN OBJETO plano PARA GUARDARLO EN MONGODB.
    aDocumento() {
        return {
            codigo: this.codigo,
            nombre: this.nombre.trim(),
            email: this.email.trim().toLowerCase(), 
            empresa: this.empresa?.trim() || null,
            telefono: this.telefono?.trim() || null,
            activo: this.activo,
            creadoEn: this.creadoEn,
        }
    }
}
