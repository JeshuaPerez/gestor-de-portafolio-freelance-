// PRUEBA DE PANTALLAS.
//
// Cubre el hueco que dejo el bug de cli-table3: las pruebas de negocio
// llaman a los servicios y nunca DIBUJAN nada, asi que un fallo al pintar
// una tabla pasaba inadvertido.
//
// Aqui se conducen los seis menus de verdad, con inquirer y un teclado
// falso, sobre una base con datos. Si alguna pantalla revienta, el menu lo
// atrapa y escribe una linea con ✗: eso es lo que buscamos.
import assert from 'node:assert/strict'
import { icono } from '../src/utils/estilo.js'
import { ENTER, bajar, teclear } from './ayuda-teclado.js'

process.env.MONGODB_DB_V2 = 'freelance_portfolio_pantallas'

const base = new URL('../src', import.meta.url).href

// El simbolo de error lo decide log-symbols segun la terminal (✖ o ×),
// asi que se lo preguntamos en vez de escribirlo a mano: si lo pusieramos
// literal y la libreria cambiara de simbolo, esta prueba dejaria de ver
// los fallos y pasaria en verde siempre.
const MARCA_ERROR = icono.error

// --- captura de lo que imprimen los menus ----------------------------
const logReal = console.log
let capturado = []

/**
 * Ejecuta un menu tecleando las pulsaciones indicadas y devuelve todo lo
 * que imprimio, para poder comprobar que no hubo ningun error.
 */
async function recorrer(menu, servicio, pulsaciones) {
    capturado = []
    console.log = (...args) => capturado.push(args.join(' '))

    // `teclear` espera a que la pantalla se quede quieta antes de cada
    // pulsacion, en vez de confiar en un tiempo fijo. Ver ayuda-teclado.js.
    await teclear(menu(servicio), pulsaciones)

    console.log = logReal

    const errores = capturado.filter((l) => l.includes(MARCA_ERROR))
    assert.equal(errores.length, 0, `la pantalla fallo:\n      ${errores.join('\n      ')}`)
    return capturado.join('\n')
}

let ok = 0
async function prueba(nombre, fn) {
    await fn()
    ok++
    logReal(`  OK  ${nombre}`)
}

// --- montaje ----------------------------------------------------------
const { database } = await import(`${base}/config/database.js`)
const repos = {}
for (const n of [
    'ClienteRepositorio',
    'PropuestaRepositorio',
    'ProyectoRepositorio',
    'ContratoRepositorio',
    'EntregableRepositorio',
    'MovimientoRepositorio',
]) {
    repos[n] = (await import(`${base}/repositories/${n}.js`))[n]
}
const svc = {}
for (const n of [
    'ClienteService',
    'PropuestaService',
    'ProyectoService',
    'ContratoService',
    'EntregableService',
    'FinanzaService',
]) {
    svc[n] = (await import(`${base}/services/${n}.js`))[n]
}
const menus = {}
for (const n of [
    'clientes',
    'propuestas',
    'proyectos',
    'contratos',
    'entregables',
    'finanzas',
]) {
    Object.assign(menus, await import(`${base}/commands/${n}.js`))
}

const db = await database.conectar()

// Empezamos SIEMPRE de cero. Si una ejecucion anterior se interrumpio a
// medias (un Ctrl+C, un tiempo agotado), su base desechable pudo quedarse
// con datos, y la siguiente ejecucion fallaria por culpa de la anterior.
// Una prueba que no se puede repetir no sirve de mucho.
await db.dropDatabase()
const mongoClient = database.obtenerCliente()

const clientes = new repos.ClienteRepositorio(db)
const propuestas = new repos.PropuestaRepositorio(db)
const proyectos = new repos.ProyectoRepositorio(db)
const contratos = new repos.ContratoRepositorio(db)
const entregables = new repos.EntregableRepositorio(db)
const movimientos = new repos.MovimientoRepositorio(db)
for (const r of [clientes, propuestas, proyectos, contratos, entregables, movimientos]) {
    await r.crearIndices()
}

const clienteService = new svc.ClienteService(clientes)
const proyectoService = new svc.ProyectoService(proyectos, clientes, entregables)
const propuestaService = new svc.PropuestaService(
    propuestas,
    proyectos,
    contratos,
    clientes,
    mongoClient,
)
const contratoService = new svc.ContratoService(contratos, proyectos, clientes, mongoClient)
const entregableService = new svc.EntregableService(entregables, proyectos, mongoClient)
const finanzaService = new svc.FinanzaService(movimientos, proyectos, clientes, mongoClient)

logReal('\n=== PANTALLAS DE LOS SEIS MENUS ===\n')

