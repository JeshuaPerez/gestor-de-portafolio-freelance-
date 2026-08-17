import { aFechaLocal } from '../utils/formato.js'

/**
 * Reglas de negocio de los proyectos.
 *
 * Un proyecto no se crea desde aquí: nace de una propuesta aceptada
 * (ver PropuestaService.aceptar). Este servicio gestiona su ciclo de vida.
 */
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

    /**
     * Devuelve el proyecto con el nombre del cliente incorporado.
     *
     * En Mongo los datos están separados: el proyecto guarda `clienteId`, no
     * el nombre. Aquí hacemos la segunda consulta para mostrarlo.
     */
    async verFicha(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        const cliente = await this.clientes.buscarPorId(String(proyecto.clienteId))
        return { ...proyecto, cliente }
    }

    /**
     * Edita los datos descriptivos de un proyecto.
     *
     * SOLO nombre, descripción y fecha de fin prevista, y solo mientras esté
     * ACTIVO.
     *
     * ¿POR QUÉ NO SE PUEDE EDITAR EL MONTO AQUÍ? Porque el monto no es un
     * dato del proyecto: viene de la propuesta que el cliente aceptó y del
     * contrato que se firmó. Cambiarlo por detrás dejaría el contrato
     * diciendo una cifra y el proyecto otra, y además movería el saldo
     * pendiente sobre el que se calculan los cobros. Si el precio cambia, se
     * cambia en el contrato, que es el documento con valor.
     *
     * Tampoco el avance: para eso está `registrarAvance`, que sí comprueba
     * que no retroceda ni pise el cálculo de los entregables.
     */
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

        // La fecha de fin no puede quedar antes de que el proyecto empezara.
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

    /**
     * REGLAS del avance:
     *   - entre 0 y 100
     *   - no puede retroceder (un trabajo hecho no se deshace)
     *   - no se registran avances en proyectos cerrados
     *   - si el proyecto tiene entregables, el avance NO se toca a mano
     */
    async registrarAvance(referencia, porcentaje) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)

        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto está ${proyecto.estado}: no admite avances.`)
        }

        /*
         * UNA SOLA FUENTE DE VERDAD.
         *
         * Si el proyecto tiene entregables, su avance lo calcula
         * EntregableService a partir de los pesos. Permitir además un avance
         * manual haría que los dos datos se contradijeran: el proyecto diría
         * 80% y los entregables 30%. ¿Cuál es el bueno? Por eso, en cuanto
         * hay entregables, el avance manual se bloquea.
         */
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

    /** REGLA: no se finaliza un proyecto a medias. */
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
