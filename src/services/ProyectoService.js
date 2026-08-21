import { calculadoraPara } from '../dominio/CalculadoraAvance.js'
import { aFechaLocal } from '../dominio/valores.js'
import { NoEncontradoError, ReglaNegocioError, ValidacionError } from '../errors/errores.js'
import { Proyecto } from '../models/Proyecto.js'

// REGLAS DE NEGOCIO PARA PROYECTOS
export class ProyectoService {
    constructor(proyectoRepositorio, clienteRepositorio, entregableRepositorio) {
        this.proyectos = proyectoRepositorio
        this.clientes = clienteRepositorio
        this.entregables = entregableRepositorio
    }

    async #exigir(referencia) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia)
        if (!proyecto) throw new NoEncontradoError('proyecto', referencia)
        return proyecto
    }

    async listar(estado) {
        return estado ? this.proyectos.listarPorEstado(estado) : this.proyectos.listar()
    }

    /** Solo los activos: los únicos que admiten avances, entregables o cierre. */
    async listarActivos() {
        return this.proyectos.listarPorEstado('activo')
    }

    // Devuelve el proyecto con el cliente y la estrategia de avance que le toca.
    async verFicha(referencia) {
        const proyecto = await this.#exigir(referencia)
        const cliente = await this.clientes.buscarPorId(String(proyecto.clienteId))
        const entregables = await this.entregables.listarPorProyecto(proyecto._id)

        return {
            ...proyecto,
            cliente,
            totalEntregables: entregables.length,
            // La consola enseña esto para que el usuario entienda de dónde
            // sale el porcentaje, en vez de tener que adivinarlo.
            comoSeCalculaElAvance: calculadoraPara(proyecto, entregables).descripcion(),
        }
    }

    // EDITAR — reconstruye el modelo entero y lo valida como si fuera un alta.
    async editar(referencia, cambios) {
        const documento = await this.#exigir(referencia)

        if (documento.estado !== 'activo') {
            throw new ReglaNegocioError(
                `El proyecto está ${documento.estado}: ya no se puede editar.`,
            )
        }

        // Antes esto validaba a mano solo el nombre. Ahora pasa por el mismo
        // validar() que el alta, así que ninguna regla se queda fuera.
        const editado = Proyecto.desdeDocumento(documento, {
            nombre: cambios.nombre,
            descripcion: cambios.descripcion,
            fechaFinEstimada: cambios.fechaFinEstimada
                ? aFechaLocal(cambios.fechaFinEstimada)
                : undefined,
        })
        editado.validar()

        const actualizacion = {
            nombre: editado.nombre,
            descripcion: editado.descripcion,
            fechaFinEstimada: editado.fechaFinEstimada,
            actualizadoEn: new Date(),
        }

        await this.proyectos.actualizar(documento._id, actualizacion)
        return { ...documento, ...actualizacion }
    }

    /**
     * REGISTRAR AVANCE.
     *
     * Antes esto era un `if (entregables.length > 0) throw` seguido de tres
     * comprobaciones a mano. Ahora la estrategia decide: si el proyecto tiene
     * entregables, la estrategia de entregables dice que NO se puede reportar
     * a mano, y las validaciones del porcentaje viven dentro de AvanceManual.
     */
    async registrarAvance(referencia, porcentaje) {
        const proyecto = await this.#exigir(referencia)

        if (proyecto.estado !== 'activo') {
            throw new ReglaNegocioError(`El proyecto está ${proyecto.estado}: no admite avances.`)
        }

        const entregables = await this.entregables.listarPorProyecto(proyecto._id)
        const calculadora = calculadoraPara(proyecto, entregables)

        if (!calculadora.permiteRegistroManual()) {
            throw new ReglaNegocioError(
                'Este proyecto tiene entregables: el avance se calcula solo al ' +
                    'aprobarlos. Cámbialos de estado desde el propio proyecto.',
            )
        }

        const nuevo = calculadora.calcular(porcentaje)

        await this.proyectos.actualizar(proyecto._id, { avance: nuevo, actualizadoEn: new Date() })
        return { ...proyecto, avance: nuevo }
    }

    // REGLA: solo se finaliza un proyecto completo.
    async finalizar(referencia) {
        const proyecto = await this.#exigir(referencia)

        if (proyecto.estado !== 'activo') {
            throw new ReglaNegocioError(`El proyecto ya está ${proyecto.estado}.`)
        }
        if (proyecto.avance < 100) {
            throw new ReglaNegocioError(
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
        const proyecto = await this.#exigir(referencia)

        if (proyecto.estado !== 'activo') {
            throw new ReglaNegocioError(`El proyecto ya está ${proyecto.estado}.`)
        }
        if (!motivo || motivo.trim().length < 5) {
            throw new ValidacionError(
                'Debes indicar el motivo de la cancelación (mínimo 5 caracteres).',
                { campo: 'motivo' },
            )
        }

        await this.proyectos.actualizar(proyecto._id, {
            estado: 'cancelado',
            motivoCancelacion: motivo.trim(),
            canceladoEn: new Date(),
        })
        return proyecto
    }
}
