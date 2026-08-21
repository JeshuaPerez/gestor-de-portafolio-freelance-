import { Contrato } from '../models/Contrato.js'
import { AVISO_CANCELAR, confirmar, elegirAccion, pedirSegunRegla } from '../utils/entrada.js'
import { conSpinner } from '../utils/espera.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { formatearDinero, formatearFecha } from '../utils/formato.js'
import { comoFicha, mostrarPanel, panelTransaccion } from '../utils/panel.js'
import { ejecutarAccion, encabezado } from './comun.js'

// CONTRATO DE UN PROYECTO
//
// Igual que los entregables, esto tampoco es un módulo del menú principal.
// La relación proyecto-contrato es 1:1: no tiene sentido "buscar un contrato"
// como si viviera por su cuenta. Se entra por el proyecto.

/**
 * Maqueta el documento del contrato.
 *
 * Este texto lo construía ContratoService. Pero maquetar es presentación:
 * obligaba a la capa de negocio a importar utils/formato.js. Ahora el
 * servicio devuelve los datos y el dibujo se hace aquí.
 */
function maquetarDocumento({ contrato, cliente, proyecto }) {
    return [
        '='.repeat(64),
        `  CONTRATO DE PRESTACIÓN DE SERVICIOS  ·  ${contrato.codigo}`,
        '='.repeat(64),
        '',
        `  CLIENTE:   ${cliente?.nombre ?? '(no encontrado)'}`,
        `  EMPRESA:   ${cliente?.empresa ?? '-'}`,
        `  PROYECTO:  ${proyecto?.nombre ?? '(no encontrado)'}`,
        '',
        `  VALOR:     ${formatearDinero(contrato.valor)}`,
        `  PAGO:      ${contrato.formaPago}`,
        `  VIGENCIA:  ${formatearFecha(contrato.fechaInicio)} al ${formatearFecha(contrato.fechaFin)}`,
        '',
        '  CONDICIONES:',
        `  ${contrato.condiciones}`,
        '',
        `  ESTADO:    ${contrato.estado.toUpperCase()}`,
        `  FIRMADO:   ${contrato.firmadoEn ? formatearFecha(contrato.firmadoEn) : 'SIN FIRMAR'}`,
        '='.repeat(64),
    ].join('\n')
}

function mostrarFicha(contrato) {
    mostrarPanel({
        titulo: ` ${contrato.codigo} · Contrato `,
        lineas: comoFicha([
            ['Estado', colorEstado(contrato.estado)],
            ['Valor', estilo.dinero(formatearDinero(contrato.valor))],
            ['Forma de pago', contrato.formaPago],
            ['Inicio', formatearFecha(contrato.fechaInicio)],
            ['Fin', formatearFecha(contrato.fechaFin)],
            [
                'Firmado',
                contrato.firmadoEn
                    ? estilo.exito(formatearFecha(contrato.firmadoEn))
                    : estilo.aviso('SIN FIRMAR'),
            ],
            ['Condiciones', contrato.condiciones],
        ]),
    })
}

/**
 * MENÚ DEL CONTRATO DE UN PROYECTO.
 *
 * @param {object} proyecto         el proyecto ya elegido
 * @param {object} contratoService  su único servicio
 */
export async function menuContratoDeProyecto(proyecto, contratoService) {
    while (true) {
        let contrato = null
        try {
            contrato = await contratoService.verPorProyecto(proyecto._id)
        } catch {
            console.log('\n' + mensaje.aviso('Este proyecto todavía no tiene contrato.'))
            return
        }

        const accion = await elegirAccion(
            `CONTRATO · ${contrato.codigo} (${contrato.estado})`,
            [
                { nombre: 'Ver ficha del contrato', valor: 'ficha' },
                { nombre: 'Ver documento imprimible', valor: 'documento' },
                { separador: true },
                { nombre: 'Editar condiciones (solo borrador)', valor: 'editar' },
                { nombre: 'Firmar contrato', valor: 'firmar' },
                { separador: true },
                { nombre: 'Volver al proyecto', valor: 'volver' },
            ],
        )

        if (accion === 'volver') return

        await ejecutarAccion(async () => {
            switch (accion) {
                case 'ficha':
                    mostrarFicha(contrato)
                    break

                case 'documento':
                    console.log('')
                    console.log(
                        maquetarDocumento(
                            await contratoService.datosParaDocumento(contrato._id),
                        ),
                    )
                    console.log('')
                    break

                case 'editar': {
                    encabezado('Editar contrato', [
                        'Solo se edita mientras esté en borrador.',
                        'Un contrato firmado ya no se toca.',
                    ])
                    console.log(AVISO_CANCELAR)

                    const condiciones = await pedirSegunRegla(
                        'Condiciones',
                        Contrato.REGLAS.condiciones,
                        { actual: contrato.condiciones },
                    )
                    const formaPago = await pedirSegunRegla(
                        'Forma de pago',
                        Contrato.REGLAS.formaPago,
                        { actual: contrato.formaPago, ejemplo: '50% anticipo, 50% al entregar' },
                    )
                    const valor = await pedirSegunRegla('Valor', Contrato.REGLAS.valor, {
                        actual: contrato.valor,
                    })

                    const c = await contratoService.editar(contrato._id, {
                        condiciones,
                        formaPago,
                        valor,
                    })
                    console.log('\n' + mensaje.exito(`Contrato ${c.codigo} actualizado.`))
                    break
                }

                case 'firmar': {
                    encabezado('Firmar contrato', [
                        'Firmar activa el contrato y lo marca en el proyecto, en una transacción.',
                        'Hace falta haber redactado las condiciones.',
                    ])

                    mostrarFicha(contrato)

                    const seguro = await confirmar(
                        `¿Firmar el contrato ${contrato.codigo} por ${formatearDinero(contrato.valor)}?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    const c = await conSpinner('Firmando y sincronizando el proyecto...', () =>
                        contratoService.firmar(contrato._id),
                    )

                    panelTransaccion('Transacción completada · 2 colecciones', [
                        `Contrato ${c.codigo} pasó a ${colorEstado('activo')}`,
                        `Proyecto ${proyecto.codigo} marcado como CON CONTRATO FIRMADO`,
                    ])
                    break
                }
            }
        })
    }
}
