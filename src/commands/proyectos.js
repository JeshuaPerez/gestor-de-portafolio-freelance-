import { Proyecto } from '../models/Proyecto.js'
import {
    AVISO_CANCELAR,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirNumero,
    pedirSegunRegla,
    pedirTexto,
} from '../utils/entrada.js'
import { barraDeAvance, colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'
import { ejecutarAccion, encabezado } from './comun.js'
import { menuContratoDeProyecto } from './contratos.js'
import { menuEntregablesDeProyecto, mostrarVencidos } from './entregables.js'

// PROYECTOS — Y TODO LO QUE VIVE DENTRO DE UN PROYECTO
//
// Este es el cambio de estructura que pedía el feedback. El menú principal
// tenía "Entregables" y "Contratos" al mismo nivel que "Proyectos", como si
// fueran cosas independientes. No lo son:
//
//   · un entregable SIEMPRE pertenece a un proyecto
//   · un contrato tiene relación 1:1 con su proyecto
//
// La prueba de que estaban mal colocados: sus menús empezaban obligando al
// usuario a elegir un proyecto en CADA acción. Ahora el proyecto se elige una
// vez, se entra en él, y dentro está todo lo suyo.
//
//   Proyectos -> [elegir proyecto] -> Ficha / Entregables / Contrato / Avance...

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

function mostrarFicha(p) {
    mostrarPanel({
        titulo: ` ${p.codigo} · ${p.nombre} `,
        lineas: comoFicha([
            ['Cliente', p.cliente?.nombre ?? estilo.error('(no encontrado)')],
            ['Estado', colorEstado(p.estado)],
            ['Avance', barraDeAvance(p.avance)],
            ['Cómo se calcula', estilo.tenue(p.comoSeCalculaElAvance)],
            ['Monto', estilo.dinero(formatearDinero(p.monto))],
            ['Cobrado', estilo.exito(formatearDinero(p.cobrado ?? 0))],
            ['Gastado', estilo.error(formatearDinero(p.gastado ?? 0))],
            ['Inicio', formatearFecha(p.fechaInicio)],
            ['Fin previsto', formatearFecha(p.fechaFinEstimada)],
            [
                'Contrato',
                p.contratoFirmado ? colorEstado('firmado') : estilo.aviso('SIN FIRMAR'),
            ],
        ]),
    })
}

/**
 * MENÚ DE UN PROYECTO CONCRETO.
 *
 * Recibe solo los tres servicios que necesita, no un objeto con toda la
 * aplicación: los entregables y el contrato son parte del proyecto, así que
 * esta pantalla es la dueña legítima de esos tres.
 */
async function menuUnProyecto(referencia, { proyectos, entregables, contratos }) {
    while (true) {
        // Se relee en cada vuelta: el avance cambia al aprobar un entregable
        // y el contrato al firmarlo. La cabecera tiene que reflejarlo.
        const proyecto = await proyectos.verFicha(referencia)
        const susEntregables = await entregables.listarPorProyecto(proyecto._id)

        const accion = await elegirAccion(
            `${proyecto.codigo} · ${proyecto.nombre}  [${proyecto.estado}]  ${proyecto.avance}%`,
            [
                { nombre: 'Ver ficha completa', valor: 'ficha' },
                { separador: true },
                {
                    nombre: `Entregables (${susEntregables.length})`,
                    valor: 'entregables',
                },
                {
                    nombre: `Contrato${proyecto.contratoFirmado ? ' (firmado)' : ' (sin firmar)'}`,
                    valor: 'contrato',
                },
                { separador: true },
                { nombre: 'Editar datos del proyecto', valor: 'editar' },
                { nombre: 'Registrar avance manual', valor: 'avance' },
                { nombre: 'Finalizar proyecto', valor: 'finalizar' },
                { nombre: 'Cancelar proyecto', valor: 'cancelar' },
                { separador: true },
                { nombre: 'Volver a la lista de proyectos', valor: 'volver' },
            ],
        )

        if (accion === 'volver') return

        // Los submenús gestionan sus propios errores, así que van fuera del wrapper.
        if (accion === 'entregables') {
            await menuEntregablesDeProyecto(proyecto, entregables)
            continue
        }
        if (accion === 'contrato') {
            await menuContratoDeProyecto(proyecto, contratos)
            continue
        }

        const salioBien = await ejecutarAccion(async () => {
            switch (accion) {
                case 'ficha':
                    mostrarFicha(proyecto)
                    break

                case 'editar': {
                    encabezado('Editar proyecto', [
                        'El monto no se edita aquí: viene del contrato.',
                        'El avance tampoco: para eso está "Registrar avance".',
                    ])
                    console.log(AVISO_CANCELAR)

                    const nombre = await pedirSegunRegla('Nombre', Proyecto.REGLAS.nombre, {
                        actual: proyecto.nombre,
                    })
                    const descripcion = await pedirSegunRegla(
                        'Descripción',
                        Proyecto.REGLAS.descripcion,
                        { actual: proyecto.descripcion },
                    )
                    const fechaFinEstimada = await pedirSegunRegla(
                        'Fin previsto',
                        Proyecto.REGLAS.fechaFinEstimada,
                        { actual: new Date(proyecto.fechaFinEstimada).toISOString().slice(0, 10) },
                    )

                    const p = await proyectos.editar(proyecto._id, {
                        nombre,
                        descripcion,
                        fechaFinEstimada,
                    })
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} actualizado.`))
                    break
                }

                case 'avance': {
                    encabezado('Registrar avance', [
                        proyecto.comoSeCalculaElAvance,
                        'El avance no puede retroceder.',
                    ])

                    // Ojo: aquí ya NO se le pone `min: proyecto.avance` a la
                    // pregunta. Esa regla es del negocio y la valida la
                    // estrategia AvanceManual; la consola no la repite.
                    const porcentaje = await pedirNumero('Nuevo avance', {
                        min: 0,
                        max: 100,
                        entero: true,
                        ejemplo: '50',
                    })

                    const p = await proyectos.registrarAvance(proyecto._id, porcentaje)
                    console.log(
                        '\n' + mensaje.exito('Avance actualizado:') + ` ${barraDeAvance(p.avance)}`,
                    )
                    break
                }

                case 'finalizar': {
                    encabezado('Finalizar proyecto', [
                        'Solo se finaliza un proyecto que esté al 100%.',
                    ])

                    const seguro = await confirmar(
                        `¿Finalizar ${proyecto.codigo} "${proyecto.nombre}"?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const p = await proyectos.finalizar(proyecto._id)
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} finalizado.`))
                    break
                }

                case 'cancelar': {
                    encabezado('Cancelar proyecto')
                    console.log(AVISO_CANCELAR)

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

                    const p = await proyectos.cancelar(proyecto._id, motivo)
                    console.log('\n' + mensaje.exito(`Proyecto ${p.codigo} cancelado.`))
                    break
                }
            }
        })

        // Si el proyecto se cerró, no tiene sentido seguir dentro de él.
        if (salioBien && (accion === 'finalizar' || accion === 'cancelar')) return
    }
}

/** MENÚ PRINCIPAL DE PROYECTOS. */
export async function menuProyectos(servicios) {
    const { proyectos, entregables } = servicios

    while (true) {
        const accion = await elegirAccion('PROYECTOS', [
            { nombre: 'Abrir un proyecto', valor: 'abrir' },
            { separador: true },
            { nombre: 'Listar todos', valor: 'listar' },
            { nombre: 'Filtrar por estado', valor: 'filtrar' },
            { nombre: 'Entregables vencidos (todos los proyectos)', valor: 'vencidos' },
            { separador: true },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        if (accion === 'volver') return

        await ejecutarAccion(async () => {
            switch (accion) {
                case 'abrir': {
                    const elegido = await elegirDeLista(await proyectos.listar(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'Todavía no hay proyectos. Acepta una propuesta primero.',
                    })
                    await menuUnProyecto(elegido._id, servicios)
                    break
                }

                case 'listar':
                    mostrarProyectos(await proyectos.listar())
                    break

                case 'filtrar': {
                    const estado = await pedirSegunRegla(
                        'Estado a filtrar',
                        Proyecto.REGLAS.estado,
                    )
                    mostrarProyectos(await proyectos.listar(estado))
                    break
                }

                case 'vencidos':
                    await mostrarVencidos(entregables)
                    break
            }
        })
    }
}
