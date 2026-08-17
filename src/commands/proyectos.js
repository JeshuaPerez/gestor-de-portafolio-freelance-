import {
    OperacionCancelada,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirFecha,
    pedirNumero,
    pedirOpcion,
    pedirTexto,
} from '../utils/entrada.js'
import { barraDeAvance, colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'

const ESTADOS = ['activo', 'finalizado', 'cancelado']

/** Una línea por proyecto, para las listas de elegir. */
function describirProyecto(p) {
    return `${p.codigo.padEnd(9)} ${p.nombre.padEnd(30)} ${String(p.avance).padStart(3)}%  ${p.estado}`
}

function mostrarProyectos(proyectos) {
    mostrarTabla({
        cabeceras: ['Código', 'Nombre', 'Avance', 'Monto', 'Fin previsto', 'Estado'],
        filas: proyectos.map((p) => [
            estilo.codigo(p.codigo),
            p.nombre,
            barraDeAvance(p.avance, 12),
            estilo.dinero(formatearDinero(p.monto)),
            formatearFecha(p.fechaFinEstimada),
            colorEstado(p.estado),
        ]),
        alineado: ['left', 'left', 'left', 'right', 'left', 'left'],
        vacio: 'No hay proyectos para mostrar.',
        resumen: `Total: ${proyectos.length} proyecto(s)`,
    })
}

export async function menuProyectos(proyectoService) {
    while (true) {
        const accion = await elegirAccion('PROYECTOS', [
            { nombre: 'Listar proyectos', valor: 'listar' },
            { nombre: 'Filtrar por estado', valor: 'filtrar' },
            { nombre: 'Ver ficha de un proyecto', valor: 'ficha' },
            { nombre: 'Editar proyecto', valor: 'editar' },
            { separador: true },
            { nombre: 'Registrar avance', valor: 'avance' },
            { nombre: 'Finalizar proyecto', valor: 'finalizar' },
            { nombre: 'Cancelar proyecto', valor: 'cancelar' },
            { separador: true },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        try {
            switch (accion) {
                case 'listar':
                    mostrarProyectos(await proyectoService.listar())
                    break

                case 'filtrar': {
                    const estado = await pedirOpcion('Estado a filtrar', ESTADOS)
                    mostrarProyectos(await proyectoService.listar(estado))
                    break
                }

                case 'ficha': {
                    const elegido = await elegirDeLista(await proyectoService.listar(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'Todavía no hay proyectos. Acepta una propuesta primero.',
                    })

                    const p = await proyectoService.verFicha(elegido._id)

                    mostrarPanel({
                        titulo: ` ${p.codigo} · ${p.nombre} `,
                        lineas: comoFicha([
                            ['Cliente', p.cliente?.nombre ?? estilo.error('(no encontrado)')],
                            ['Estado', colorEstado(p.estado)],
                            ['Avance', barraDeAvance(p.avance)],
                            ['Monto', estilo.dinero(formatearDinero(p.monto))],
                            ['Cobrado', estilo.exito(formatearDinero(p.cobrado ?? 0))],
                            ['Gastado', estilo.error(formatearDinero(p.gastado ?? 0))],
                            ['Inicio', formatearFecha(p.fechaInicio)],
                            ['Fin previsto', formatearFecha(p.fechaFinEstimada)],
                            [
                                'Contrato',
                                p.contratoFirmado
                                    ? colorEstado('firmado')
                                    : estilo.aviso('SIN FIRMAR'),
                            ],
                        ]),
                    })
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Editar proyecto ---'))
                    console.log(
                        estilo.tenue(
                            '  El monto no se edita aquí: viene del contrato firmado.\n' +
                                '  El avance tampoco: para eso está "Registrar avance".',
                        ),
                    )

                    const proyecto = await elegirDeLista(await proyectoService.listarActivos(), {
                        etiqueta: 'Elige el proyecto a editar',
                        describir: describirProyecto,
                        siVacio: 'No hay proyectos activos.',
                    })

                    const nombre = await pedirTexto('Nombre', {
                        min: 5,
                        actual: proyecto.nombre,
                    })
                    const descripcion = await pedirTexto('Descripción', {
                        opcional: true,
                        actual: proyecto.descripcion,
                    })
                    const fechaFinEstimada = await pedirFecha('Fin previsto', {
                        actual: new Date(proyecto.fechaFinEstimada).toISOString().slice(0, 10),
                    })

                    const p = await proyectoService.editar(proyecto._id, {
                        nombre,
                        descripcion,
                        fechaFinEstimada,
                    })
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} actualizado.`))
                    break
                }

                case 'avance': {
                    console.log(estilo.titulo('\n--- Registrar avance ---'))
                    console.log(
                        estilo.tenue('  (Si el proyecto tiene entregables, el avance se calcula solo)'),
                    )

                    const proyecto = await elegirDeLista(await proyectoService.listarActivos(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'No hay proyectos activos.',
                    })

                    // El mínimo es el avance actual: la regla dice que no
                    // puede retroceder, así que lo decimos ANTES de preguntar
                    // en vez de rechazarlo después.
                    const porcentaje = await pedirNumero('Nuevo avance', {
                        min: proyecto.avance,
                        max: 100,
                        entero: true,
                        ejemplo: '50',
                    })

                    const p = await proyectoService.registrarAvance(proyecto._id, porcentaje)
                    console.log('\n' + mensaje.exito('Avance actualizado:') + ` ${barraDeAvance(p.avance)}`)
                    break
                }

                case 'finalizar': {
                    console.log(estilo.titulo('\n--- Finalizar proyecto ---'))

                    const proyecto = await elegirDeLista(await proyectoService.listarActivos(), {
                        etiqueta: 'Elige el proyecto a finalizar',
                        describir: describirProyecto,
                        siVacio: 'No hay proyectos activos.',
                    })

                    const p = await proyectoService.finalizar(proyecto._id)
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} finalizado.`))
                    break
                }

                case 'cancelar': {
                    console.log(estilo.titulo('\n--- Cancelar proyecto ---'))

                    const proyecto = await elegirDeLista(await proyectoService.listarActivos(), {
                        etiqueta: 'Elige el proyecto a cancelar',
                        describir: describirProyecto,
                        siVacio: 'No hay proyectos activos.',
                    })

                    const motivo = await pedirTexto('Motivo de la cancelación', {
                        min: 5,
                        ejemplo: 'El cliente retiró el encargo',
                    })

                    const seguro = await confirmar(
                        `¿Cancelar ${proyecto.codigo} "${proyecto.nombre}"?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const p = await proyectoService.cancelar(proyecto._id, motivo)
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} cancelado.`))
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
