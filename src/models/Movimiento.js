import { aFechaLocal, redondearDinero } from '../dominio/valores.js'
import { ValidacionError } from '../errors/errores.js'
import { Modelo } from './Modelo.js'

// MODELO MOVIMIENTO (finanzas)
export class Movimiento extends Modelo {
    static entidad = 'movimiento'
    static TIPOS = ['ingreso', 'egreso']

    static CATEGORIAS = {
        ingreso: ['anticipo', 'pago_parcial', 'pago_final', 'bonificacion'],
        egreso: ['herramientas', 'licencias', 'servicios', 'impuestos', 'otros'],
    }

    /** Todas las categorías juntas: es lo que el esquema de Mongo puede exigir. */
    static TODAS_LAS_CATEGORIAS = [
        ...Movimiento.CATEGORIAS.ingreso,
        ...Movimiento.CATEGORIAS.egreso,
    ]

    static REGLAS = {
        codigo: { tipo: 'texto', min: 7, max: 12, asignadoAlGuardar: true, etiqueta: 'código' },
        proyectoId: { tipo: 'id', etiqueta: 'proyecto' },
        clienteId: { tipo: 'id', etiqueta: 'cliente' },
        tipo: { tipo: 'lista', valores: Movimiento.TIPOS, etiqueta: 'tipo' },
        // El esquema solo puede comprobar que la categoría existe; que además
        // CORRESPONDA al tipo se comprueba en validarReglasPropias().
        categoria: {
            tipo: 'lista',
            valores: Movimiento.TODAS_LAS_CATEGORIAS,
            etiqueta: 'categoría',
        },
        concepto: { tipo: 'texto', min: 3, max: 300, etiqueta: 'concepto' },
        monto: { tipo: 'numero', min: 0.01, max: 99999999, etiqueta: 'monto' },
        referencia: { tipo: 'texto', min: 3, max: 60, etiqueta: 'referencia' },
        fecha: { tipo: 'fecha', etiqueta: 'fecha' },
        anulado: { tipo: 'booleano', etiqueta: 'anulado' },
        creadoEn: { tipo: 'fecha', etiqueta: 'fecha de registro' },
    }

    constructor({
        proyectoId,
        clienteId,
        codigo = null,
        tipo,
        categoria,
        concepto,
        monto,
        referencia,
        fecha,
        anulado = false,
        creadoEn,
    }) {
        super()
        this.codigo = codigo
        this.proyectoId = proyectoId
        this.clienteId = clienteId
        this.tipo = tipo?.trim().toLowerCase() || null
        this.categoria = categoria?.trim().toLowerCase() || null
        this.concepto = concepto?.trim() || null
        this.monto = redondearDinero(monto)
        this.referencia = referencia?.trim().toUpperCase() || null
        this.fecha = fecha ? aFechaLocal(fecha) : new Date()
        this.anulado = anulado
        this.creadoEn = creadoEn ?? new Date()
    }

    /**
     * Regla que cruza dos campos: "licencias" es una categoría válida, pero
     * no para un ingreso. Eso no lo puede expresar una regla suelta.
     */
    validarReglasPropias() {
        const permitidas = Movimiento.CATEGORIAS[this.tipo] ?? []
        if (!permitidas.includes(this.categoria)) {
            throw new ValidacionError(
                `Categoría no válida para un ${this.tipo}: "${this.categoria}" no está ` +
                    `permitida. Opciones: ${permitidas.join(', ')}.`,
                { campo: 'categoria' },
            )
        }
    }

    esIngreso() {
        return this.tipo === 'ingreso'
    }

    /** Sobre qué acumulado del proyecto impacta este movimiento. */
    campoAcumulado() {
        return this.esIngreso() ? 'cobrado' : 'gastado'
    }
}
