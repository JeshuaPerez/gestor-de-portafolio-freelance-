import figlet from 'figlet'
import gradient from 'gradient-string'
import ora from 'ora'

import { buscarModulo, opcionesDelMenu } from './src/commands/registro.js'
import { construirAplicacion } from './src/config/contenedor.js'
import { database } from './src/config/database.js'
import { elegirAccion } from './src/utils/entrada.js'
import { estilo, mensaje } from './src/utils/estilo.js'

// PUNTO DE ENTRADA
//
// Este archivo hacía tres trabajos: construía los seis repositorios, los seis
// servicios, y despachaba el menú con una cadena de if/else. Ahora:
//
//   · quién se construye con qué  -> src/config/contenedor.js
//   · qué módulos hay en el menú  -> src/commands/registro.js
//   · aquí solo queda: arrancar, mostrar el menú y cerrar.

const degradado = gradient(['#00c6ff', '#0072ff', '#7b2ff7'])

function mostrarBanner() {
    console.log('')
    console.log(degradado.multiline(figlet.textSync('Freelance', { font: 'Standard' })))
    console.log(estilo.dato('   P O R T F O L I O   C L I'))
    console.log(estilo.tenue('   Gestión de clientes, propuestas, proyectos y finanzas'))
    console.log(estilo.tenue('   Node.js + MongoDB · transacciones reales\n'))
}

async function main() {
    mostrarBanner()

    const spinner = ora('Conectando a MongoDB...').start()

    try {
        const db = await database.conectar()
        const mongoClient = database.obtenerCliente() // para las transacciones

        spinner.text = 'Preparando colecciones, esquemas e índices...'
        const servicios = await construirAplicacion(db, mongoClient)

        spinner.succeed(`Conectado a MongoDB · base de datos ${estilo.dato(database.nombre)}`)

        // BUCLE DEL MENÚ PRINCIPAL
        while (true) {
            const eleccion = await elegirAccion('MENÚ PRINCIPAL', opcionesDelMenu(estilo))

            if (eleccion === 'salir') {
                console.log(estilo.exito('\n¡Hasta luego!\n'))
                break
            }

            // Sin cadena de if/else: se busca el módulo y se abre.
            const modulo = buscarModulo(eleccion)
            if (modulo) await modulo.abrir(servicios)
        }
    } catch (error) {
        if (spinner.isSpinning) spinner.fail('No se pudo arrancar')
        console.error('\n' + mensaje.error(`Error fatal: ${error.message}\n`))
        process.exitCode = 1
    } finally {
        await database.cerrar()
    }
}

main()
