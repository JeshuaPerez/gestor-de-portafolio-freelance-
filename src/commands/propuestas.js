import {
    AVISO_CANCELAR,
    OperacionCancelada,
    elegirAccion,
    elegirDeLista,
    pedirNumero,
    pedirOpcion,
    pedirTexto,
} from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { fechaRelativa, formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'

const ESTADOS = ['pendiente', 'aceptada', 'rechazada']

/** Una línea por cliente, para la lista de elegir. */
function describirCliente(c) {
    return `${(c.codigo ?? '---').padEnd(9)} ${c.nombre.padEnd(24)} <${c.email}>`
}

/** Una línea por propuesta, para la lista de elegir. */
function describirPropuesta(p) {
    return `${p.codigo.padEnd(9)} ${p.titulo.padEnd(30)} ${formatearDinero(p.monto)}`
}

function mostrarPropuestas(propuestas) {
    mostrarTabla({
        cabeceras: ['Código', 'Título', 'Monto', 'Plazo', 'Vence', 'Estado'],
        filas: propuestas.map((p) => [
            estilo.codigo(p.codigo),
            p.motivoRechazo ? `${p.titulo}\n${estilo.tenue(p.motivoRechazo)}` : p.titulo,
            estilo.dinero(formatearDinero(p.monto)),
            `${p.plazoDias} días`,
            // La fecha, y debajo en tenue cuánto falta: "en 12 días".
            `${formatearFecha(p.fechaVencimiento)}\n${estilo.tenue(fechaRelativa(p.fechaVencimiento))}`,
            colorEstado(p.estado),
        ]),
        alineado: ['left', 'left', 'right', 'right', 'left', 'left'],
        vacio: 'No hay propuestas para mostrar.',
        resumen: `Total: ${propuestas.length} propuesta(s)`,
    })
}

export async function menuPropuestas(propuestaService) {
    while (true) {
        const accion = await elegirAccion('PROPUESTAS', [
            { nombre: 'Crear propuesta', valor: 'crear' },
            { nombre: 'Listar propuestas', valor: 'listar' },
            { nombre: 'Filtrar por estado', valor: 'filtrar' },
            { nombre: 'Editar propuesta (solo pendientes)', valor: 'editar' },
            { separador: true },
            { nombre: '⭐ Aceptar propuesta (genera proyecto y contrato)', valor: 'aceptar' },
            { nombre: 'Rechazar propuesta', valor: 'rechazar' },
            { separador: true },
            { nombre: 'Ver estadísticas', valor: 'estadisticas' },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        try {
            switch (accion) {
                case 'crear': {
                    console.log(estilo.titulo('\n--- Nueva propuesta ---'))
                    console.log(AVISO_CANCELAR)

                    // Primero se elige el cliente de la lista: así no hay
                    // forma de teclear un cliente que no existe.
                    const cliente = await elegirDeLista(
                        await propuestaService.listarClientesDisponibles(),
                        {
                            etiqueta: 'Elige el cliente que recibe la propuesta',
                            describir: describirCliente,
                            siVacio: 'No hay clientes activos. Crea uno primero en Clientes.',
                        },
                    )

                    const titulo = await pedirTexto('Título', {
                        min: 3,
                        ejemplo: 'Rediseño de la tienda online',
                    })
                    const descripcion = await pedirTexto('Descripción', { opcional: true })
                    const monto = await pedirNumero('Monto en quetzales', {
                        min: 1,
                        ejemplo: '20000',
                    })
                    const plazoDias = await pedirNumero('Plazo en días', {
                        min: 1,
                        max: 3650,
                        entero: true,
                        ejemplo: '45',
                    })

                    const codigo = await propuestaService.crear({
                        clienteId: cliente._id,
                        titulo,
                        descripcion,
                        monto,
                        plazoDias,
                    })
                    console.log(
                        '\n' + mensaje.exito(`Propuesta ${codigo} creada para ${cliente.nombre}.`),
                    )
                    break
                }

                case 'listar':
                    mostrarPropuestas(await propuestaService.listar())
                    break

                case 'filtrar': {
                    const estado = await pedirOpcion('Estado a filtrar', ESTADOS)
                    mostrarPropuestas(await propuestaService.listar(estado))
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Editar propuesta ---'))
                    console.log(AVISO_CANCELAR)

                    // Solo se ofrecen las pendientes: una propuesta aceptada
                    // ya generó proyecto y contrato, y cambiarla los dejaría
                    // diciendo cifras distintas.
                    const propuesta = await elegirDeLista(
                        await propuestaService.listarPendientes(),
                        {
                            etiqueta: 'Elige la propuesta a editar',
                            describir: describirPropuesta,
                            siVacio: 'No hay propuestas pendientes. Las aceptadas ya no se editan.',
                        },
                    )

                    console.log(estilo.tenue('  Pulsa Enter para dejar un campo como está.'))

                    const titulo = await pedirTexto('Título', {
                        min: 3,
                        actual: propuesta.titulo,
                    })
                    const descripcion = await pedirTexto('Descripción', {
                        opcional: true,
                        actual: propuesta.descripcion,
                    })
                    const monto = await pedirNumero('Monto en quetzales', {
                        min: 1,
                        actual: propuesta.monto,
                    })
                    const plazoDias = await pedirNumero('Plazo en días', {
                        min: 1,
                        max: 3650,
                        entero: true,
                        actual: propuesta.plazoDias,
                    })

                    await propuestaService.editar(propuesta._id, {
                        titulo,
                        descripcion,
                        monto,
                        plazoDias,
                    })
                    console.log('\n' + mensaje.exito(`Propuesta ${propuesta.codigo} actualizada.`))
                    break
                }

                case 'aceptar': {
                    console.log(estilo.titulo('\n--- Aceptar propuesta ---'))
                    console.log(
                        estilo.tenue(
                            '  Esto creará el proyecto y su contrato dentro de una transacción.',
                        ),
                    )

                    // Solo se ofrecen las pendientes: las demás darían error.
                    const propuesta = await elegirDeLista(
                        await propuestaService.listarPendientes(),
                        {
                            etiqueta: 'Elige la propuesta a aceptar',
                            describir: describirPropuesta,
                            siVacio: 'No hay propuestas pendientes.',
                        },
                    )

                    const proyecto = await conSpinner(
                        'Ejecutando la transacción en MongoDB...',
                        () => propuestaService.aceptar(propuesta._id),
                    )
                    panelTransaccion('Transacción completada · 3 colecciones', [
                        `La propuesta ${estilo.codigo(propuesta.codigo)} quedó ACEPTADA`,
                        `Nació el proyecto ${estilo.codigo(proyecto.codigo)} ${proyecto.nombre}`,
                        `Nació el contrato ${estilo.codigo(proyecto.codigoContrato)} en borrador`,
                    ])
                    break
                }

                case 'rechazar': {
                    console.log(estilo.titulo('\n--- Rechazar propuesta ---'))

                    const propuesta = await elegirDeLista(
                        await propuestaService.listarPendientes(),
                        {
                            etiqueta: 'Elige la propuesta a rechazar',
                            describir: describirPropuesta,
                            siVacio: 'No hay propuestas pendientes.',
                        },
                    )

                    const motivo = await pedirTexto('Motivo del rechazo', {
                        min: 5,
                        ejemplo: 'El cliente aplazó el presupuesto',
                    })

                    await propuestaService.rechazar(propuesta._id, motivo)
                    console.log('\n' + mensaje.exito(`Propuesta ${propuesta.codigo} rechazada.`))
                    break
                }

                case 'estadisticas': {
                    const e = await propuestaService.estadisticas()
                    mostrarPanel({
                        titulo: ' Estadísticas de propuestas ',
                        lineas: comoFicha([
                            ['Total', estilo.dato(e.total)],
                            ['Pendientes', estilo.aviso(e.pendientes)],
                            ['Aceptadas', estilo.exito(e.aceptadas)],
                            ['Rechazadas', estilo.error(e.rechazadas)],
                            ['Conversión', estilo.dato(`${e.conversion}%`)],
                        ]),
                    })
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
