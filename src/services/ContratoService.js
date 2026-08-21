import { NoEncontradoError, ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { Contrato } from '../models/Contrato.js'

// REGLAS DE NEGOCIO PARA CONTRATOS
export class ContratoService {
    constructor(contratoRepositorio, proyectoRepositorio, clienteRepositorio, unidadDeTrabajo) {
        this.contratos = contratoRepositorio
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.unidadDeTrabajo = unidadDeTrabajo
    }

    async #exigir(referencia, contexto) {
        const contrato = await this.contratos.buscarPorIdOCodigo(referencia, contexto)
        if (!contrato) throw new NoEncontradoError('contrato', referencia)
        return contrato
    }

    async listar(estado) {
        return estado ? this.contratos.listarPorEstado(estado) : this.contratos.listar()
    }

    async listarBorradores() {
        return this.contratos.listarPorEstado('borrador')
    }

    async listarProyectos() {
        return this.proyectos.listar()
    }

    /** El contrato de un proyecto. Es una relación 1:1. */
    async verPorProyecto(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new NoEncontradoError('proyecto', referencia)

        const contrato = await this.contratos.buscarPorProyecto(proyecto._id)
        if (!contrato) throw new ReglaNegocioError('Ese proyecto todavía no tiene contrato.')

        return contrato
    }

    // EDITAR — solo los borradores, y validando el modelo completo.
    async editar(referencia, { condiciones, formaPago, valor }) {
        const documento = await this.#exigir(referencia)
        const actual = Contrato.desdeDocumento(documento)

        if (!actual.puedeEditarse()) {
            throw new ReglaNegocioError(
                `El contrato ${documento.codigo} está ${documento.estado}: ya no se puede editar.`,
            )
        }

        const hayCambios =
            condiciones?.trim() || formaPago?.trim() || (valor !== undefined && valor !== null)
        if (!hayCambios) throw new ValidacionError('No indicaste ningún cambio.')

        // Se reconstruye y se valida entero: antes solo se comprobaba el valor.
        const editado = Contrato.desdeDocumento(documento, {
            condiciones: condiciones?.trim() || undefined,
            formaPago: formaPago?.trim() || undefined,
            valor: valor === undefined || valor === null ? undefined : Number(valor),
        })
        editado.validar()

        const cambios = {
            condiciones: editado.condiciones,
            formaPago: editado.formaPago,
            valor: editado.valor,
            actualizadoEn: new Date(),
        }

        await this.contratos.actualizar(documento._id, cambios)
        return { ...documento, ...cambios }
    }

    // FIRMAR — atómico: activa el contrato y sincroniza el proyecto.
    async firmar(referencia) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const documento = await this.#exigir(referencia, contexto)
            const contrato = Contrato.desdeDocumento(documento)

            if (contrato.estado !== 'borrador') {
                throw new ReglaNegocioError(
                    `El contrato ${documento.codigo} ya está ${documento.estado}.`,
                )
            }
            // La pregunta la responde el modelo, no un startsWith() suelto.
            if (!contrato.tieneCondicionesRedactadas()) {
                throw new ReglaNegocioError(
                    'Redacta las condiciones antes de firmar el contrato.',
                )
            }

            const firmadoEn = new Date()

            // Paso 1: activar el contrato
            await this.contratos.actualizar(
                documento._id,
                { estado: 'activo', firmadoEn },
                contexto,
            )

            // Paso 2: sincronizar el proyecto
            await this.proyectos.actualizar(
                String(documento.proyectoId),
                { contratoFirmado: true, contratoFirmadoEn: firmadoEn },
                contexto,
            )

            return { ...documento, estado: 'activo', firmadoEn }
        })
    }

    /**
     * Reúne los datos del contrato con su cliente y su proyecto.
     *
     * Antes este método devolvía el documento ya MAQUETADO, con sus rayas y
     * su dinero formateado. Eso era presentación dentro de la capa de negocio
     * (y obligaba al servicio a importar utils/formato.js). Ahora devuelve
     * datos; quien los pinta es commands/contratos.js.
     */
    async datosParaDocumento(referencia) {
        const contrato = await this.#exigir(referencia)

        const cliente = await this.clientes.buscarPorId(String(contrato.clienteId))
        const proyecto = await this.proyectos.buscarPorId(String(contrato.proyectoId))

        return { contrato, cliente, proyecto }
    }
}
