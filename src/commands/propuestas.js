import { Propuesta } from '../models/Propuesta.js'
import {
    AVISO_CANCELAR,
    elegirAccion,
    elegirDeLista,
    pedirSegunRegla,
    pedirTexto,
} from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { fechaRelativa, formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'
import { ejecutarAccion, encabezado } from './comun.js'

// CAPA DE PRESENTACIÓN — PROPUESTAS

function describirCliente(c) {
    return `${(c.codigo ?? '---').padEnd(9)} ${c.nombre.padEnd(24)} <${c.email}>`
}

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
            { nombre: 'Aceptar propuesta (genera proyecto y contrato)', valor: 'aceptar' },
            { nombre: 'Rechazar propuesta', valor: 'rechazar' },
            { separador: true },
            { nombre: 'Ver estadísticas', valor: 'estadisticas' },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        if (accion === 'volver') return

        await ejecutarAccion(async () => {
            switch (accion) {
                case 'crear': {
                    encabezado('Nueva propuesta')
                    console.log(AVISO_CANCELAR)

                    const cliente = await elegirDeLista(
                        await propuestaService.listarClientesDisponibles(),
                        {
                            etiqueta: 'Elige el cliente que recibe la propuesta',
                            describir: describirCliente,
                            siVacio: 'No hay clientes activos. Crea uno primero en Clientes.',
                        },
                    )

                    // Antes esta pantalla pedía el título con `min: 3` mientras
                    // el modelo exigía 5: el usuario escribía 4 caracteres, la
                    // consola lo aceptaba y el error saltaba después. Al salir
                    // la pregunta de la regla, ese desajuste ya no puede pasar.
                    const titulo = await pedirSegunRegla('Título', Propuesta.REGLAS.titulo, {
                        ejemplo: 'Rediseño de la tienda online',
                    })
                    const descripcion = await pedirSegunRegla(
                        'Descripción',
                        Propuesta.REGLAS.descripcion,
                    )
                    const monto = await pedirSegunRegla('Monto', Propuesta.REGLAS.monto, {
                        ejemplo: '20000',
                    })
                    const plazoDias = await pedirSegunRegla(
                        'Plazo en días',
                        Propuesta.REGLAS.plazoDias,
                        { ejemplo: '45' },
                    )

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
                    const estado = await pedirSegunRegla(
                        'Estado a filtrar',
                        Propuesta.REGLAS.estado,
                    )
                    mostrarPropuestas(await propuestaService.listar(estado))
                    break
                }

                case 'editar': {
                    encabezado('Editar propuesta', [
                        'Pulsa Enter para dejar un campo como está.',
                        'Solo se editan las pendientes.',
                    ])
                    console.log(AVISO_CANCELAR)

                    const propuesta = await elegirDeLista(
                        await propuestaService.listarPendientes(),
                        {
                            etiqueta: 'Elige la propuesta a editar',
                            describir: describirPropuesta,
                            siVacio: 'No hay propuestas pendientes. Las aceptadas ya no se editan.',
                        },
                    )

                    const titulo = await pedirSegunRegla('Título', Propuesta.REGLAS.titulo, {
                        actual: propuesta.titulo,
                    })
                    const descripcion = await pedirSegunRegla(
                        'Descripción',
                        Propuesta.REGLAS.descripcion,
                        { actual: propuesta.descripcion },
                    )
                    const monto = await pedirSegunRegla('Monto', Propuesta.REGLAS.monto, {
                        actual: propuesta.monto,
                    })
                    const plazoDias = await pedirSegunRegla(
                        'Plazo en días',
                        Propuesta.REGLAS.plazoDias,
                        { actual: propuesta.plazoDias },
                    )

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
                    encabezado('Aceptar propuesta', [
                        'Esto creará el proyecto y su contrato dentro de una transacción.',
                    ])

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
                    console.log(
                        estilo.tenue(
                            '  Sus entregables y su contrato están dentro de Proyectos.\n',
                        ),
                    )
                    break
                }

                case 'rechazar': {
                    encabezado('Rechazar propuesta')
                    console.log(AVISO_CANCELAR)

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
            }
        })
    }
}
