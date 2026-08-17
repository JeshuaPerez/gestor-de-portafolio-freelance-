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

/**
 * CAPA DE PRESENTACIÓN — lo único que hace es hablar con el usuario.
 *
 * Fíjate que en este archivo NO aparece la palabra `db` ni `collection` ni
 * `ObjectId`. Pregunta, llama al servicio y muestra el resultado. Nada más.
 * Esa es la separación de responsabilidades en la práctica.
 *
 * Tampoco valida (eso vive en `entrada.js`) ni decide colores (eso vive en
 * `estilo.js`). Este archivo solo decide QUÉ se pregunta y en qué orden.
 */

/** Una línea por cliente, para las listas donde hay que elegir. */
function describirCliente(c) {
    // padEnd rellena con espacios hasta un ancho fijo: así los correos
    // quedan alineados en columna y la lista se lee de un vistazo.
    const codigo = (c.codigo ?? '---').padEnd(9)
    return `${codigo} ${c.nombre.padEnd(24)} <${c.email}>`
}

/** Imprime una lista de clientes como tabla. */
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
    /*
     * OJO, ERROR COMÚN DE JUNIOR:
     * en tu app.js cada función terminaba llamando otra vez a `menu(db)`.
     * Eso es RECURSIÓN: el menú se llama a sí mismo y ninguna llamada termina
     * nunca. Tras cientos de operaciones la pila de llamadas crece hasta
     * reventar ("Maximum call stack size exceeded").
     *
     * Lo correcto es un BUCLE: cada operación termina de verdad y volvemos
     * al inicio del while.
     */
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

        /*
         * Todo el bloque va dentro de un try/catch.
         * Los servicios lanzan errores con mensajes claros ("El email ya
         * existe"); aquí los atrapamos y los mostramos. Así un error NUNCA
         * cierra la aplicación: el usuario ve el motivo y vuelve al menú.
         */
        try {
            switch (accion) {
                case 'crear': {
                    console.log(estilo.titulo('\n--- Nuevo cliente ---'))
                    console.log(AVISO_CANCELAR)

                    // Cada pregunta se valida sola y vuelve a preguntar si el
                    // dato no sirve. El usuario ya no pierde lo que llevaba
                    // escrito por equivocarse en el último campo.
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

                    // `actual` precarga el valor: el usuario lo conserva con
                    // Enter o escribe encima. Son las MISMAS funciones que en
                    // el alta; lo único que cambia es que llevan datos.
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

                    /*
                     * ANTES: 'ID del cliente a desactivar: ' y a copiar y pegar
                     * 24 caracteres desde otra pantalla.
                     *
                     * AHORA: se enseña lo que hay y se elige con las flechas.
                     * El servicio sigue recibiendo un identificador; lo que
                     * cambió es cómo lo consigue el usuario.
                     */
                    const cliente = await elegirDeLista(await clienteService.listarActivos(), {
                        etiqueta: 'Elige el cliente a desactivar',
                        describir: describirCliente,
                        siVacio: 'No hay clientes activos que desactivar.',
                    })

                    // Buena práctica: las acciones destructivas se confirman,
                    // y la confirmación dice EXACTAMENTE sobre qué actúa.
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
                    return // sale del while y vuelve al menú principal
            }
        } catch (error) {
            /*
             * Distinguimos dos cosas muy distintas que antes se veían igual:
             *
             *   - cancelar    -> el usuario decidió parar. No es un fallo.
             *   - error real  -> algo salió mal y hay que explicarlo.
             *
             * Poder separarlas es la ventaja de que `OperacionCancelada` sea
             * una clase propia y no un Error genérico.
             */
            if (error instanceof OperacionCancelada) {
                console.log('\n' + mensaje.aviso('Operación cancelada.'))
            } else {
                console.log('\n' + mensaje.error(error.message))
            }
        }
    }
}
