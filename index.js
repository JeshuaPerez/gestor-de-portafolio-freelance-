import figlet from 'figlet'
import gradient from 'gradient-string'
import ora from 'ora'

import { database } from './src/config/database.js'

import { ClienteRepositorio } from './src/repositories/ClienteRepositorio.js'
import { PropuestaRepositorio } from './src/repositories/PropuestaRepositorio.js'
import { ProyectoRepositorio } from './src/repositories/ProyectoRepositorio.js'
import { ContratoRepositorio } from './src/repositories/ContratoRepositorio.js'
import { EntregableRepositorio } from './src/repositories/EntregableRepositorio.js'
import { MovimientoRepositorio } from './src/repositories/MovimientoRepositorio.js'

import { ClienteService } from './src/services/ClienteService.js'
import { PropuestaService } from './src/services/PropuestaService.js'
import { ProyectoService } from './src/services/ProyectoService.js'
import { ContratoService } from './src/services/ContratoService.js'
import { EntregableService } from './src/services/EntregableService.js'
import { FinanzaService } from './src/services/FinanzaService.js'

import { menuClientes } from './src/commands/clientes.js'
import { menuPropuestas } from './src/commands/propuestas.js'
import { menuProyectos } from './src/commands/proyectos.js'
import { menuContratos } from './src/commands/contratos.js'
import { menuEntregables } from './src/commands/entregables.js'
import { menuFinanzas } from './src/commands/finanzas.js'

import { elegirAccion } from './src/utils/entrada.js'
import { estilo } from './src/utils/estilo.js'

/**
 * PUNTO DE ENTRADA
 *
 * Aquí se "arma" la aplicación: se crean los objetos y se conectan entre sí.
 * Es el único sitio del programa donde se decide qué implementación concreta
 * usa cada capa:
 *
 *     Repositorio  <-  la base de datos
 *     Servicio     <-  los repositorios (+ el cliente Mongo si usa transacciones)
 *     Menú         <-  el servicio
 *
 * Ese encadenado es la INYECCIÓN DE DEPENDENCIAS. Gracias a él podrías
 * pasarle a un servicio un repositorio falso para hacer pruebas sin tocar
 * MongoDB, y ni el servicio ni el menú se enterarían.
 */

/*
 * El degradado del banner.
 *
 * `gradient-string` reparte una lista de colores a lo largo del texto,
 * letra por letra. Sobre el dibujo de figlet queda un efecto que con chalk
 * a secas no se puede hacer: chalk pinta de un color, no de una transición.
 */
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

    /*
     * `ora` dibuja el spinner que gira mientras esperamos.
     *
     * No es decoración: conectarse a Atlas tarda un par de segundos, y sin
     * nada en pantalla el usuario no sabe si el programa está trabajando o
     * se colgó. El spinner responde a esa pregunta.
     */
    const spinner = ora('Conectando a MongoDB...').start()

    try {
        const db = await database.conectar()
        const mongoClient = database.obtenerCliente() // hace falta para las transacciones

        // --- Capa de datos ---
        const clientes = new ClienteRepositorio(db)
        const propuestas = new PropuestaRepositorio(db)
        const proyectos = new ProyectoRepositorio(db)
        const contratos = new ContratoRepositorio(db)
        const entregables = new EntregableRepositorio(db)
        const movimientos = new MovimientoRepositorio(db)

        spinner.text = 'Preparando colecciones e índices...'

        // Crea colecciones e índices únicos si es el primer arranque.
        for (const repositorio of [
            clientes,
            propuestas,
            proyectos,
            contratos,
            entregables,
            movimientos,
        ]) {
            await repositorio.crearIndices()
        }

        spinner.succeed(`Conectado a MongoDB · base de datos ${estilo.dato(database.nombre)}`)

        // --- Capa de negocio ---
        const clienteService = new ClienteService(clientes)
        const proyectoService = new ProyectoService(proyectos, clientes, entregables)
        const propuestaService = new PropuestaService(
            propuestas,
            proyectos,
            contratos,
            clientes,
            mongoClient,
        )
        const contratoService = new ContratoService(contratos, proyectos, clientes, mongoClient)
        const entregableService = new EntregableService(entregables, proyectos, mongoClient)
        const finanzaService = new FinanzaService(movimientos, proyectos, clientes, mongoClient)

        // --- Capa de presentación ---
        while (true) {
            const modulo = await elegirAccion('MENÚ PRINCIPAL', [
                { nombre: 'Clientes', valor: 'clientes' },
                { nombre: 'Propuestas', valor: 'propuestas' },
                { nombre: 'Proyectos', valor: 'proyectos' },
                { nombre: 'Contratos', valor: 'contratos' },
                { nombre: 'Entregables', valor: 'entregables' },
                { nombre: 'Finanzas', valor: 'finanzas' },
                { separador: true },
                { nombre: 'Salir', valor: 'salir' },
            ])

            if (modulo === 'salir') {
                console.log(estilo.exito('\n¡Hasta luego!\n'))
                break
            }

            if (modulo === 'clientes') await menuClientes(clienteService)
            else if (modulo === 'propuestas') await menuPropuestas(propuestaService)
            else if (modulo === 'proyectos') await menuProyectos(proyectoService)
            else if (modulo === 'contratos') await menuContratos(contratoService)
            else if (modulo === 'entregables') await menuEntregables(entregableService)
            else if (modulo === 'finanzas') await menuFinanzas(finanzaService)
        }
    } catch (error) {
        // Si el fallo ocurrió durante el arranque, el spinner sigue girando:
        // hay que pararlo o se queda dando vueltas para siempre.
        if (spinner.isSpinning) spinner.fail('No se pudo arrancar')
        console.error(estilo.error(`\n✗ Error fatal: ${error.message}\n`))
        process.exitCode = 1
    } finally {
        // `finally` se ejecuta pase lo que pase: así nunca dejamos la
        // conexión abierta.
        await database.cerrar()
    }
}

main()
