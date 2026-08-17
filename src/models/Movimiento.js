import { aFechaLocal, redondearDinero } from '../utils/formato.js'

/**
 * POO: MODELO Movimiento (finanzas).
 *
 * Un movimiento es un ingreso (te pagan) o un egreso (gastas). Es la parte
 * más delicada del sistema: si se duplica un cobro, tu contabilidad miente.
 */
export class Movimiento {
    static TIPOS = ['ingreso', 'egreso']

    /**
     * Cada tipo tiene sus propias categorías. Un ingreso no puede ser
     * "licencias", y un egreso no puede ser "anticipo".
     */
    static CATEGORIAS = {
        ingreso: ['anticipo', 'pago_parcial', 'pago_final', 'bonificacion'],
        egreso: ['herramientas', 'licencias', 'servicios', 'impuestos', 'otros'],
    }

    constructor({ proyectoId, clienteId, tipo, categoria, concepto, monto, referencia, fecha }) {
        // MOV-0001. Ojo: NO confundir con `referencia`, que es el número de
        // factura que pone el usuario. El código lo genera el sistema.
        this.codigo = null
        this.proyectoId = proyectoId
        this.clienteId = clienteId
        this.tipo = tipo?.trim().toLowerCase()
        this.categoria = categoria?.trim().toLowerCase()
        this.concepto = concepto
        // Redondeado a centavos desde la puerta de entrada: el dinero no
        // tiene más de dos decimales, y así no se cuela un 0.30000000004.
        this.monto = redondearDinero(monto)
        // La referencia es el número de la factura o del comprobante bancario.
        // Es lo que impide registrar dos veces el mismo pago.
        this.referencia = referencia?.trim().toUpperCase()
        this.fecha = fecha ? aFechaLocal(fecha) : new Date()
        this.anulado = false
        this.creadoEn = new Date()
    }

    validar() {
        if (!this.proyectoId) throw new Error('El movimiento debe pertenecer a un proyecto.')

        if (!Movimiento.TIPOS.includes(this.tipo)) {
            throw new Error(`El tipo debe ser: ${Movimiento.TIPOS.join(' o ')}.`)
        }

        // REGLA CRUZADA: la categoría depende del tipo. Este tipo de
        // validación (un campo que depende de otro) es la que más se olvida.
        const permitidas = Movimiento.CATEGORIAS[this.tipo]
        if (!permitidas.includes(this.categoria)) {
            throw new Error(
                `Categoría no válida para un ${this.tipo}. Opciones: ${permitidas.join(', ')}.`,
            )
        }

        if (!this.concepto || this.concepto.trim().length < 3) {
            throw new Error('El concepto es obligatorio (mínimo 3 caracteres).')
        }
        if (!Number.isFinite(this.monto) || this.monto <= 0) {
            throw new Error('El monto debe ser un número mayor que 0.')
        }
        if (!this.referencia || this.referencia.length < 3) {
            throw new Error('La referencia es obligatoria (nº de factura o comprobante).')
        }
        if (Number.isNaN(this.fecha.getTime())) {
            throw new Error('La fecha no es válida. Usa el formato AAAA-MM-DD.')
        }
    }

    aDocumento() {
        return {
            codigo: this.codigo,
            proyectoId: this.proyectoId,
            clienteId: this.clienteId,
            tipo: this.tipo,
            categoria: this.categoria,
            concepto: this.concepto.trim(),
            monto: this.monto,
            referencia: this.referencia,
            fecha: this.fecha,
            anulado: this.anulado,
            creadoEn: this.creadoEn,
        }
    }
}
