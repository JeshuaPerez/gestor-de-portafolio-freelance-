import { Modelo } from './Modelo.js'

// MODELO CLIENTE
export class Cliente extends Modelo {
    static entidad = 'cliente'

    // ÚNICA FUENTE DE VERDAD de lo que es un cliente válido.
    // De aquí salen la validación en memoria, el $jsonSchema de MongoDB y
    // los límites que la consola le enseña al usuario.
    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        nombre: { tipo: 'texto', min: 3, max: 120, etiqueta: 'nombre' },
        email: { tipo: 'email', etiqueta: 'email' },
        empresa: { tipo: 'texto', max: 120, opcional: true, etiqueta: 'empresa' },
        telefono: { tipo: 'telefono', minimoDigitos: 7, opcional: true, etiqueta: 'teléfono' },
        activo: { tipo: 'booleano', etiqueta: 'estado de actividad' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de alta' },
    }

    constructor({ codigo = null, nombre, email, empresa, telefono, activo = true, creadoEn }) {
        super()
        this.codigo = codigo
        // La limpieza ocurre AQUÍ, antes de validar: así " ana " y "ana" son
        // lo mismo tanto para la validación como para lo que se guarda.
        this.nombre = nombre?.trim() || null
        this.email = email?.trim().toLowerCase() || null
        this.empresa = empresa?.trim() || null
        this.telefono = telefono?.trim() || null
        this.activo = activo
        this.creadoEn = creadoEn ?? new Date()
    }
}
