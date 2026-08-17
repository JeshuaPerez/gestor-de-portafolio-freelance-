import { formatearDinero, formatearFecha } from '../utils/formato.js'

/**
 * Reglas de negocio de los contratos.
 *
 * El contrato no se crea aquí: nace en borrador dentro de la transacción de
 * PropuestaService.aceptar(). Este servicio lo edita, lo firma y lo imprime.
 */
export class ContratoService {
    constructor(contratoRepositorio, proyectoRepositorio, clienteRepositorio, mongoClient) {
        this.contratos = contratoRepositorio
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.mongoClient = mongoClient
    }

    async listar(estado) {
        return estado ? this.contratos.listarPorEstado(estado) : this.contratos.listar()
    }

    /** Los borradores: los únicos editables y los únicos firmables. */
    async listarBorradores() {
        return this.contratos.listarPorEstado('borrador')
    }

    /** Para la lista de elegir cuando se busca el contrato de un proyecto. */
    async listarProyectos() {
        return this.proyectos.listar()
    }

    async verPorProyecto(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        const contrato = await this.contratos.buscarPorProyecto(proyecto._id)
        if (!contrato) throw new Error('Ese proyecto todavía no tiene contrato.')

        return contrato
    }

    /**
     * REGLA: solo los borradores son editables. Un contrato firmado no se toca.
     *
     * El valor SÍ se puede corregir mientras sea borrador — es el precio que
     * todavía se está negociando. Una vez firmado, el contrato es el
     * documento que vale y cambiarlo por detrás no tendría sentido.
     */
    async editar(referencia, { condiciones, formaPago, valor }) {
        const contrato = await this.contratos.buscarPorIdOCodigo(referencia)
        if (!contrato) throw new Error(`No existe ningún contrato con la referencia "${referencia}".`)

        if (contrato.estado !== 'borrador') {
            throw new Error(
                `El contrato ${contrato.codigo} está ${contrato.estado}: ya no se puede editar.`,
            )
        }

        const cambios = {}
        if (condiciones?.trim()) cambios.condiciones = condiciones.trim()
        if (formaPago?.trim()) cambios.formaPago = formaPago.trim()

        if (valor !== undefined && valor !== null) {
            const monto = Number(valor)
            if (!Number.isFinite(monto) || monto <= 0) {
                throw new Error('El valor del contrato debe ser un número mayor que 0.')
            }
            cambios.valor = monto
        }

        if (Object.keys(cambios).length === 0) {
            throw new Error('No indicaste ningún cambio.')
        }

        await this.contratos.actualizar(contrato._id, cambios)
        return { ...contrato, ...cambios }
    }

    /**
     * ⭐ FIRMAR CONTRATO — OPERACIÓN TRANSACCIONAL
     *
     * Al firmar pasan dos cosas en dos colecciones:
     *   1. el contrato pasa de 'borrador' a 'activo'  (contratos)
     *   2. el proyecto queda marcado como formalizado (proyectos)
     *
     * Si solo se guardara el paso 1, tendrías un contrato firmado sobre un
     * proyecto que no sabe que lo está. Por eso van juntos.
     */
    async firmar(referencia) {
        const session = this.mongoClient.startSession()

        try {
            let contratoFirmado = null

            await session.withTransaction(async () => {
                const contrato = await this.contratos.buscarPorIdOCodigo(referencia, session)
                if (!contrato) {
                    throw new Error(`No existe ningún contrato con la referencia "${referencia}".`)
                }

                if (contrato.estado !== 'borrador') {
                    throw new Error(`El contrato ${contrato.codigo} ya está ${contrato.estado}.`)
                }
                if (!contrato.condiciones || contrato.condiciones.startsWith('Condiciones pend')) {
                    throw new Error('Redacta las condiciones antes de firmar el contrato.')
                }

                const firmadoEn = new Date()

                // Paso 1: activar el contrato
                await this.contratos.actualizar(
                    contrato._id,
                    { estado: 'activo', firmadoEn },
                    session,
                )

                // Paso 2: sincronizar el proyecto
                await this.proyectos.actualizar(
                    String(contrato.proyectoId),
                    { contratoFirmado: true, contratoFirmadoEn: firmadoEn },
                    session,
                )

                contratoFirmado = { ...contrato, estado: 'activo', firmadoEn }
            })

            return contratoFirmado
        } finally {
            await session.endSession()
        }
    }

    /** Genera el texto del contrato para copiarlo o imprimirlo. */
    async generarDocumento(referencia) {
        const contrato = await this.contratos.buscarPorIdOCodigo(referencia)
        if (!contrato) throw new Error(`No existe ningún contrato con la referencia "${referencia}".`)

        const cliente = await this.clientes.buscarPorId(String(contrato.clienteId))
        const proyecto = await this.proyectos.buscarPorId(String(contrato.proyectoId))

        return [
            '='.repeat(64),
            `  CONTRATO DE PRESTACIÓN DE SERVICIOS  ·  ${contrato.codigo}`,
            '='.repeat(64),
            '',
            `  CLIENTE:   ${cliente?.nombre ?? '(no encontrado)'}`,
            `  EMPRESA:   ${cliente?.empresa ?? '-'}`,
            `  PROYECTO:  ${proyecto?.nombre ?? '(no encontrado)'}`,
            '',
            `  VALOR:     ${formatearDinero(contrato.valor)}`,
            `  PAGO:      ${contrato.formaPago}`,
            `  VIGENCIA:  ${formatearFecha(contrato.fechaInicio)} al ${formatearFecha(contrato.fechaFin)}`,
            '',
            '  CONDICIONES:',
            `  ${contrato.condiciones}`,
            '',
            `  ESTADO:    ${contrato.estado.toUpperCase()}`,
            `  FIRMADO:   ${contrato.firmadoEn ? formatearFecha(contrato.firmadoEn) : 'SIN FIRMAR'}`,
            '='.repeat(64),
        ].join('\n')
    }
}
