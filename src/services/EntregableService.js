import { Entregable } from '../models/Entregable.js'
import { aFechaLocal } from '../utils/formato.js'

// REGLAS DE NEGOCIO PARA ENTREGABLES
export class EntregableService {
    constructor(entregableRepositorio, proyectoRepositorio, mongoClient) {
        this.entregables = entregableRepositorio
        this.proyectos = proyectoRepositorio
        this.mongoClient = mongoClient
    }

    // REGLA: FECHA LÍMITE no puede ser posterior al fin del proyecto
    async crear(datos) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(datos.proyectoId)
        if (!proyecto) {
            throw new Error(`No existe ningún proyecto con la referencia "${datos.proyectoId}".`)
        }
        if (proyecto.estado !== 'activo') {
            throw new Error(`El proyecto está ${proyecto.estado}: no admite entregables nuevos.`)
        }

        const entregable = new Entregable({ ...datos, proyectoId: proyecto._id })
        entregable.validar()

        if (entregable.fechaLimite > new Date(proyecto.fechaFinEstimada)) {
            throw new Error('La fecha límite no puede ser posterior al fin del proyecto.')
        }

        entregable.codigo = await this.entregables.siguienteCodigo('ENT')
        await this.entregables.crear(entregable.aDocumento())
        return entregable.codigo
    }

    async listarPorProyecto(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new Error(`No existe ningún proyecto con la referencia "${referencia}".`)
        return this.entregables.listarPorProyecto(proyecto._id)
    }

    async listarVencidos() {
        return this.entregables.listarVencidos()
    }

    // Proyectos activos: los únicos que admiten entregables nuevos.
    async listarProyectosActivos() {
        return this.proyectos.listarPorEstado('activo')
    }

    // Todos los proyectos, para consultar entregables de cualquiera.
    async listarProyectos() {
        return this.proyectos.listar()
    }

    // CALCULAR AVANCE: porcentaje de peso aprobado sobre el total de peso. Si no hay entregables, devuelve 0.
    calcularAvance(entregables) {
        const pesoTotal = entregables.reduce((suma, e) => suma + e.peso, 0)
        if (pesoTotal === 0) return 0 // sin entregables no hay nada que calcular

        const pesoAprobado = entregables
            .filter((e) => e.estado === 'aprobado')
            .reduce((suma, e) => suma + e.peso, 0)

        return Math.round((pesoAprobado / pesoTotal) * 100)
    }

    // CAMBIAR ESTADO — transaccional: cambia el estado, anota el historial y recalcula el avance del proyecto.
    async cambiarEstado(referencia, estadoNuevo, motivo) {
        const session = this.mongoClient.startSession()

        try {
            let resultado = null

            await session.withTransaction(async () => {
                const entregable = await this.entregables.buscarPorIdOCodigo(referencia, session)
                if (!entregable) {
                    throw new Error(`No existe ningún entregable con la referencia "${referencia}".`)
                }

                if (!Entregable.puedeCambiar(entregable.estado, estadoNuevo)) {
                    const posibles = Entregable.TRANSICIONES[entregable.estado]
                    throw new Error(
                        `No se puede pasar de "${entregable.estado}" a "${estadoNuevo}". ` +
                            (posibles.length
                                ? `Desde "${entregable.estado}" solo se puede ir a: ${posibles.join(', ')}.`
                                : `"${entregable.estado}" es un estado final.`),
                    )
                }

                // REGLA: rechazar exige explicar por qué.
                if (estadoNuevo === 'rechazado' && (!motivo || motivo.trim().length < 5)) {
                    throw new Error('Debes indicar el motivo del rechazo (mínimo 5 caracteres).')
                }

                // PASO 1: cambiar el estado y anotar el historial ---
                await this.entregables.actualizar(
                    entregable._id,
                    { estado: estadoNuevo, actualizadoEn: new Date() },
                    session,
                )
                await this.entregables.agregarAlHistorial(
                    entregable._id,
                    {
                        desde: entregable.estado,
                        hasta: estadoNuevo,
                        motivo: motivo?.trim() || null,
                        fecha: new Date(),
                    },
                    session,
                )

                // PASO 2: recalcular el avance del proyecto ---
                const hermanos = await this.entregables.listarPorProyecto(
                    entregable.proyectoId,
                    session,
                )
                const avance = this.calcularAvance(hermanos)

                await this.proyectos.actualizar(
                    String(entregable.proyectoId),
                    { avance, actualizadoEn: new Date() },
                    session,
                )

                resultado = {
                    codigo: entregable.codigo,
                    titulo: entregable.titulo,
                    estadoNuevo,
                    avance,
                }
            })

            return resultado
        } finally {
            await session.endSession()
        }
    }

    // EDITAR — transaccional: valida todo el modelo, actualiza y recalcula el avance del proyecto.
    async editar(referencia, cambios) {
        const session = this.mongoClient.startSession()

        try {
            let resultado = null

            await session.withTransaction(async () => {
                const entregable = await this.entregables.buscarPorIdOCodigo(referencia, session)
                if (!entregable) {
                    throw new Error(`No existe ningún entregable con la referencia "${referencia}".`)
                }

                if (!['pendiente', 'rechazado'].includes(entregable.estado)) {
                    throw new Error(
                        `"${entregable.titulo}" está ${entregable.estado}: ya no se puede editar. ` +
                            'Solo se editan los pendientes o rechazados.',
                    )
                }

                const proyecto = await this.proyectos.buscarPorId(
                    String(entregable.proyectoId),
                    session,
                )

                const titulo = cambios.titulo ?? entregable.titulo
                if (!titulo || titulo.trim().length < 3) {
                    throw new Error('El título del entregable es obligatorio (mínimo 3 caracteres).')
                }

                const actualizacion = {
                    titulo: titulo.trim(),
                    descripcion:
                        cambios.descripcion === undefined
                            ? entregable.descripcion
                            : cambios.descripcion?.trim() || null,
                    actualizadoEn: new Date(),
                }

                if (cambios.fechaLimite) {
                    const limite = aFechaLocal(cambios.fechaLimite)
                    if (proyecto && limite > new Date(proyecto.fechaFinEstimada)) {
                        throw new Error(
                            'La fecha límite no puede ser posterior al fin del proyecto.',
                        )
                    }
                    actualizacion.fechaLimite = limite
                }

                if (cambios.peso !== undefined && cambios.peso !== null) {
                    const peso = Number(cambios.peso)
                    if (!Number.isFinite(peso) || peso <= 0) {
                        throw new Error('El peso debe ser un número mayor que 0.')
                    }
                    actualizacion.peso = peso
                }

                await this.entregables.actualizar(entregable._id, actualizacion, session)

                // Recalculamos SIEMPRE: leer aquí dentro nos da los pesos ya
                // actualizados, incluido el que acabamos de cambiar.
                const hermanos = await this.entregables.listarPorProyecto(
                    entregable.proyectoId,
                    session,
                )
                const avance = this.calcularAvance(hermanos)

                await this.proyectos.actualizar(
                    String(entregable.proyectoId),
                    { avance, actualizadoEn: new Date() },
                    session,
                )

                resultado = { ...entregable, ...actualizacion, avance }
            })

            return resultado
        } finally {
            await session.endSession()
        }
    }

    // ELIMINAR — transaccional: no se puede eliminar un entregable aprobado. Recalcula el avance del proyecto.
    async eliminar(referencia) {
        const session = this.mongoClient.startSession()

        try {
            let eliminado = null

            await session.withTransaction(async () => {
                const entregable = await this.entregables.buscarPorIdOCodigo(referencia, session)
                if (!entregable) {
                    throw new Error(`No existe ningún entregable con la referencia "${referencia}".`)
                }

                // REGLA: lo aprobado es historia, no se borra.
                if (entregable.estado === 'aprobado') {
                    throw new Error('Un entregable aprobado no se puede eliminar.')
                }

                await this.entregables.eliminar(entregable._id, session)

                const hermanos = await this.entregables.listarPorProyecto(
                    entregable.proyectoId,
                    session,
                )
                await this.proyectos.actualizar(
                    String(entregable.proyectoId),
                    { avance: this.calcularAvance(hermanos) },
                    session,
                )

                eliminado = entregable
            })

            return eliminado
        } finally {
            await session.endSession()
        }
    }
}
