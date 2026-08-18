import { aFechaLocal } from '../utils/formato.js'

// REGLAS DE NEGOCIO PARA PROYECTOS
export class ProyectoService {
    constructor(proyectoRepositorio, clienteRepositorio, entregableRepositorio) {
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.entregables = entregableRepositorio
    }

    async listar(estado) {
        return estado ? this.proyectos.listarPorEstado(estado) : this.proyectos.listar()
    }

    /** Solo los activos: los únicos que admiten avances, entregables o cierre. */
    async listarActivos() {
        return this.proyectos.listarPorEstado('activo')
    }

    // Devuelve el proyecto con el nombre del cliente incorporado.
    async verFicha(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        const cliente = await this.clientes.buscarPorId(String(proyecto.clienteId))
        return { ...proyecto, cliente }
    }

    // Edita los datos descriptivos de un proyecto.
    async editar(referencia, cambios) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto está ${proyecto.estado}: ya no se puede editar.`)
        }

        const nombre = cambios.nombre ?? proyecto.nombre
        if (!nombre || nombre.trim().length < 5) {
            throw new Error('El nombre del proyecto es obligatorio (mínimo 5 caracteres).')
        }

        const actualizacion = {
            nombre: nombre.trim(),
            descripcion:
                cambios.descripcion === undefined
                    ? proyecto.descripcion
                    : cambios.descripcion?.trim() || null,
            actualizadoEn: new Date(),
        }

        if (cambios.fechaFinEstimada) {
            const nueva = aFechaLocal(cambios.fechaFinEstimada)
            if (nueva < new Date(proyecto.fechaInicio)) {
                throw new Error('La fecha de fin no puede ser anterior al inicio del proyecto.')
            }
            actualizacion.fechaFinEstimada = nueva
        }

        await this.proyectos.actualizar(proyecto._id, actualizacion)
        return { ...proyecto, ...actualizacion }
    }

    //  REGLAS del avance:
    //  entre 0 y 100
    //  no puede retroceder (un trabajo hecho no se deshace)
    //  no se registran avances en proyectos cerrados
    //  si el proyecto tiene entregables, el avance NO se toca a mano
    async registrarAvance(referencia, porcentaje) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto está ${proyecto.estado}: no admite avances.`)
        }

        const entregables = await this.entregables.listarPorProyecto(proyecto._id)
        if (entregables.length > 0) {
            throw new Error(
                'Este proyecto tiene entregables: el avance se calcula solo al ' +
                    'aprobarlos. Ve al menú de Entregables.',
            )
        }

        const nuevo = Number(porcentaje)
        if (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 100) {
            throw new Error('El avance debe ser un número entre 0 y 100.')
        }
        if (nuevo < proyecto.avance) {
            throw new Error(`El avance no puede retroceder (actual: ${proyecto.avance}%).`)
        }

        await this.proyectos.actualizar(proyecto._id, { avance: nuevo, actualizadoEn: new Date() })
        return { ...proyecto, avance: nuevo }
    }

    // REGLA: FINALIZAR PROYECTO COMPLETO
    async finalizar(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto ya está ${proyecto.estado}.`)
        }
        if (proyecto.avance < 100) {
            throw new Error(
                `No puedes finalizar un proyecto al ${proyecto.avance}%. ` +
                    'Registra primero el avance al 100%.',
            )
        }

        await this.proyectos.actualizar(proyecto._id, {
            estado: 'finalizado',
            finalizadoEn: new Date(),
        })
        return proyecto
    }

    async cancelar(referencia, motivo) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto ya está ${proyecto.estado}.`)
        }
        if (!motivo || motivo.trim().length < 5) {
            throw new Error('Debes indicar el motivo de la cancelación (mínimo 5 caracteres).')
        }

        await this.proyectos.actualizar(proyecto._id, {
            estado: 'cancelado',
            motivoCancelacion: motivo.trim(),
            canceladoEn: new Date(),
        })
        return proyecto
    }
}
