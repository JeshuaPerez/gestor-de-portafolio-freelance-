// CAZA DE BUGS.
//
// No comprueba que las cosas funcionen (de eso van las otras suites): busca
// activamente formas de ROMPER la aplicacion. En vez de fallar en el primer
// problema, apunta todo y da un informe al final.
process.env.MONGODB_DB_V2 = 'freelance_portfolio_cazabugs'

const base = new URL('../src', import.meta.url).href

const hallazgos = []
const bien = []

function fallo(zona, descripcion, detalle) {
    hallazgos.push({ zona, descripcion, detalle })
}
function ok(descripcion) {
    bien.push(descripcion)
}

/** Ejecuta una sonda y captura lo que pase. */
async function sonda(zona, descripcion, fn) {
    try {
        await fn()
    } catch (e) {
        fallo(zona, descripcion, `lanzo: ${e.message}`)
    }
}

const { database } = await import(`${base}/config/database.js`)
const f = await import(`${base}/utils/formato.js`)

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

console.log('\n=== CAZA DE BUGS ===\n')

try {
    // datos base
    await clienteService.crear({ nombre: 'Ana Gomez', email: 'ana@correo.com' })
    await propuestaService.crear({
        clienteId: 'CLI-0001',
        titulo: 'Rediseno de la tienda online',
        monto: 50000,
        plazoDias: 60,
    })
    await propuestaService.aceptar('PRO-0001')

    // =================================================================
    // ZONA 1: FECHAS Y ZONA HORARIA
    // =================================================================
    await sonda('fechas', 'la fecha limite se guarda y se muestra el MISMO dia', async () => {
        const codigo = await entregableService.crear({
            proyectoId: 'PRY-0001',
            titulo: 'Entregable de prueba de fechas',
            fechaLimite: '2026-09-15',
            peso: 50,
        })
        const e = await entregables.buscarPorIdOCodigo(codigo)
        const mostrada = f.formatearFecha(e.fechaLimite)
        if (mostrada !== '15/09/2026') {
            fallo(
                'fechas',
                'la fecha limite se muestra un dia distinto del que se escribio',
                `escrito 2026-09-15, guardado ${e.fechaLimite.toISOString()}, mostrado ${mostrada}`,
            )
        } else {
            ok('la fecha limite se muestra tal cual se escribio')
        }
    })

    await sonda('fechas', 'diasHasta cuenta bien el dia de hoy', async () => {
        const hoy = new Date()
        const y = hoy.getFullYear()
        const m = String(hoy.getMonth() + 1).padStart(2, '0')
        const d = String(hoy.getDate()).padStart(2, '0')
        const dias = f.diasHasta(`${y}-${m}-${d}`)
        if (dias !== 0) {
            fallo('fechas', 'la fecha de HOY no da 0 dias', `diasHasta(hoy) = ${dias}`)
        } else {
            ok('diasHasta(hoy) da 0')
        }
    })

    await sonda('fechas', 'estaVencida no marca hoy como vencido', async () => {
        const hoy = new Date()
        const y = hoy.getFullYear()
        const m = String(hoy.getMonth() + 1).padStart(2, '0')
        const d = String(hoy.getDate()).padStart(2, '0')
        if (f.estaVencida(`${y}-${m}-${d}`)) {
            fallo('fechas', 'lo que vence HOY ya sale como vencido', 'estaVencida(hoy) = true')
        } else {
            ok('lo que vence hoy no sale como vencido')
        }
    })

    await sonda('fechas', 'el balance incluye el dia "hasta" completo', async () => {
        // Un movimiento de hoy debe entrar en un balance acotado a hoy.
        await finanzaService.registrar({
            proyectoId: 'PRY-0001',
            tipo: 'ingreso',
            categoria: 'anticipo',
            concepto: 'Pago de hoy',
            monto: 1000,
            referencia: 'REF-HOY-1',
        })
        const hoy = new Date()
        const y = hoy.getFullYear()
        const m = String(hoy.getMonth() + 1).padStart(2, '0')
        const d = String(hoy.getDate()).padStart(2, '0')
        const iso = `${y}-${m}-${d}`

        const b = await finanzaService.balance({ desde: iso, hasta: iso })
        if (b.ingresos !== 1000) {
            fallo(
                'fechas',
                'un balance acotado a HOY no encuentra el movimiento de hoy',
                `esperaba 1000, obtuvo ${b.ingresos}`,
            )
        } else {
            ok('el balance de hoy incluye los movimientos de hoy')
        }
    })

    // =================================================================
    // ZONA 2: TEXTO LIBRE DEL USUARIO
    // =================================================================
    // Todos de 2+ caracteres: con menos salta la regla del minimo, que es
    // legitima y no un bug.
    for (const texto of ['((', '[a-', '**', '\\\\', '.*', '++', 'C++', '(web)', 'Ana|Luis']) {
        await sonda('busqueda', `buscar "${texto}" no debe reventar`, async () => {
            try {
                await clienteService.buscar(texto)
                ok(`buscar "${texto}" no revienta`)
            } catch (e) {
                fallo('busqueda', `buscar "${texto}" revienta`, e.message.split('\n')[0])
            }
        })
    }

    await sonda('busqueda', 'la busqueda no debe comportarse como comodin', async () => {
        const todos = await clienteService.buscar('.*')
        if (todos.length > 0) {
            fallo(
                'busqueda',
                'el texto se interpreta como expresion regular',
                `buscar ".*" devolvio ${todos.length} cliente(s); deberia devolver 0`,
            )
        } else {
            ok('la busqueda trata el texto como texto literal')
        }
    })

    // =================================================================
    // ZONA 3: LA SEGUNDA LINEA DE DEFENSA (indices unicos)
    // =================================================================
    await sonda('indices', 'un choque de indice unico da mensaje entendible', async () => {
        // Simula la carrera: el servicio comprueba y justo despues alguien
        // mete el mismo email. Aqui vamos directos al repositorio.
        try {
            await clientes.crear({ codigo: 'CLI-9001', email: 'ana@correo.com', nombre: 'Copia' })
            fallo('indices', 'el indice unico de email NO impidio el duplicado', 'se inserto')
        } catch (e) {
            if (/E11000|duplicate key/i.test(e.message)) {
                fallo(
                    'indices',
                    'el choque de indice llega crudo de MongoDB a la pantalla',
                    e.message.split('\n')[0].slice(0, 120),
                )
            } else {
                ok('el choque de indice se traduce a un mensaje entendible')
            }
        }
    })

    // =================================================================
    // ZONA 4: NUMEROS Y DINERO
    // =================================================================
    await sonda('dinero', 'los acumulados no acarrean error de coma flotante', async () => {
        await finanzaService.registrar({
            proyectoId: 'PRY-0001',
            tipo: 'egreso',
            categoria: 'herramientas',
            concepto: 'Centavos uno',
            monto: 0.1,
            referencia: 'REF-CENT-1',
        })
        await finanzaService.registrar({
            proyectoId: 'PRY-0001',
            tipo: 'egreso',
            categoria: 'herramientas',
            concepto: 'Centavos dos',
            monto: 0.2,
            referencia: 'REF-CENT-2',
        })
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        if (p.gastado !== 0.3) {
            fallo(
                'dinero',
                'los acumulados arrastran error de coma flotante',
                `0.1 + 0.2 quedo como ${p.gastado}`,
            )
        } else {
            ok('los acumulados suman exacto')
        }
    })

    await sonda('dinero', 'un ingreso no puede dejar el cobrado por encima del monto', async () => {
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        if (p.cobrado > p.monto) {
            fallo('dinero', 'el cobrado supera el presupuesto', `${p.cobrado} > ${p.monto}`)
        } else {
            ok('el cobrado nunca supera el presupuesto')
        }
    })

    // =================================================================
    // ZONA 5: CONTADORES DE CODIGOS
    // =================================================================
    await sonda('contadores', 'una creacion fallida no quema un codigo', async () => {
        const antes = await db.collection('contadores').findOne({ _id: 'ENT' })
        try {
            // Peso invalido: el modelo lo rechaza DESPUES de pedir el codigo?
            await entregableService.crear({
                proyectoId: 'PRY-0001',
                titulo: 'Entregable que va a fallar',
                fechaLimite: '2026-09-20',
                peso: -5,
            })
        } catch {
            /* se espera que falle */
        }
        const despues = await db.collection('contadores').findOne({ _id: 'ENT' })
        if ((despues?.secuencia ?? 0) !== (antes?.secuencia ?? 0)) {
            fallo(
                'contadores',
                'una creacion fallida consume un codigo igualmente',
                `ENT paso de ${antes?.secuencia} a ${despues?.secuencia}`,
            )
        } else {
            ok('una creacion fallida no consume codigo')
        }
    })

    await sonda('contadores', 'una transaccion abortada devuelve el codigo', async () => {
        const antes = await db.collection('contadores').findOne({ _id: 'MOV' })
        try {
            await finanzaService.registrar({
                proyectoId: 'PRY-0001',
                tipo: 'ingreso',
                categoria: 'pago_final',
                concepto: 'Va a fallar por exceso',
                monto: 99999999,
                referencia: 'REF-FALLA-1',
            })
        } catch {
            /* se espera que falle */
        }
        const despues = await db.collection('contadores').findOne({ _id: 'MOV' })
        if ((despues?.secuencia ?? 0) !== (antes?.secuencia ?? 0)) {
            fallo(
                'contadores',
                'una transaccion abortada deja el codigo quemado',
                `MOV paso de ${antes?.secuencia} a ${despues?.secuencia}`,
            )
        } else {
            ok('la transaccion abortada devuelve el contador (rollback real)')
        }
    })

    // =================================================================
    // ZONA 6: AVANCE Y ENTREGABLES
    // =================================================================
    await sonda('avance', 'borrar todos los entregables no deja un avance mentiroso', async () => {
        const e = await entregables.buscarPorIdOCodigo('ENT-0001')
        await entregableService.eliminar(e._id)
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        if (p.avance !== 0) {
            fallo('avance', 'queda avance despues de borrar los entregables', `avance = ${p.avance}`)
        } else {
            ok('al borrar los entregables el avance vuelve a 0')
        }
    })

    await sonda('avance', 'los vencidos no incluyen proyectos cerrados', async () => {
        const vencidos = await entregableService.listarVencidos()
        const codigos = []
        for (const v of vencidos) {
            const p = await proyectos.buscarPorId(String(v.proyectoId))
            if (p && p.estado !== 'activo') codigos.push(`${v.codigo} (proyecto ${p.estado})`)
        }
        if (codigos.length > 0) {
            fallo(
                'avance',
                'la lista de vencidos incluye entregables de proyectos cerrados',
                codigos.join(', '),
            )
        } else {
            ok('los vencidos solo salen de proyectos vivos')
        }
    })

    // =================================================================
    // ZONA 7: DATOS RAROS PERO POSIBLES
    // =================================================================
    await sonda('datos', 'un cliente sin empresa ni telefono no rompe nada', async () => {
        const c = await clientes.buscarPorIdOCodigo('CLI-0001')
        if (c.empresa !== null || c.telefono !== null) {
            fallo('datos', 'los opcionales vacios no se guardan como null', JSON.stringify(c))
        } else {
            ok('los opcionales vacios se guardan como null')
        }
    })

    await sonda('datos', 'el documento del contrato aguanta un cliente borrado', async () => {
        const doc = await contratoService.generarDocumento('CON-0001')
        if (!doc.includes('Ana Gomez')) {
            fallo('datos', 'el documento no trae el nombre del cliente', doc.slice(0, 80))
        } else {
            ok('el documento del contrato sale completo')
        }
    })
} finally {
    await db.dropDatabase()
    await database.cerrar()
}

// =====================================================================
console.log(`Sondas superadas: ${bien.length}`)
for (const b of bien) console.log(`  ok   ${b}`)

console.log(`\n${'='.repeat(60)}`)
if (hallazgos.length === 0) {
    console.log('  Sin hallazgos.')
} else {
    console.log(`  ${hallazgos.length} HALLAZGO(S)\n`)
    let i = 1
    for (const h of hallazgos) {
        console.log(`  ${i++}. [${h.zona}] ${h.descripcion}`)
        console.log(`     ${h.detalle}\n`)
    }
}
console.log('='.repeat(60))
