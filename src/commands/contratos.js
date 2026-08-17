import {
    AVISO_CANCELAR,
    OperacionCancelada,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirNumero,
    pedirTexto,
} from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { formatearDinero, formatearFecha } from '../utils/formato.js'
import { mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { mostrarTabla } from '../utils/tabla.js'

/** Una línea por contrato, para las listas de elegir. */
function describirContrato(c) {
    return `${c.codigo.padEnd(9)} ${formatearDinero(c.valor).padEnd(16)} ${c.estado}`
}

/** Una línea por proyecto, para la lista de elegir. */
function describirProyecto(p) {
    return `${p.codigo.padEnd(9)} ${p.nombre.padEnd(30)} ${p.estado}`
}

function mostrarContratos(contratos) {
    mostrarTabla({
        cabeceras: ['Código', 'Valor', 'Forma de pago', 'Vigencia', 'Firmado', 'Estado'],
        filas: contratos.map((c) => [
            estilo.codigo(c.codigo),
            estilo.dinero(formatearDinero(c.valor)),
            c.formaPago,
            `${formatearFecha(c.fechaInicio)}\n${formatearFecha(c.fechaFin)}`,
            c.firmadoEn ? formatearFecha(c.firmadoEn) : estilo.tenue('sin firmar'),
            colorEstado(c.estado),
        ]),
        alineado: ['left', 'right', 'left', 'left', 'left', 'left'],
        vacio: 'No hay contratos para mostrar.',
        resumen: `Total: ${contratos.length} contrato(s)`,
    })
}

export async function menuContratos(contratoService) {
    while (true) {
        const accion = await elegirAccion('CONTRATOS', [
            { nombre: 'Listar contratos', valor: 'listar' },
            { nombre: 'Ver el contrato de un proyecto', valor: 'porProyecto' },
            { separador: true },
            { nombre: 'Editar contrato (solo borradores)', valor: 'editar' },
            { nombre: '⭐ Firmar contrato', valor: 'firmar' },
            { separador: true },
            { nombre: 'Imprimir documento del contrato', valor: 'imprimir' },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        try {
            switch (accion) {
                case 'listar':
                    mostrarContratos(await contratoService.listar())
                    break

                case 'porProyecto': {
                    const proyecto = await elegirDeLista(await contratoService.listarProyectos(), {
                        etiqueta: 'Elige el proyecto',
                        describir: describirProyecto,
                        siVacio: 'Todavía no hay proyectos.',
                    })
                    mostrarContratos([await contratoService.verPorProyecto(proyecto._id)])
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Editar condiciones ---'))
                    console.log(AVISO_CANCELAR)

                    const contrato = await elegirDeLista(await contratoService.listarBorradores(), {
                        etiqueta: 'Elige el contrato a editar',
                        describir: describirContrato,
                        siVacio: 'No hay contratos en borrador. Los firmados ya no se editan.',
                    })

                    console.log(
                        estilo.tenue('  Cada campo trae su valor actual: Enter lo deja igual.'),
                    )

                    const condiciones = await pedirTexto('Condiciones', {
                        min: 10,
                        actual: contrato.condiciones,
                    })
                    const formaPago = await pedirTexto('Forma de pago', {
                        actual: contrato.formaPago,
                    })
                    const valor = await pedirNumero('Valor en quetzales', {
                        min: 1,
                        actual: contrato.valor,
                    })

                    await contratoService.editar(contrato._id, { condiciones, formaPago, valor })
                    console.log('\n' + mensaje.exito(`Contrato ${contrato.codigo} actualizado.`))
                    break
                }

                case 'firmar': {
                    console.log(estilo.titulo('\n--- Firmar contrato ---'))
                    console.log(
                        estilo.tenue(
                            '  Activa el contrato y sincroniza el proyecto, en una transacción.',
                        ),
                    )

                    const contrato = await elegirDeLista(await contratoService.listarBorradores(), {
                        etiqueta: 'Elige el contrato a firmar',
                        describir: describirContrato,
                        siVacio: 'No hay contratos en borrador pendientes de firma.',
                    })

                    // Firmar es irreversible: se confirma antes.
                    const seguro = await confirmar(
                        `¿Firmar el contrato ${contrato.codigo} por ${formatearDinero(contrato.valor)}?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const c = await conSpinner('Firmando dentro de una transacción...', () =>
                        contratoService.firmar(contrato._id),
                    )
                    panelTransaccion('Transacción completada · 2 colecciones', [
                        `El contrato ${estilo.codigo(c.codigo)} quedó ACTIVO`,
                        'El proyecto quedó marcado como formalizado',
                    ])
                    break
                }

                case 'imprimir': {
                    const contrato = await elegirDeLista(await contratoService.listar(), {
                        etiqueta: 'Elige el contrato a imprimir',
                        describir: describirContrato,
                        siVacio: 'Todavía no hay contratos.',
                    })
                    // El documento va en su propio recuadro: es lo que el
                    // cliente firmaría, conviene que se distinga del resto.
                    mostrarPanel({
                        titulo: ` Contrato ${contrato.codigo} `,
                        lineas: (await contratoService.generarDocumento(contrato._id)).split('\n'),
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
