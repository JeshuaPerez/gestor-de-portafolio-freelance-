import {
    AVISO_CANCELAR,
    OperacionCancelada,
    confirmar,
    elegirAccion,
    elegirDeLista,
    pedirEmail,
    pedirTelefono,
    pedirTexto,
} from '../utils/entrada.js'
import { colorEstado, estilo, mensaje } from '../utils/estilo.js'
import { mostrarTabla } from '../utils/tabla.js'


//  CAPA DE PRESENTACIÓN - ITERACCION CON EL USUARIO

// UNA lINEA POR CLIENTE, PARA LAS LISTAS DONDE HAY QUE ELEGIR.

function describirCliente(c) {
    const codigo = (c.codigo ?? '---').padEnd(9)
    return `${codigo} ${c.nombre.padEnd(24)} <${c.email}>`
}

//IMPRIME UNA LISTA DE CLIENTES COMO TABLA

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

        //TODO EL BLOQUE VA DENTRO DE UN TRY/CATCH.
        try {
            switch (accion) {
                case 'crear': {
                    console.log(estilo.titulo('\n--- Nuevo cliente ---'))
                    console.log(AVISO_CANCELAR)
                    const nombre = await pedirTexto('Nombre', { min: 3, ejemplo: 'Ana Gómez' })
                    const email = await pedirEmail('Email')
                    const empresa = await pedirTexto('Empresa', {
                        opcional: true,
                        ejemplo: 'Constructora Ejemplo, S.A.',
                    })
                    const telefono = await pedirTelefono('Teléfono', { opcional: true })

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

                case 'listar': {
                    mostrarClientes(await clienteService.listar())
                    break
                }

                case 'buscar': {
                    const texto = await pedirTexto('Buscar por código, nombre, empresa o email', {
                        min: 2,
                        ejemplo: 'ana',
                    })
                    mostrarClientes(await clienteService.buscar(texto))
                    break
                }

                case 'editar': {
                    console.log(estilo.titulo('\n--- Editar cliente ---'))
                    console.log(AVISO_CANCELAR)

                    const cliente = await elegirDeLista(await clienteService.listar(), {
                        etiqueta: 'Elige el cliente a editar',
                        describir: describirCliente,
                        siVacio: 'Todavía no hay clientes.',
                    })

                    console.log(
                        estilo.tenue('  Cada campo viene con su valor actual: pulsa Enter para dejarlo igual.'),
                    )
                    const nombre = await pedirTexto('Nombre', { min: 3, actual: cliente.nombre })
                    const email = await pedirEmail('Email', { actual: cliente.email })
                    const empresa = await pedirTexto('Empresa', {
                        opcional: true,
                        actual: cliente.empresa,
                    })
                    const telefono = await pedirTelefono('Teléfono', {
                        opcional: true,
                        actual: cliente.telefono,
                    })

                    await clienteService.editar(cliente._id, { nombre, email, empresa, telefono })
                    console.log('\n' + mensaje.exito(`Cliente ${cliente.codigo} actualizado.`))
                    break
                }

                case 'desactivar': {
                    console.log(estilo.titulo('\n--- Desactivar cliente ---'))
                    const cliente = await elegirDeLista(await clienteService.listarActivos(), {
                        etiqueta: 'Elige el cliente a desactivar',
                        describir: describirCliente,
                        siVacio: 'No hay clientes activos que desactivar.',
                    })

                    const seguro = await confirmar(
                        `¿Desactivar a "${cliente.nombre}" (${cliente.codigo})?`,
                    )
                    if (!seguro) {
                        console.log(estilo.aviso('\n  Operación cancelada.'))
                        break
                    }

                    await clienteService.desactivar(cliente._id)
                    console.log('\n' + mensaje.exito(`Cliente "${cliente.nombre}" desactivado.`))
                    console.log(
                        estilo.tenue('  Sus proyectos y facturas se conservan intactos.'),
                    )
                    break
                }

                case 'reactivar': {
                    console.log(estilo.titulo('\n--- Reactivar cliente ---'))

                    const cliente = await elegirDeLista(await clienteService.listarInactivos(), {
                        etiqueta: 'Elige el cliente a reactivar',
                        describir: describirCliente,
                        siVacio: 'No hay clientes desactivados.',
                    })

                    await clienteService.reactivar(cliente._id)
                    console.log('\n' + mensaje.exito(`Cliente "${cliente.nombre}" reactivado.`))
                    break
                }

                case 'volver':
                    return
                    // sale del while y vuelve al menú principal
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