try {
    // --- datos de partida, por los servicios (rapido y sin teclado) ---
    await clienteService.crear({ nombre: 'Juan Lema', email: 'juan@cementos.com' })
    await clienteService.crear({
        nombre: 'Cliente Con Un Nombre Muy Largo Para Ver Si Se Descuadra',
        email: 'largo@ejemplo.com',
        empresa: 'Empresa De Nombre Igualmente Largo S.A.S.',
    })
    await propuestaService.crear({
        clienteId: 'CLI-0001',
        titulo: 'Diseño de página Web a Cementos S.A',
        monto: 2500000,
        plazoDias: 45,
    })
    await propuestaService.aceptar('PRO-0001')
    await contratoService.editar('CON-0001', { condiciones: '30% de anticipo y 70% al entregar' })

    const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
    const limite = new Date(p.fechaFinEstimada)
    limite.setDate(limite.getDate() - 5)
    await entregableService.crear({
        proyectoId: 'PRY-0001',
        titulo: 'Diseño de interfaz interactiva',
        fechaLimite: limite.toISOString().slice(0, 10),
        peso: 40,
    })
    await entregableService.cambiarEstado('ENT-0001', 'entregado')
    await finanzaService.registrar({
        proyectoId: 'PRY-0001',
        tipo: 'ingreso',
        categoria: 'anticipo',
        concepto: 'Anticipo del 30%',
        monto: 750000,
        referencia: 'FAC-2026-001',
    })

    // =================================================================
    await prueba('Clientes: listar (el bug de la tabla)', async () => {
        const salida = await recorrer(menus.menuClientes, clienteService, [
            ...bajar(1), // Listar clientes
            ...bajar(6), // Volver
        ])
        assert.ok(salida.includes('CLI-0001'), 'sale el cliente registrado')
        assert.ok(salida.includes('Juan Lema'))
        assert.ok(salida.includes('Total: 2 cliente(s)'))
    })

    await prueba('Clientes: buscar', async () => {
        const salida = await recorrer(menus.menuClientes, clienteService, [
            ...bajar(2), // Buscar cliente
            'juan' + ENTER,
            ...bajar(6), // Volver
        ])
        assert.ok(salida.includes('Juan Lema'))
        assert.ok(salida.includes('Total: 1 cliente(s)'))
    })

    await prueba('Propuestas: listar y estadisticas', async () => {
        const salida = await recorrer(menus.menuPropuestas, propuestaService, [
            ...bajar(1), // Listar
            ...bajar(6), // Estadisticas
            ...bajar(7), // Volver
        ])
        assert.ok(salida.includes('PRO-0001'))
        assert.ok(salida.includes('Conversión'))
    })

    await prueba('Proyectos: listar y ver ficha', async () => {
        const salida = await recorrer(menus.menuProyectos, proyectoService, [
            ...bajar(0), // Listar
            ...bajar(2), // Ver ficha
            ENTER, // elige el unico proyecto
            ...bajar(7), // Volver
        ])
        assert.ok(salida.includes('PRY-0001'))
        // La ficha es un panel: etiqueta y valor en columnas, sin dos puntos.
        assert.ok(salida.includes('Cliente'), 'la ficha trae la etiqueta Cliente')
        assert.ok(salida.includes('Juan Lema'), 'la ficha trae el nombre del cliente')
        assert.ok(salida.includes('Cobrado'), 'la ficha trae los acumulados')
        assert.ok(salida.includes('╭') || salida.includes('┌'), 'la ficha va dentro de un panel')
    })

    await prueba('Contratos: listar e imprimir el documento', async () => {
        const salida = await recorrer(menus.menuContratos, contratoService, [
            ...bajar(0), // Listar
            ...bajar(4), // Imprimir documento
            ENTER, // elige el unico contrato
            ...bajar(5), // Volver
        ])
        assert.ok(salida.includes('CON-0001'))
        assert.ok(salida.includes('CONTRATO DE PRESTACIÓN DE SERVICIOS'))
        assert.ok(salida.includes('30% de anticipo'))
    })

    await prueba('Entregables: listar los de un proyecto y los vencidos', async () => {
        const salida = await recorrer(menus.menuEntregables, entregableService, [
            ...bajar(1), // Listar los de un proyecto
            ENTER, // elige el unico proyecto
            ...bajar(4), // Ver vencidos
            ...bajar(6), // Volver
        ])
        assert.ok(salida.includes('ENT-0001'))
        assert.ok(salida.includes('Diseño de interfaz interactiva'))
    })

    await prueba('Finanzas: movimientos, balances y rentabilidad', async () => {
        const salida = await recorrer(menus.menuFinanzas, finanzaService, [
            ...bajar(1), // Listar movimientos
            'n' + ENTER, // ¿filtrar por proyecto? no
            ...bajar(3), // Balance general
            'n' + ENTER, // ¿acotar por fechas? no
            ...bajar(4), // Balance por cliente
            ...bajar(5), // Rentabilidad
            ENTER, // elige el unico proyecto
            ...bajar(7), // Volver
        ])
        assert.ok(salida.includes('MOV-0001'))
        assert.ok(salida.includes('Anticipo del 30%'))
        assert.ok(salida.includes('BALANCE'))
        assert.ok(salida.includes('Rentabilidad'))
        assert.ok(salida.includes('Margen'))
    })

    await prueba('Las pantallas aguantan con las colecciones vacias', async () => {
        // El otro extremo: sin datos, ninguna tabla debe reventar.
        await db.collection('movimientos').deleteMany({})
        const salida = await recorrer(menus.menuFinanzas, finanzaService, [
            ...bajar(1), // Listar movimientos
            'n' + ENTER,
            ...bajar(7), // Volver
        ])
        assert.ok(salida.includes('No hay movimientos para mostrar'))
    })
} finally {
    console.log = logReal
    await db.dropDatabase()
    await database.cerrar()
    logReal('\n(base de datos de prueba eliminada)')
}

logReal(`\n=====================================`)
logReal(`  ${ok}/8 pruebas de pantalla OK`)
logReal(`=====================================`)
process.exit(0)
