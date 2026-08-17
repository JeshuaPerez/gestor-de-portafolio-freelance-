import { Entregable } from '../models/Entregable.js'
import {
    AVISO_CANCELAR,
    OperacionCancelada,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirFecha,
    pedirNumero,
    pedirOpcion,
    pedirTexto,
} from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { barraDeAvance, colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { diasHasta, fechaRelativa, formatearFecha } from '../utils/formato.js'
import { panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'

/** Una línea por proyecto, para las listas de elegir. */
function describirProyecto(p) {
    return `${p.codigo.padEnd(9)} ${p.nombre.padEnd(30)} ${String(p.avance).padStart(3)}%`
}

/** Una línea por entregable, para las listas de elegir. */
function describirEntregable(e) {
    const codigo = (e.codigo ?? '---').padEnd(9)
    return `${codigo} ${e.titulo.padEnd(28)} peso ${String(e.peso).padStart(3)}  ${e.estado}`
}

/**
 * La fecha límite, coloreada según lo urgente que sea.
 *
 * Aquí es donde dayjs se gana el sitio: en vez de una fecha suelta que hay
 * que ir a mirar al calendario, dice "en 3 días" o "hace 5 días", y el
 * color avisa antes de leer.
 */
function describirLimite(e) {
    const fecha = formatearFecha(e.fechaLimite)
    const cuando = fechaRelativa(e.fechaLimite)
    const dias = diasHasta(e.fechaLimite)

    // Lo aprobado ya no corre prisa, aunque la fecha haya pasado.
    if (e.estado === 'aprobado') return `${fecha}\n${estilo.tenue(cuando)}`
    if (dias < 0) return `${fecha}\n${estilo.error(`VENCIDO ${cuando}`)}`
    if (dias <= 3) return `${fecha}\n${estilo.aviso(cuando)}`
    return `${fecha}\n${estilo.tenue(cuando)}`
}

function mostrarEntregables(entregables) {
    mostrarTabla({
        cabeceras: ['Código', 'Título', 'Peso', 'Fecha límite', 'Estado', 'Último cambio'],
        filas: entregables.map((e) => {
            const ultimo = e.historial?.[e.historial.length - 1]
            return [
                estilo.codigo(e.codigo ?? '---'),
                e.titulo,
                String(e.peso),
                describirLimite(e),
                colorEstado(e.estado),
                ultimo
                    ? `${ultimo.desde} → ${ultimo.hasta}` +
                      (ultimo.motivo ? `\n${estilo.tenue(ultimo.motivo)}` : '')
                    : estilo.tenue('-'),
            ]
        }),
        alineado: ['left', 'left', 'right', 'left', 'left', 'left'],
        vacio: 'No hay entregables para mostrar.',
        resumen: `Total: ${entregables.length} entregable(s)`,
    })
}

/**
 * Elige primero el proyecto y después uno de sus entregables.
 *
 * Se repite en dos opciones del menú, así que lo sacamos a una función: es
 * el mismo principio DRY que aplicamos en entrada.js, pero a nivel de menú.
 */
async function elegirEntregableDeUnProyecto(entregableService, etiqueta) {
    const proyecto = await elegirDeLista(await entregableService.listarProyectos(), {
        etiqueta: 'Elige el proyecto',
        describir: describirProyecto,
        siVacio: 'Todavía no hay proyectos.',
    })

    const entregables = await entregableService.listarPorProyecto(proyecto._id)

    return elegirDeLista(entregables, {
        etiqueta,
        describir: describirEntregable,
        siVacio: `El proyecto ${proyecto.codigo} no tiene entregables todavía.`,
    })
}

export async function menuEntregables(entregableService) {
    while (true) {
        const accion = await elegirAccion('ENTREGABLES', [
            { nombre: 'Crear entregable', valor: 'crear' },
            { nombre: 'Listar los de un proyecto', valor: 'listar' },
            { nombre: 'Editar entregable', valor: 'editar' },
            { separador: true },
            { nombre: '⭐ Cambiar estado (recalcula el avance)', valor: 'estado' },
            { nombre: 'Ver entregables vencidos', valor: 'vencidos' },
            { nombre: 'Eliminar entregable', valor: 'eliminar' },
            { separador: true },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        try {
            switch (accion) {
                case 'crear': {
                    console.log(estilo.titulo('\n--- Nuevo entregable ---'))
                    console.log(AVISO_CANCELAR)

                    const proyecto = await elegirDeLista(
                        await entregableService.listarProyectosActivos(),
                        {
                            etiqueta: 'Elige el proyecto',
                            describir: describirProyecto,
                            siVacio: 'No hay proyectos activos que admitan entregables.',
                        },
                    )

                    console.log(
                        estilo.tenue(
                            `  Fin previsto del proyecto: ${formatearFecha(proyecto.fechaFinEstimada)}`,
                        ),
                    )

                    const titulo = await pedirTexto('Título', {
                        min: 3,
                        ejemplo: 'Diseño de la interfaz',
                    })
                    const descripcion = await pedirTexto('Descripción', { opcional: true })
                    const fechaLimite = await pedirFecha('Fecha límite')
                    const peso = await pedirNumero('Peso (cuánto representa del total)', {
                        min: 1,
                        max: 1000,
                        ejemplo: '30',
                    })

                    const codigo = await entregableService.crear({
                        proyectoId: proyecto._id,
                        titulo,
                        descripcion,
                        fechaLimite,
                        peso,
                    })
                    console.log(
                        '\n' + mensaje.exito(`Entregable ${codigo} creado en ${proyecto.codigo}.`),
                    )
                    break
                }

                case 'listar': {
                    const proyecto = await elegirDeLista(
                        await entregableService.listarProyectos(),
                        {
                            etiqueta: 'Elige el proyecto',
                            describir: describirProyecto,
                            siVacio: 'Todavía no hay proyectos.',
                        },
                    )
                    mostrarEntregables(await entregableService.listarPorProyecto(proyecto._id))
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Editar entregable ---'))
                    console.log(AVISO_CANCELAR)
                    console.log(
                        estilo.tenue(
                            '  Solo se editan los pendientes o rechazados.\n' +
                                '  Si cambias el peso, el avance del proyecto se recalcula.',
                        ),
                    )

                    const entregable = await elegirEntregableDeUnProyecto(
                        entregableService,
                        'Elige el entregable a editar',
                    )

                    const titulo = await pedirTexto('Título', {
                        min: 3,
                        actual: entregable.titulo,
                    })
                    const descripcion = await pedirTexto('Descripción', {
                        opcional: true,
                        actual: entregable.descripcion,
                    })
                    const fechaLimite = await pedirFecha('Fecha límite', {
                        actual: new Date(entregable.fechaLimite).toISOString().slice(0, 10),
                    })
                    const peso = await pedirNumero('Peso', {
                        min: 1,
                        max: 1000,
                        actual: entregable.peso,
                    })

                    const r = await entregableService.editar(entregable._id, {
                        titulo,
                        descripcion,
                        fechaLimite,
                        peso,
                    })
                    console.log(
                        '\n' + mensaje.exito(`Entregable ${entregable.codigo ?? ''} actualizado.`),
                    )
                    console.log(`  Avance del proyecto: ${barraDeAvance(r.avance)}`)
                    break
                }

                case 'estado': {
                    console.log(estilo.titulo('\n--- Cambiar estado ---'))
                    console.log(
                        estilo.tenue('  Flujo: pendiente → entregado → aprobado / rechazado'),
                    )

                    const entregable = await elegirEntregableDeUnProyecto(
                        entregableService,
                        'Elige el entregable',
                    )

                    /*
                     * SOLO SE OFRECEN LAS TRANSICIONES LEGALES.
                     *
                     * La tabla de transiciones vive en el modelo. Aquí la
                     * leemos para construir el menú, en vez de dejar que el
                     * usuario escriba un estado imposible y llevarse un error.
                     * La regla sigue estando en UN solo sitio: el modelo.
                     */
                    const posibles = Entregable.TRANSICIONES[entregable.estado]
                    if (posibles.length === 0) {
                        throw new Error(
                            `"${entregable.titulo}" está ${entregable.estado}: es un estado final, ya no se mueve.`,
                        )
                    }

                    console.log(`\n  Estado actual: ${colorEstado(entregable.estado)}`)
                    const estado = await pedirOpcion('Nuevo estado', posibles)

                    // El motivo solo se pide cuando hace falta.
                    let motivo = null
                    if (estado === 'rechazado') {
                        motivo = await pedirTexto('Motivo del rechazo', {
                            min: 5,
                            ejemplo: 'Faltan las pantallas de checkout',
                        })
                    }

                    const r = await conSpinner('Recalculando el avance del proyecto...', () =>
                        entregableService.cambiarEstado(entregable._id, estado, motivo),
                    )
                    panelTransaccion('Transacción completada · 2 colecciones', [
                        `"${r.titulo}" pasó a ${colorEstado(r.estadoNuevo)}`,
                        `Avance recalculado: ${barraDeAvance(r.avance)}`,
                    ])
                    break
                }

                case 'vencidos':
                    mostrarEntregables(await entregableService.listarVencidos())
                    break

                case 'eliminar': {
                    console.log(estilo.titulo('\n--- Eliminar entregable ---'))

                    const entregable = await elegirEntregableDeUnProyecto(
                        entregableService,
                        'Elige el entregable a eliminar',
                    )

                    const seguro = await confirmar(`¿Eliminar "${entregable.titulo}"?`)
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const e = await entregableService.eliminar(entregable._id)
                    console.log(
                        '\n' +
                            mensaje.exito(
                                `Entregable "${e.titulo}" eliminado y avance recalculado.`,
                            ),
                    )
                    break
                }

                case 'volver':
                    return
            }
        } catch (error) {
            if (error instanceof OperacionCancelada) {
                console.log('\n' + mensaje.aviso('Operación cancelada.'))
            } else {
                console.log('\n' + mensaje.error(error.message))
            }
        }
    }
}
