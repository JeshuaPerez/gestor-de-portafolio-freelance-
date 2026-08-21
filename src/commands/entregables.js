import { Entregable } from '../models/Entregable.js'
import { CambioEstado } from '../models/estados/CambioEstado.js'
import {
    AVISO_CANCELAR,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirSegunRegla,
    pedirTexto,
} from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { barraDeAvance, colorEstado, estilo, mensaje } from '../utils/estilo.js'
import {
    diasHasta,
    duracionEntre,
    fechaRelativa,
    formatearFecha,
    formatearFechaHora,
} from '../utils/formato.js'
import { comoFicha, mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'
import { ejecutarAccion, encabezado } from './comun.js'

// ENTREGABLES DE UN PROYECTO
//
// Este menú YA NO se cuelga del menú principal. Un entregable no existe por
// sí solo: siempre pertenece a un proyecto. Antes eso se notaba en que cada
// acción empezaba obligando al usuario a elegir un proyecto otra vez.
//
// Ahora el proyecto llega ya elegido desde commands/proyectos.js y todas las
// acciones ocurren dentro de él.

function describirEntregable(e) {
    const codigo = (e.codigo ?? '---').padEnd(9)
    return `${codigo} ${e.titulo.padEnd(28)} peso ${String(e.peso).padStart(3)}  ${e.estado}`
}

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

export function mostrarEntregables(entregables) {
    mostrarTabla({
        cabeceras: ['Código', 'Título', 'Peso', 'Fecha límite', 'Estado', 'Último cambio'],
        filas: entregables.map((e) => {
            // Cómo se lee una entrada del historial lo dice CambioEstado, no
            // esta pantalla: antes aquí se concatenaban `desde` y `hasta` a
            // mano, y con la entrada de alta (que no tiene `desde`) eso habría
            // acabado imprimiendo "null → pendiente".
            const ultimo = CambioEstado.listaDesdeDocumento(e.historial).at(-1)
            return [
                estilo.codigo(e.codigo ?? '---'),
                e.titulo,
                String(e.peso),
                describirLimite(e),
                colorEstado(e.estado),
                ultimo
                    ? ultimo.describir() +
                      (ultimo.motivo ? `\n${estilo.tenue(ultimo.motivo)}` : '')
                    : estilo.tenue('-'),
            ]
        }),
        alineado: ['left', 'left', 'right', 'left', 'left', 'left'],
        vacio: 'Este proyecto todavía no tiene entregables.',
        resumen: `Total: ${entregables.length} entregable(s)`,
    })
}

/**
 * HISTORIAL DE ESTADOS DE UN ENTREGABLE.
 *
 * Una fila por cambio, del más antiguo al más reciente. Dos columnas merecen
 * explicación:
 *
 *  · "Estado anterior" sale vacío en la primera fila y pone "(alta)": esa
 *    entrada no es una transición, es el nacimiento del entregable;
 *  · "Tiempo en el estado" no está guardado en ninguna parte. Se calcula
 *    restando la fecha de una entrada a la de la siguiente. La última fila
 *    dice "en curso" porque ese estado es el de ahora mismo y todavía no ha
 *    terminado de contar.
 */
export function mostrarHistorial({ codigo, titulo, estado, cambios }) {
    mostrarPanel({
        titulo: ` ${codigo} · Historial de estados `,
        lineas: comoFicha([
            ['Entregable', titulo],
            ['Estado actual', colorEstado(estado)],
            ['Cambios registrados', String(cambios.length)],
        ]),
    })

    mostrarTabla({
        cabeceras: ['#', 'Fecha', 'Estado anterior', 'Estado nuevo', 'Motivo', 'Tiempo en el estado'],
        filas: cambios.map((cambio, posicion) => {
            const siguiente = cambios[posicion + 1]

            return [
                String(posicion + 1),
                `${formatearFechaHora(cambio.fecha)}\n${estilo.tenue(fechaRelativa(cambio.fecha))}`,
                cambio.esAlta() ? estilo.tenue('(alta)') : colorEstado(cambio.desde),
                colorEstado(cambio.hasta),
                cambio.motivo ?? estilo.tenue('-'),
                siguiente
                    ? duracionEntre(cambio.fecha, siguiente.fecha)
                    : estilo.tenue('en curso'),
            ]
        }),
        alineado: ['right', 'left', 'left', 'left', 'left', 'right'],
        vacio: 'Este entregable no tiene cambios registrados todavía.',
        resumen: `${cambios.length} cambio(s) de estado`,
    })
}

/** Elige un entregable de ESTE proyecto. Ya no vuelve a preguntar por el proyecto. */
async function elegirEntregable(entregableService, proyecto, etiqueta) {
    const entregables = await entregableService.listarPorProyecto(proyecto._id)

    return elegirDeLista(entregables, {
        etiqueta,
        describir: describirEntregable,
        siVacio: `${proyecto.codigo} no tiene entregables todavía. Crea uno primero.`,
    })
}

/**
 * MENÚ DE ENTREGABLES DENTRO DE UN PROYECTO.
 *
 * @param {object} proyecto           el proyecto ya elegido
 * @param {object} entregableService  su único servicio (ISP: no recibe la app entera)
 */
export async function menuEntregablesDeProyecto(proyecto, entregableService) {
    while (true) {
        const entregables = await entregableService.listarPorProyecto(proyecto._id)

        const accion = await elegirAccion(
            `ENTREGABLES · ${proyecto.codigo} ${proyecto.nombre}`,
            [
                { nombre: `Ver los ${entregables.length} entregables`, valor: 'listar' },
                { nombre: 'Crear entregable', valor: 'crear' },
                { nombre: 'Editar entregable', valor: 'editar' },
                { separador: true },
                { nombre: 'Cambiar estado (recalcula el avance)', valor: 'estado' },
                { nombre: 'Ver historial de cambios de estado', valor: 'historial' },
                { nombre: 'Eliminar entregable', valor: 'eliminar' },
                { separador: true },
                { nombre: 'Volver al proyecto', valor: 'volver' },
            ],
        )

        if (accion === 'volver') return

        await ejecutarAccion(async () => {
            switch (accion) {
                case 'listar':
                    mostrarEntregables(entregables)
                    break

                case 'crear': {
                    encabezado(`Nuevo entregable en ${proyecto.codigo}`, [
                        `Fin previsto del proyecto: ${formatearFecha(proyecto.fechaFinEstimada)}`,
                        'El peso indica cuánto representa este entregable sobre el total.',
                    ])
                    console.log(AVISO_CANCELAR)

                    // Los límites salen de las REGLAS del modelo: si el modelo
                    // cambia, la pregunta cambia sola.
                    const titulo = await pedirSegunRegla('Título', Entregable.REGLAS.titulo, {
                        ejemplo: 'Diseño de la interfaz',
                    })
                    const descripcion = await pedirSegunRegla(
                        'Descripción',
                        Entregable.REGLAS.descripcion,
                    )
                    const fechaLimite = await pedirSegunRegla(
                        'Fecha límite',
                        Entregable.REGLAS.fechaLimite,
                    )
                    const peso = await pedirSegunRegla('Peso', Entregable.REGLAS.peso, {
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

                case 'editar': {
                    encabezado('Editar entregable', [
                        'Solo se editan los pendientes o rechazados.',
                        'Si cambias el peso, el avance del proyecto se recalcula.',
                    ])
                    console.log(AVISO_CANCELAR)

                    const entregable = await elegirEntregable(
                        entregableService,
                        proyecto,
                        'Elige el entregable a editar',
                    )

                    const titulo = await pedirSegunRegla('Título', Entregable.REGLAS.titulo, {
                        actual: entregable.titulo,
                    })
                    const descripcion = await pedirSegunRegla(
                        'Descripción',
                        Entregable.REGLAS.descripcion,
                        { actual: entregable.descripcion },
                    )
                    const fechaLimite = await pedirSegunRegla(
                        'Fecha límite',
                        Entregable.REGLAS.fechaLimite,
                        { actual: new Date(entregable.fechaLimite).toISOString().slice(0, 10) },
                    )
                    const peso = await pedirSegunRegla('Peso', Entregable.REGLAS.peso, {
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
                    encabezado('Cambiar estado', [
                        'Flujo: pendiente → entregado → aprobado / rechazado',
                    ])

                    const entregable = await elegirEntregable(
                        entregableService,
                        proyecto,
                        'Elige el entregable',
                    )

                    // Qué se puede hacer lo decide el DOMINIO (patrón State), no
                    // esta pantalla. Antes aquí se leía Entregable.TRANSICIONES
                    // directamente: lógica de negocio en la capa de consola.
                    const posibles = entregableService.transicionesPosibles(entregable)

                    console.log(`\n  Estado actual: ${colorEstado(entregable.estado)}`)

                    if (posibles.length === 0) {
                        console.log(
                            mensaje.aviso(
                                `"${entregable.titulo}" está ${entregable.estado}: es un estado final, ya no se mueve.`,
                            ),
                        )
                        break
                    }

                    const estado = await pedirSegunRegla('Nuevo estado', {
                        tipo: 'lista',
                        valores: posibles,
                    })

                    // El motivo solo se pide cuando el estado destino lo exige.
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

                case 'historial': {
                    encabezado('Historial de cambios de estado', [
                        'Cada transición queda guardada con el estado anterior, el nuevo y la fecha.',
                        'El registro es solo de lectura: no se puede editar ni borrar.',
                    ])

                    const consultado = await elegirEntregable(
                        entregableService,
                        proyecto,
                        'Elige el entregable a consultar',
                    )

                    // Se pregunta por el código, que es lo que el usuario ve en
                    // pantalla. El servicio acepta el código o el _id indistintamente.
                    const historial = await entregableService.historialDe(
                        consultado.codigo ?? consultado._id,
                    )

                    mostrarHistorial(historial)
                    break
                }

                case 'eliminar': {
                    encabezado('Eliminar entregable', [
                        'Un entregable aprobado no se puede eliminar: es historia del proyecto.',
                    ])

                    const entregable = await elegirEntregable(
                        entregableService,
                        proyecto,
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
            }
        })
    }
}

/**
 * VENCIDOS DE TODOS LOS PROYECTOS.
 *
 * Esta es la única vista de entregables que NO es de un proyecto concreto:
 * es una alerta transversal ("qué se me está pasando"). Por eso vive en el
 * menú de Proyectos y no dentro de uno.
 */
export async function mostrarVencidos(entregableService) {
    const vencidos = await entregableService.listarVencidos()

    mostrarTabla({
        cabeceras: ['Código', 'Título', 'Peso', 'Fecha límite', 'Estado'],
        filas: vencidos.map((e) => [
            estilo.codigo(e.codigo ?? '---'),
            e.titulo,
            String(e.peso),
            describirLimite(e),
            colorEstado(e.estado),
        ]),
        alineado: ['left', 'left', 'right', 'left', 'left'],
        vacio: 'No hay entregables vencidos. Todo al día.',
        resumen: `${vencidos.length} entregable(s) vencido(s)`,
    })
}
