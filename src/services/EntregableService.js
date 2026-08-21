import { aFechaLocal } from '../dominio/valores.js'
import { NoEncontradoError, ReglaNegocioError } from '../errors/errores.js'
import { EVENTOS } from '../eventos/EmisorEventos.js'
import { Entregable } from '../models/Entregable.js'
import { CambioEstado } from '../models/estados/CambioEstado.js'

// REGLAS DE NEGOCIO PARA ENTREGABLES
//
// Lo que cambió respecto a la versión anterior:
//
//  · ya no recibe `mongoClient`, sino una UnidadDeTrabajo (abstracción) -> DIP
//  · ya no decide qué transiciones son legales: se lo pregunta al estado -> State
//  · ya no recalcula el avance del proyecto: anuncia el evento           -> Observer
//  · editar() reconstruye el modelo y llama a validar(), igual que crear()
export class EntregableService {
    constructor(entregableRepositorio, proyectoRepositorio, unidadDeTrabajo, emisor) {
        this.entregables = entregableRepositorio
        this.proyectos = proyectoRepositorio
        this.unidadDeTrabajo = unidadDeTrabajo
        this.emisor = emisor
    }

    async #exigirProyecto(referencia, contexto) {
        const proyecto = await this.proyectos.buscarPorIdOCodigo(referencia, contexto)
        if (!proyecto) throw new NoEncontradoError('proyecto', referencia)
        return proyecto
    }

    async #exigirEntregable(referencia, contexto) {
        const entregable = await this.entregables.buscarPorIdOCodigo(referencia, contexto)
        if (!entregable) throw new NoEncontradoError('entregable', referencia)
        return entregable
    }

    // CREAR — el proyecto tiene que estar activo y la fecha caber dentro de él.
    async crear(datos) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const proyecto = await this.#exigirProyecto(datos.proyectoId, contexto)

            if (proyecto.estado !== 'activo') {
                throw new ReglaNegocioError(
                    `El proyecto está ${proyecto.estado}: no admite entregables nuevos.`,
                )
            }

            const entregable = new Entregable({ ...datos, proyectoId: proyecto._id })

            // El historial arranca aquí, con el estado en el que nace: así la
            // consulta puede decir desde cuándo estuvo pendiente, y no solo
            // qué le pasó después.
            entregable.anotarAlta()
            entregable.validar()

            if (entregable.fechaLimite > new Date(proyecto.fechaFinEstimada)) {
                throw new ReglaNegocioError(
                    'La fecha límite no puede ser posterior al fin del proyecto.',
                )
            }

            entregable.codigo = await this.entregables.siguienteCodigo('ENT', contexto)
            await this.entregables.crear(entregable.aDocumento(), contexto)

            // El avance lo recalcula quien escuche esto, no nosotros.
            await this.emisor.emitir(EVENTOS.ENTREGABLE_CREADO, {
                proyectoId: proyecto._id,
                contexto,
            })

            return entregable.codigo
        })
    }

    async listarPorProyecto(referencia) {
        const proyecto = await this.#exigirProyecto(referencia)
        return this.entregables.listarPorProyecto(proyecto._id)
    }

    async listarVencidos() {
        return this.entregables.listarVencidos()
    }

    async listarProyectosActivos() {
        return this.proyectos.listarPorEstado('activo')
    }

    async listarProyectos() {
        return this.proyectos.listar()
    }

    /** Los estados a los que este entregable puede saltar ahora mismo. */
    transicionesPosibles(entregable) {
        return Entregable.desdeDocumento(entregable).estadoActual().siguientes()
    }

    // CAMBIAR ESTADO — atómico: estado + historial + (por evento) avance.
    async cambiarEstado(referencia, claveNueva, motivo) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const documento = await this.#exigirEntregable(referencia, contexto)
            const entregable = Entregable.desdeDocumento(documento)

            // El estado decide si la transición es legal y si exige motivo.
            // Si no lo es, lanza él mismo el error explicando qué se puede hacer.
            const estadoDestino = entregable.estadoActual().transicionarA(claveNueva, motivo)

            // La entrada se valida ANTES de escribirla. El historial es un
            // registro de auditoría: una entrada mal formada no se nota hasta
            // que alguien va a consultarla, que es justo cuando ya no se puede
            // reconstruir lo que pasó.
            const cambio = entregable.anotarCambio(entregable.estado, estadoDestino.clave, motivo)
            cambio.validar()

            // Estado nuevo y entrada de historial, en una sola escritura: no
            // hay ningún instante en el que uno esté puesto y el otro no.
            await this.entregables.registrarCambioEstado(
                documento._id,
                estadoDestino.clave,
                cambio.aDocumento(),
                contexto,
            )

            await this.emisor.emitir(EVENTOS.ENTREGABLE_CAMBIO_ESTADO, {
                proyectoId: documento.proyectoId,
                contexto,
            })

            // Releemos el proyecto para devolver el avance ya sincronizado.
            const proyecto = await this.proyectos.buscarPorId(
                String(documento.proyectoId),
                contexto,
            )

            return {
                codigo: documento.codigo,
                titulo: documento.titulo,
                estadoNuevo: estadoDestino.clave,
                avance: proyecto?.avance ?? 0,
            }
        })
    }

    /**
     * HISTORIAL — todos los cambios de estado de un entregable, en orden.
     *
     * Es la consulta que da servicio al comando de consola. Tres detalles:
     *
     *  · una sola lectura, y proyectada: el repositorio pide solo los cuatro
     *    campos que se van a pintar, no el documento entero;
     *  · acepta el código legible (ENT-0001) igual que el _id, como el resto
     *    del sistema;
     *  · devuelve objetos CambioEstado, no documentos crudos, para que la
     *    consola no tenga que saber cómo está guardado el historial por dentro.
     */
    async historialDe(referencia) {
        const documento = await this.entregables.historialDe(referencia)
        if (!documento) throw new NoEncontradoError('entregable', referencia)

        return {
            codigo: documento.codigo,
            titulo: documento.titulo,
            estado: documento.estado,
            cambios: CambioEstado.listaDesdeDocumento(documento.historial),
        }
    }

    // EDITAR — reconstruye el modelo y lo valida ENTERO, igual que al crear.
    async editar(referencia, cambios) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const documento = await this.#exigirEntregable(referencia, contexto)
            const actual = Entregable.desdeDocumento(documento)

            // ¿Se puede tocar? Lo dice el estado, no una lista escrita aquí.
            if (!actual.estadoActual().permiteEdicion()) {
                throw new ReglaNegocioError(
                    `"${documento.titulo}" está ${documento.estado}: ya no se puede editar. ` +
                        'Solo se editan los pendientes o rechazados.',
                )
            }

            // AQUÍ está el arreglo del agujero que había: antes la edición
            // comprobaba a mano el título y el peso, y se saltaba el resto de
            // las reglas del modelo. Ahora pasa por el mismo validar().
            const editado = Entregable.desdeDocumento(documento, {
                titulo: cambios.titulo,
                descripcion: cambios.descripcion,
                fechaLimite: cambios.fechaLimite ? aFechaLocal(cambios.fechaLimite) : undefined,
                peso: cambios.peso,
            })
            editado.validar()

            const proyecto = await this.proyectos.buscarPorId(String(documento.proyectoId), contexto)
            if (proyecto && editado.fechaLimite > new Date(proyecto.fechaFinEstimada)) {
                throw new ReglaNegocioError(
                    'La fecha límite no puede ser posterior al fin del proyecto.',
                )
            }

            const actualizacion = {
                titulo: editado.titulo,
                descripcion: editado.descripcion,
                fechaLimite: editado.fechaLimite,
                peso: editado.peso,
                actualizadoEn: new Date(),
            }
            await this.entregables.actualizar(documento._id, actualizacion, contexto)

            // Cambiar el peso mueve el avance: que lo recalcule el observador.
            await this.emisor.emitir(EVENTOS.ENTREGABLE_EDITADO, {
                proyectoId: documento.proyectoId,
                contexto,
            })

            const refrescado = await this.proyectos.buscarPorId(
                String(documento.proyectoId),
                contexto,
            )

            return { ...documento, ...actualizacion, avance: refrescado?.avance ?? 0 }
        })
    }

    // ELIMINAR — lo aprobado es historia y no se borra (lo decide el estado).
    async eliminar(referencia) {
        return this.unidadDeTrabajo.ejecutar(async (contexto) => {
            const documento = await this.#exigirEntregable(referencia, contexto)
            const entregable = Entregable.desdeDocumento(documento)

            if (!entregable.estadoActual().permiteEliminacion()) {
                throw new ReglaNegocioError(
                    `Un entregable ${documento.estado} no se puede eliminar.`,
                )
            }

            await this.entregables.eliminar(documento._id, contexto)

            await this.emisor.emitir(EVENTOS.ENTREGABLE_ELIMINADO, {
                proyectoId: documento.proyectoId,
                contexto,
            })

            return documento
        })
    }
}
