import { NoEncontradoError, ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { Contrato } from '../models/Contrato.js'
import { Propuesta } from '../models/Propuesta.js'
import { Proyecto } from '../models/Proyecto.js'

// REGLAS DE NEGOCIO PARA PROPUESTAS
export class PropuestaService {
    constructor(
        propuestaRepositorio,
        proyectoRepositorio,
        contratoRepositorio,
        clienteRepositorio,
        unidadDeTrabajo,
    ) {
        this.propuestas = propuestaRepositorio
        this.proyectos = proyectoRepositorio
        this.contratos = contratoRepositorio
        this.clientes = clienteRepositorio
        this.unidadDeTrabajo = unidadDeTrabajo
    }

    async #exigir(referencia, contexto) {
        const propuesta = await this.propuestas.buscarPorIdOCodigo(referencia, contexto)
        if (!propuesta) throw new NoEncontradoError('propuesta', referencia, { femenino: true })
        return propuesta
    }

    /** REGLA: la propuesta debe ir a un cliente que exista y esté activo. */
    async crear(datos) {
        const cliente = await this.clientes.buscarPorIdOCodigo(datos.clienteId)
        if (!cliente) throw new NoEncontradoError('cliente', datos.clienteId)
        if (!cliente.activo) {
            throw new ReglaNegocioError(`El cliente "${cliente.nombre}" está desactivado.`)
        }

        const propuesta = new Propuesta({ ...datos, clienteId: cliente._id })
        propuesta.validar()

        propuesta.codigo = await this.propuestas.siguienteCodigo('PRO')
        await this.propuestas.crear(propuesta.aDocumento())
        return propuesta.codigo
    }

    async listar(estado) {
        return estado ? this.propuestas.listarPorEstado(estado) : this.propuestas.listar()
    }

    async listarPendientes() {
        return this.propuestas.listarPorEstado('pendiente')
    }

    async listarClientesDisponibles() {
        return this.clientes.listar({ activo: true })
    }

    /**
     * ACEPTAR: la operación estrella. Toca TRES colecciones y las tres
     * tienen que cuadrar o no pasa nada. La atomicidad la garantiza la
     * unidad de trabajo; este servicio ya no sabe qué es una sesión de Mongo.
     */
    async aceptar(propuestaId) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const propuesta = await this.#exigir(propuestaId, contexto)

            if (propuesta.estado !== 'pendiente') {
                throw new ReglaNegocioError(
                    `La propuesta ${propuesta.codigo} ya está ${propuesta.estado}. ` +
                        'Solo se pueden aceptar propuestas pendientes.',
                )
            }

            // PASO 1: marcar la propuesta como aceptada
            await this.propuestas.actualizar(
                propuesta._id,
                { estado: 'aceptada', aceptadaEn: new Date() },
                contexto,
            )

            // PASO 2: crear el proyecto a partir de la propuesta (Factory Method)
            const codigo = await this.proyectos.siguienteCodigo('PRY', contexto)
            const proyecto = Proyecto.desdePropuesta(propuesta, codigo)
            proyecto.validar()

            const proyectoId = await this.proyectos.crear(proyecto.aDocumento(), contexto)

            // PASO 3: crear el contrato en borrador (Factory Method)
            const codigoContrato = await this.contratos.siguienteCodigo('CON', contexto)
            const contrato = Contrato.desdeProyecto(proyecto, proyectoId, codigoContrato)
            contrato.validar()
            await this.contratos.crear(contrato.aDocumento(), contexto)

            return {
                _id: proyectoId,
                codigo,
                nombre: proyecto.nombre,
                codigoContrato,
            }
        })
    }

    // EDITAR — solo las pendientes, y validando el modelo completo.
    async editar(referencia, cambios) {
        const documento = await this.#exigir(referencia)
        const actual = Propuesta.desdeDocumento(documento)

        if (!actual.puedeEditarse()) {
            throw new ReglaNegocioError(
                `La propuesta ${documento.codigo} está ${documento.estado}: ya no se puede editar. ` +
                    'Solo se editan las pendientes.',
            )
        }

        const editada = Propuesta.desdeDocumento(documento, {
            titulo: cambios.titulo,
            descripcion: cambios.descripcion,
            monto: cambios.monto,
            plazoDias: cambios.plazoDias,
        })
        editada.validar()

        const actualizada = editada.aDocumento()

        await this.propuestas.actualizar(documento._id, {
            titulo: actualizada.titulo,
            descripcion: actualizada.descripcion,
            monto: actualizada.monto,
            plazoDias: actualizada.plazoDias,
            actualizadoEn: new Date(),
        })

        return { ...documento, ...actualizada }
    }

    async rechazar(propuestaId, motivo) {
        const propuesta = await this.#exigir(propuestaId)

        if (propuesta.estado !== 'pendiente') {
            throw new ReglaNegocioError(`La propuesta ${propuesta.codigo} ya está ${propuesta.estado}.`)
        }
        if (!motivo || motivo.trim().length < 5) {
            throw new ValidacionError('Debes indicar el motivo del rechazo (mínimo 5 caracteres).', {
                campo: 'motivo',
            })
        }

        await this.propuestas.actualizar(propuesta._id, {
            estado: 'rechazada',
            motivoRechazo: motivo.trim(),
            rechazadaEn: new Date(),
        })

        return propuesta
    }

    async estadisticas() {
        const total = await this.propuestas.contar()
        const aceptadas = await this.propuestas.contar({ estado: 'aceptada' })
        const rechazadas = await this.propuestas.contar({ estado: 'rechazada' })
        const pendientes = await this.propuestas.contar({ estado: 'pendiente' })

        return {
            total,
            aceptadas,
            rechazadas,
            pendientes,
            conversion: total === 0 ? 0 : Math.round((aceptadas / total) * 100),
        }
    }
}
