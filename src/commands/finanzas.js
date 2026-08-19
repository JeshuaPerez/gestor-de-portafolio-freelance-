import { Movimiento } from '../models/Movimiento.js'
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
import { estilo, mensaje } from '../utils/estilo.js'
import { formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'

// UNA LINEA POR PROYECTO, PARA LAS LISTAS DE ELEGIR.
function describirProyecto(p) {
    return `${p.codigo.padEnd(9)} ${p.nombre.padEnd(30)} ${formatearDinero(p.monto)}`
}

// UNA LINEA POR MOVIMIENTO, PARA LA LISTA DE ELEGIR.
function describirMovimiento(m) {
    const signo = m.tipo === 'ingreso' ? '+' : '-'
    const codigo = (m.codigo ?? '---').padEnd(9)
    return `${codigo} ${(signo + formatearDinero(m.monto)).padEnd(17)} ${m.concepto}`
}

function mostrarMovimientos(movimientos) {
    mostrarTabla({
        cabeceras: ['Código', 'Monto', 'Concepto', 'Tipo / Categoría', 'Referencia', 'Fecha'],
        filas: movimientos.map((m) => {
            // EL DINERO QUE ENTRA EN VERDE, EL QUE SALE, EN ROJO.
            const entra = m.tipo === 'ingreso'
            const monto = `${entra ? '+' : '-'}${formatearDinero(m.monto)}`
            return [
                estilo.codigo(m.codigo ?? '---'),
                entra ? estilo.exito(monto) : estilo.error(monto),
                m.concepto,
                `${m.tipo}\n${estilo.tenue(m.categoria)}`,
                m.referencia,
                formatearFecha(m.fecha),
            ]
        }),
        alineado: ['left', 'right', 'left', 'left', 'left', 'left'],
        vacio: 'No hay movimientos para mostrar.',
        resumen: `Total: ${movimientos.length} movimiento(s)`,
    })
}

function mostrarBalance(titulo, { ingresos, egresos, balance }) {
    // EL BALANCE EN ROJO SI ES NEGATIVO: ESTAS PERDIENDO DINERO.
    const color = balance >= 0 ? estilo.dinero : estilo.error

    mostrarPanel({
        titulo: ` ${titulo} `,
        tono: balance >= 0 ? 'exito' : 'error',
        lineas: comoFicha([
            ['Ingresos', estilo.exito(formatearDinero(ingresos))],
            ['Egresos', estilo.error(formatearDinero(egresos))],
            ['BALANCE', color(formatearDinero(balance))],
        ]),
    })
}

export async function menuFinanzas(finanzaService) {
    while (true) {
        const accion = await elegirAccion('FINANZAS', [
            { nombre: '⭐ Registrar ingreso o egreso', valor: 'registrar' },
            { nombre: 'Listar movimientos', valor: 'listar' },
            { nombre: 'Corregir el concepto de un movimiento', valor: 'editar' },
            { separador: true },
            { nombre: 'Balance general', valor: 'balance' },
            { nombre: 'Balance por cliente', valor: 'balanceCliente' },
            { nombre: 'Rentabilidad de un proyecto', valor: 'rentabilidad' },
            { separador: true },
            { nombre: 'Anular un movimiento', valor: 'anular' },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        try {
            switch (accion) {
                case 'registrar': {
                    console.log(estilo.titulo('\n--- Nuevo movimiento ---'))
                    console.log(AVISO_CANCELAR)

                    const proyecto = await elegirDeLista(await finanzaService.listarProyectos(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'Todavía no hay proyectos.',
                    })

                    const pendiente = proyecto.monto - (proyecto.cobrado ?? 0)
                    console.log(
                        estilo.tenue(`  Presupuesto: ${formatearDinero(proyecto.monto)}`),
                    )
                    console.log(
                        estilo.tenue(`  Pendiente de cobro: ${formatearDinero(pendiente)}`),
                    )

                    const tipo = await pedirOpcion('Tipo de movimiento', Movimiento.TIPOS)

                    const categoria = await pedirOpcion(
                        `Categoría del ${tipo}`,
                        Movimiento.CATEGORIAS[tipo],
                    )

                    const concepto = await pedirTexto('Concepto', {
                        min: 3,
                        ejemplo: 'Anticipo del 50%',
                    })

                    const monto = await pedirNumero('Monto en quetzales', {
                        min: 1,
                        max: tipo === 'ingreso' ? pendiente : null,
                        ejemplo: '5000',
                    })

                    const referencia = await pedirTexto('Referencia (nº de factura o comprobante)', {
                        min: 3,
                        ejemplo: 'FEL-2026-014',
                    })

                    const m = await conSpinner('Registrando dentro de una transacción...', () =>
                        finanzaService.registrar({
                            proyectoId: proyecto._id,
                            tipo,
                            categoria,
                            concepto,
                            monto,
                            referencia,
                        }),
                    )
                    panelTransaccion('Transacción completada · 2 colecciones', [
                        `Movimiento ${estilo.codigo(m.codigo)} registrado (ref. ${m.referencia})`,
                        `Acumulado del proyecto actualizado (${m.tipo})`,
                    ])
                    break
                }

                case 'listar': {
                    const filtrar = await confirmar('¿Filtrar por un proyecto?')

                    let filtros = {}
                    if (filtrar) {
                        const proyecto = await elegirDeLista(
                            await finanzaService.listarProyectos(),
                            {
                                etiqueta: 'Elige el proyecto',
                                describir: describirProyecto,
                                siVacio: 'Todavía no hay proyectos.',
                            },
                        )
                        filtros = { proyectoId: proyecto._id }
                    }

                    mostrarMovimientos(await finanzaService.listar(filtros))
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Corregir concepto ---'))
                    console.log(
                        estilo.tenue(
                            '  De un movimiento solo se corrige el concepto, que es una\n' +
                                '  descripción. El monto, el tipo y la categoría NO se editan:\n' +
                                '  moverían el balance sin dejar rastro. Si un importe está mal,\n' +
                                '  se anula el movimiento y se registra de nuevo.',
                        ),
                    )

                    const movimiento = await elegirDeLista(await finanzaService.listar({}), {
                        etiqueta: 'Elige el movimiento',
                        describir: describirMovimiento,
                        siVacio: 'No hay movimientos que corregir.',
                    })

                    const concepto = await pedirTexto('Concepto', {
                        min: 3,
                        actual: movimiento.concepto,
                    })

                    await finanzaService.editarConcepto(movimiento._id, concepto)
                    console.log(
                        '\n' +
                            mensaje.exito(
                                `Concepto de ${movimiento.codigo ?? movimiento.referencia} corregido.`,
                            ),
                    )
                    break
                }

                case 'balance': {
                    const acotar = await confirmar('¿Acotar entre dos fechas?')

                    let desde = null
                    let hasta = null
                    if (acotar) {
                        desde = await pedirFecha('Desde')
                        hasta = await pedirFecha('Hasta')
                    }

                    mostrarBalance('Balance general', await finanzaService.balance({ desde, hasta }))
                    break
                }

                case 'balanceCliente': {
                    const filas = await finanzaService.balancePorCliente()
                    if (filas.length === 0) {
                        console.log(estilo.tenue('\n  (Todavía no hay movimientos)\n'))
                        break
                    }
                    mostrarTabla({
                        cabeceras: ['Cliente', 'Ingresos', 'Egresos', 'Balance'],
                        alineado: ['left', 'right', 'right', 'right'],
                        filas: filas.map((f) => [
                            f.cliente,
                            estilo.exito(formatearDinero(f.ingresos)),
                            estilo.error(formatearDinero(f.egresos)),
                            f.balance >= 0
                                ? estilo.dinero(formatearDinero(f.balance))
                                : estilo.error(formatearDinero(f.balance)),
                        ]),
                        resumen: `${filas.length} cliente(s) con movimientos`,
                    })
                    break
                }

                case 'rentabilidad': {
                    const proyecto = await elegirDeLista(await finanzaService.listarProyectos(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'Todavía no hay proyectos.',
                    })

                    const r = await finanzaService.rentabilidad(proyecto._id)

                    mostrarPanel({
                        titulo: ` Rentabilidad · ${r.codigo} ${r.proyecto} `,
                        tono: r.utilidad >= 0 ? 'exito' : 'error',
                        lineas: comoFicha([
                            ['Presupuesto', formatearDinero(r.presupuesto)],
                            ['Cobrado', estilo.exito(formatearDinero(r.cobrado))],
                            ['Gastado', estilo.error(formatearDinero(r.gastado))],
                            ['Utilidad', estilo.dinero(formatearDinero(r.utilidad))],
                            ['Pendiente de cobro', estilo.aviso(formatearDinero(r.pendienteDeCobro))],
                            ['Margen', estilo.dato(`${r.margen}%`)],
                        ]),
                    })
                    break
                }

                case 'anular': {
                    console.log(estilo.titulo('\n--- Anular movimiento ---'))
                    console.log(
                        estilo.tenue(
                            '  El movimiento no se borra: se marca como anulado y se revierte\n' +
                                '  del acumulado, para no perder el rastro contable.',
                        ),
                    )

                    // `listar()` YA EXCLUYE LOS ANULADOS, ASÍ QUE NO SE PUEDE ELEGIR UNO QUE YA LO ESTÉ.
                    const movimiento = await elegirDeLista(await finanzaService.listar({}), {
                        etiqueta: 'Elige el movimiento a anular',
                        describir: describirMovimiento,
                        siVacio: 'No hay movimientos que anular.',
                    })

                    const motivo = await pedirTexto('Motivo de la anulación', {
                        min: 5,
                        ejemplo: 'Se registró dos veces por error',
                    })

                    const seguro = await confirmar(
                        `¿Anular ${movimiento.codigo ?? movimiento.referencia} por ${formatearDinero(movimiento.monto)}?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const m = await conSpinner('Revirtiendo dentro de una transacción...', () =>
                        finanzaService.anular(movimiento._id, motivo),
                    )
                    panelTransaccion('Transacción completada · 2 colecciones', [
                        `Movimiento ${estilo.codigo(m.codigo ?? m.referencia)} anulado`,
                        'El acumulado del proyecto se revirtió',
                    ])
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
