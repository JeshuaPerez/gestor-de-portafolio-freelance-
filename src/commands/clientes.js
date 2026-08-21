import { Cliente } from '../models/Cliente.js'
import {
    AVISO_CANCELAR,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirSegunRegla,
    pedirTexto,
} from '../utils/entrada.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { mostrarTabla } from '../utils/tabla.js'
import { ejecutarAccion, encabezado } from './comun.js'

// CAPA DE PRESENTACIÓN — CLIENTES
// Solo pregunta y muestra. No consulta la base de datos ni decide reglas.

function describirCliente(c) {
    const codigo = (c.codigo ?? '---').padEnd(9)
    return `${codigo} ${c.nombre.padEnd(24)} <${c.email}>`
}

function mostrarClientes(clientes) {
    mostrarTabla({
        cabeceras: ['Código', 'Nombre', 'Email', 'Empresa', 'Estado'],
        filas: clientes.map((c) => [
            estilo.codigo(c.codigo ?? '---'),
            c.nombre,
            c.email,
            c.empresa ?? '-',
            colorEstado(c.activo ? 'activo' : 'inactivo'),
        ]),
        vacio: 'No hay clientes para mostrar.',
        resumen: `Total: ${clientes.length} cliente(s)`,
    })
}

export async function menuClientes(clienteService) {
    while (true) {
        const accion = await elegirAccion('GESTIÓN DE CLIENTES', [
            { nombre: 'Crear cliente', valor: 'crear' },
            { nombre: 'Listar clientes', valor: 'listar' },
            { nombre: 'Buscar cliente', valor: 'buscar' },
            { nombre: 'Editar cliente', valor: 'editar' },
            { separador: true },
            { nombre: 'Desactivar cliente', valor: 'desactivar' },
            { nombre: 'Reactivar cliente', valor: 'reactivar' },
            { separador: true },
            { nombre: 'Volver al menú principal', valor: 'volver' },
        ])

        if (accion === 'volver') return

        await ejecutarAccion(async () => {
            switch (accion) {
                case 'crear': {
                    encabezado('Nuevo cliente')
                    console.log(AVISO_CANCELAR)

                    // Las preguntas salen de Cliente.REGLAS: los mínimos que ve
                    // el usuario son exactamente los que valida el modelo.
                    const nombre = await pedirSegunRegla('Nombre', Cliente.REGLAS.nombre, {
                        ejemplo: 'Ana Gómez',
                    })
                    const email = await pedirSegunRegla('Email', Cliente.REGLAS.email)
                    const empresa = await pedirSegunRegla('Empresa', Cliente.REGLAS.empresa, {
                        ejemplo: 'Constructora Ejemplo, S.A.',
                    })
                    const telefono = await pedirSegunRegla('Teléfono', Cliente.REGLAS.telefono)

                    const codigo = await clienteService.crear({
                        nombre,
                        email,
                        empresa,
                        telefono,
                    })
                    console.log('\n' + mensaje.exito(`Cliente creado con el código ${codigo}`))
                    console.log(estilo.tenue('  Anótalo: con él podrás referirte a este cliente.'))
                    break
                }

                case 'listar':
                    mostrarClientes(await clienteService.listar())
                    break

                case 'buscar': {
                    const texto = await pedirTexto('Buscar por código, nombre, empresa o email', {
                        min: 2,
                        ejemplo: 'ana',
                    })
                    mostrarClientes(await clienteService.buscar(texto))
                    break
                }

                case 'editar': {
                    encabezado('Editar cliente', [
                        'Cada campo viene con su valor actual: pulsa Enter para dejarlo igual.',
                    ])
                    console.log(AVISO_CANCELAR)

                    const cliente = await elegirDeLista(await clienteService.listar(), {
                        etiqueta: 'Elige el cliente a editar',
                        describir: describirCliente,
                        siVacio: 'Todavía no hay clientes.',
                    })

                    const nombre = await pedirSegunRegla('Nombre', Cliente.REGLAS.nombre, {
                        actual: cliente.nombre,
                    })
                    const email = await pedirSegunRegla('Email', Cliente.REGLAS.email, {
                        actual: cliente.email,
                    })
                    const empresa = await pedirSegunRegla('Empresa', Cliente.REGLAS.empresa, {
                        actual: cliente.empresa,
                    })
                    const telefono = await pedirSegunRegla('Teléfono', Cliente.REGLAS.telefono, {
                        actual: cliente.telefono,
                    })

                    await clienteService.editar(cliente._id, { nombre, email, empresa, telefono })
                    console.log('\n' + mensaje.exito(`Cliente ${cliente.codigo} actualizado.`))
                    break
                }

                case 'desactivar': {
                    encabezado('Desactivar cliente', [
                        'Un cliente no se elimina nunca: se desactiva.',
                    ])

                    const cliente = await elegirDeLista(await clienteService.listarActivos(), {
                        etiqueta: 'Elige el cliente a desactivar',
                        describir: describirCliente,
                        siVacio: 'No hay clientes activos que desactivar.',
                    })

                    const seguro = await confirmar(
                        `¿Desactivar a "${cliente.nombre}" (${cliente.codigo})?`,
                    )
                    if (!seguro) {
                        console.log('\n' + mensaje.aviso('Operación cancelada.'))
                        break
                    }

                    await clienteService.desactivar(cliente._id)
                    console.log('\n' + mensaje.exito(`Cliente "${cliente.nombre}" desactivado.`))
                    console.log(estilo.tenue('  Sus proyectos y facturas se conservan intactos.'))
                    break
                }

                case 'reactivar': {
                    encabezado('Reactivar cliente')

                    const cliente = await elegirDeLista(await clienteService.listarInactivos(), {
                        etiqueta: 'Elige el cliente a reactivar',
                        describir: describirCliente,
                        siVacio: 'No hay clientes desactivados.',
                    })

                    await clienteService.reactivar(cliente._id)
                    console.log('\n' + mensaje.exito(`Cliente "${cliente.nombre}" reactivado.`))
                    break
                }
            }
        })
    }
}
