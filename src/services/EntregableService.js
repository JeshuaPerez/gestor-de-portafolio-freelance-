import { Entregable } from '../models/Entregable.js'
import { aFechaLocal } from '../utils/formato.js'

/**
 * Reglas de negocio de los entregables.
 *
 * Aquí está la segunda transacción importante: cambiar el estado de un
 * entregable recalcula el avance del proyecto. Los dos datos tienen que
 * cuadrar SIEMPRE.
 */
export class EntregableService {
    constructor(entregableRepositorio, proyectoRepositorio, mongoClient) {
        this.entregables = entregableRepositorio
        this.proyectos = proyectoRepositorio
        this.mongoClient = mongoClient
    }

    /** REGLA: la fecha límite no puede pasarse de la fecha de fin del proyecto. */
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

    /** Proyectos activos: los únicos que admiten entregables nuevos. */
    async listarProyectosActivos() {
        return this.proyectos.listarPorEstado('activo')
    }

    /** Todos los proyectos, para consultar entregables de cualquiera. */
    async listarProyectos() {
        return this.proyectos.listar()
    }

    /**
     * Calcula el avance del proyecto a partir de sus entregables.
     *
     * Cada entregable tiene un PESO. El avance es:
     *     suma de pesos aprobados / suma de todos los pesos * 100
     *
     * Ejemplo: diseño (peso 30, aprobado) + desarrollo (peso 70, pendiente)
     *          -> 30 / 100 = 30% de avance.
     */
    calcularAvance(entregables) {
        const pesoTotal = entregables.reduce((suma, e) => suma + e.peso, 0)
        if (pesoTotal === 0) return 0 // sin entregables no hay nada que calcular

        const pesoAprobado = entregables
            .filter((e) => e.estado === 'aprobado')
            .reduce((suma, e) => suma + e.peso, 0)

        return Math.round((pesoAprobado / pesoTotal) * 100)
    }

    /**
     * ⭐ CAMBIAR ESTADO — OPERACIÓN TRANSACCIONAL CON ROLLBACK
     *
     * Dos colecciones otra vez:
     *   1. el entregable cambia de estado + se anota en su historial (entregables)
     *   2. el avance del proyecto se recalcula                        (proyectos)
     *
     * SI EL PASO 2 FALLA, EL PASO 1 SE DESHACE. El entregable vuelve a su
     * estado anterior. Nunca tendrás un entregable aprobado con el avance del
     * proyecto sin actualizar: esos dos datos se contradirían y el cliente
     * vería un proyecto al 30% con todo entregado.
     */
    async cambiarEstado(referencia, estadoNuevo, motivo) {
        const session = this.mongoClient.startSession()

        try {
            let resultado = null

            await session.withTransaction(async () => {
                const entregable = await this.entregables.buscarPorIdOCodigo(referencia, session)
                if (!entregable) {
                    throw new Error(`No existe ningún entregable con la referencia "${referencia}".`)
                }

                // ¿Es una transición permitida? (ver la tabla en el modelo)
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

                // --- Paso 1: cambiar el estado y anotar el historial ---
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

                // --- Paso 2: recalcular el avance del proyecto ---
                // Leemos DENTRO de la transacción: así vemos el cambio del
                // paso 1, que todavía no está confirmado en disco.
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

    /**
     * ⭐ EDITAR — transaccional, y aquí el motivo es interesante.
     *
     * Editar un entregable parece inofensivo, pero uno de sus campos es el
     * PESO, y el peso decide cuánto vale ese entregable dentro del avance
     * del proyecto. Si el diseño pesaba 30 sobre 100 y lo cambias a 60, el
     * avance del proyecto deja de ser cierto en ese mismo instante.
     *
     * Por eso la edición va en transacción: se guarda el cambio Y se
     * recalcula el avance, o no se hace ninguna de las dos cosas.
     *
     * REGLA: solo se editan los que están pendientes o rechazados. Cambiarle
     * el peso a algo ya aprobado sería reescribir la historia.
     */
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

    /**
     * ⭐ ELIMINAR — también transaccional.
     *
     * Al borrar un entregable, el avance del proyecto cambia (los pesos ya no
     * son los mismos). Borrar sin recalcular dejaría un avance mentiroso.
     */
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
