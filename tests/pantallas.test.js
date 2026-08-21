// PRUEBA DE PANTALLAS.
import assert from 'node:assert/strict'
import { icono } from '../src/utils/estilo.js'
import { ENTER, bajar, teclear } from './ayuda-teclado.js'

process.env.MONGODB_DB_V2 = 'freelance_portfolio_pantallas'

const base = new URL('../src', import.meta.url).href

const MARCA_ERROR = icono.error

// CAPTURA DE DATO DE MENU
const logReal = console.log
let capturado = []

async function recorrer(abrirMenu, pulsaciones) {
    capturado = []
    console.log = (...args) => capturado.push(args.join(' '))

    await teclear(abrirMenu(), pulsaciones)

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

// MONTAJE
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

// EMPEZAMOS SIEMPRE DE CERO. 
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

// Los servicios se montan con el MISMO composition root que usa la app, asi
// que la prueba tambien verifica que el cableado real funciona.
// Fijate en lo que se le pasa ahora: una UnidadDeTrabajo, no el mongoClient.
const { construirServicios } = await import(`${base}/config/contenedor.js`)
const { UnidadDeTrabajoMongo } = await import(`${base}/persistencia/UnidadDeTrabajo.js`)

const servicios = construirServicios(
    { clientes, propuestas, proyectos, contratos, entregables, movimientos },
    new UnidadDeTrabajoMongo(mongoClient),
)

const clienteService = servicios.clientes
const proyectoService = servicios.proyectos
const propuestaService = servicios.propuestas
const contratoService = servicios.contratos
const entregableService = servicios.entregables
const finanzaService = servicios.finanzas

logReal('\n=== PANTALLAS DE LOS SEIS MENUS ===\n')

try {
    // DATOS DE PARTIDA
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

    await prueba('Clientes: listar (el bug de la tabla)', async () => {
        const salida = await recorrer(() => menus.menuClientes(clienteService), [
            ...bajar(1), // Listar clientes
            ...bajar(6), // Volver
        ])
        assert.ok(salida.includes('CLI-0001'), 'sale el cliente registrado')
        assert.ok(salida.includes('Juan Lema'))
        assert.ok(salida.includes('Total: 2 cliente(s)'))
    })

    await prueba('Clientes: buscar', async () => {
        const salida = await recorrer(() => menus.menuClientes(clienteService), [
            ...bajar(2), // Buscar cliente
            'juan' + ENTER,
            ...bajar(6), // Volver
        ])
        assert.ok(salida.includes('Juan Lema'))
        assert.ok(salida.includes('Total: 1 cliente(s)'))
    })

    await prueba('Propuestas: listar y estadisticas', async () => {
        const salida = await recorrer(() => menus.menuPropuestas(propuestaService), [
            ...bajar(1), // Listar
            ...bajar(6), // Estadisticas
            ...bajar(7), // Volver
        ])
        assert.ok(salida.includes('PRO-0001'))
        assert.ok(salida.includes('Conversión'))
    })

    await prueba('Proyectos: listar, abrir uno y ver su ficha', async () => {
        const salida = await recorrer(
            () =>
                menus.menuProyectos({
                    proyectos: proyectoService,
                    entregables: entregableService,
                    contratos: contratoService,
                }),
            [
                ...bajar(1), // Listar todos
                ...bajar(0), // Abrir un proyecto
                ENTER, //      elige el unico proyecto
                ...bajar(0), // Ver ficha completa
                ...bajar(7), // Volver a la lista de proyectos
                ...bajar(4), // Volver al menu principal
            ],
        )
        assert.ok(salida.includes('PRY-0001'))
        assert.ok(salida.includes('Cliente'), 'la ficha trae la etiqueta Cliente')
        assert.ok(salida.includes('Juan Lema'), 'la ficha trae el nombre del cliente')
        assert.ok(salida.includes('Cobrado'), 'la ficha trae los acumulados')
        assert.ok(salida.includes('╭') || salida.includes('┌'), 'la ficha va dentro de un panel')
    })

    await prueba('Contrato: se entra por su proyecto y se imprime', async () => {
        // El contrato ya no se busca por su cuenta: se abre desde el proyecto
        // al que pertenece, porque la relacion es 1:1.
        const proyecto = await proyectos.buscarPorIdOCodigo('PRY-0001')

        const salida = await recorrer(
            () => menus.menuContratoDeProyecto(proyecto, contratoService),
            [
                ...bajar(1), // Ver documento imprimible
                ...bajar(4), // Volver al proyecto
            ],
        )
        assert.ok(salida.includes('CON-0001'))
        assert.ok(salida.includes('CONTRATO DE PRESTACIÓN DE SERVICIOS'))
        assert.ok(salida.includes('30% de anticipo'))
    })

    await prueba('Entregables: viven dentro de su proyecto', async () => {
        // Ya no hay que elegir el proyecto: llega elegido desde el menu de arriba.
        const proyecto = await proyectos.buscarPorIdOCodigo('PRY-0001')

        const salida = await recorrer(
            () => menus.menuEntregablesDeProyecto(proyecto, entregableService),
            [
                ...bajar(0), // Ver los entregables de este proyecto
                ...bajar(6), // Volver al proyecto
            ],
        )
        assert.ok(salida.includes('ENT-0001'))
        assert.ok(salida.includes('Diseño de interfaz interactiva'))
    })

    await prueba('Entregables: el historial de estados se consulta por consola', async () => {
        const proyecto = await proyectos.buscarPorIdOCodigo('PRY-0001')

        // ENT-0001 nacio pendiente y paso a entregado en el montaje de arriba:
        // el historial tiene que contar las DOS cosas, el alta y la transicion.
        const salida = await recorrer(
            () => menus.menuEntregablesDeProyecto(proyecto, entregableService),
            [
                ...bajar(4), // Ver historial de cambios de estado
                ENTER, // el unico entregable del proyecto
                ...bajar(6), // Volver al proyecto
            ],
        )

        assert.ok(salida.includes('Historial de cambios de estado'), 'la cabecera de la pantalla')
        assert.ok(salida.includes('ENT-0001 · Historial de estados'), 'la ficha del entregable')
        assert.ok(salida.includes('(alta)'), 'la entrada de nacimiento')
        assert.ok(salida.includes('PENDIENTE'), 'el primer estado')
        assert.ok(salida.includes('ENTREGADO'), 'el estado al que paso')
        assert.ok(salida.includes('2 cambio(s) de estado'), 'el recuento del pie')
    })

    await prueba('Finanzas: movimientos, balances y rentabilidad', async () => {
        const salida = await recorrer(() => menus.menuFinanzas(finanzaService), [
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

    await prueba('El menu principal ya NO ofrece Entregables ni Contratos', async () => {
        // Esta es la prueba de la reestructuracion: un entregable y un contrato
        // no son entidades independientes, asi que no pueden ser modulos del
        // menu principal. Se llega a ellos desde su proyecto.
        const { MODULOS, buscarModulo } = await import(`${base}/commands/registro.js`)

        const ids = MODULOS.map((m) => m.id)
        assert.deepEqual(ids, ['clientes', 'propuestas', 'proyectos', 'finanzas'])
        assert.equal(buscarModulo('entregables'), undefined, 'entregables NO es modulo principal')
        assert.equal(buscarModulo('contratos'), undefined, 'contratos NO es modulo principal')

        // Y siguen siendo alcanzables, pero desde dentro del proyecto.
        const proyectoMenu = await import(`${base}/commands/proyectos.js`)
        assert.equal(typeof proyectoMenu.menuProyectos, 'function')

        const entregableMenu = await import(`${base}/commands/entregables.js`)
        assert.equal(typeof entregableMenu.menuEntregablesDeProyecto, 'function')

        const contratoMenu = await import(`${base}/commands/contratos.js`)
        assert.equal(typeof contratoMenu.menuContratoDeProyecto, 'function')
    })

    await prueba('Las pantallas aguantan con las colecciones vacias', async () => {
        // El otro extremo: sin datos, ninguna tabla debe reventar.
        await db.collection('movimientos').deleteMany({})
        const salida = await recorrer(() => menus.menuFinanzas(finanzaService), [
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
logReal(`  ${ok}/9 pruebas de pantalla OK`)
logReal(`=====================================`)
process.exit(0)
