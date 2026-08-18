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

// PUNTO DE ENTRADA
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
        const mongoClient = database.obtenerCliente() //TRANSACCIONES

        // --- CAPA DE DATOS ---
        const clientes = new ClienteRepositorio(db)
        const propuestas = new PropuestaRepositorio(db)
        const proyectos = new ProyectoRepositorio(db)
        const contratos = new ContratoRepositorio(db)
        const entregables = new EntregableRepositorio(db)
        const movimientos = new MovimientoRepositorio(db)

        spinner.text = 'Preparando colecciones e índices...'

        // CREACION DE COLECCIONES E INDICES (si no existen)
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

        // --- CAPA DE NEGOCIO ---
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

        // --- CAPA DE PRESENTACIÓN ---
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
        if (spinner.isSpinning) spinner.fail('No se pudo arrancar')
        console.error(estilo.error(`\n✗ Error fatal: ${error.message}\n`))
        process.exitCode = 1
    } finally {
        await database.cerrar()
    }
}

main()
