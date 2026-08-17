// Recorre TODO el flujo del negocio contra los SERVICIOS.
// Usa una base de datos desechable que se borra al final.
//
// Antes esto conducia los menus con un readline falso. Al pasar a inquirer
// se prueban los servicios directamente: las reglas de negocio viven ahi,
// no en la consola. La parte de consola se prueba en probar-inquirer.mjs.
import assert from 'node:assert/strict'

process.env.MONGODB_DB_V2 = 'freelance_portfolio_pruebas'

const base = new URL('../src', import.meta.url).href

let ok = 0
async function prueba(nombre, fn) {
    await fn()
    ok++
    console.log(`  OK  ${nombre}`)
}

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

console.log('\n=== FLUJO COMPLETO (base desechable) ===\n')

try {
    await prueba('1. Cliente creado con codigo CLI-0001', async () => {
        const codigo = await clienteService.crear({
            nombre: 'Ana Gomez',
            email: 'ana@correo.com',
            empresa: null,
            telefono: null,
        })
        assert.equal(codigo, 'CLI-0001')
        const c = await clientes.buscarPorEmail('ana@correo.com')
        assert.equal(c.activo, true)
        assert.equal(c.empresa, null)
    })

    await prueba('2. Email duplicado rechazado nombrando al que ya existe', async () => {
        await assert.rejects(
            () => clienteService.crear({ nombre: 'Otro', email: 'ana@correo.com' }),
            /Ya existe un cliente/,
        )
    })

    await prueba('3. No se puede proponer a un cliente desactivado', async () => {
        const codigo = await clienteService.crear({ nombre: 'Inactivo SA', email: 'x@y.com' })
        await clienteService.desactivar(codigo)
        await assert.rejects(
            () =>
                propuestaService.crear({
                    clienteId: codigo,
                    titulo: 'Algo',
                    monto: 1000,
                    plazoDias: 10,
                }),
            /está desactivado/,
        )
        await clienteService.reactivar(codigo)
    })

    await prueba('4. Propuesta creada con codigo PRO-0001', async () => {
        const codigo = await propuestaService.crear({
            clienteId: 'CLI-0001',
            titulo: 'Rediseno de la tienda online',
            descripcion: null,
            monto: 2500000,
            plazoDias: 45,
        })
        assert.equal(codigo, 'PRO-0001')
    })

    await prueba('5. Aceptar: transaccion de 3 colecciones (PRY-0001 + CON-0001)', async () => {
        const proyecto = await propuestaService.aceptar('PRO-0001')
        assert.equal(proyecto.codigo, 'PRY-0001')
        assert.equal(proyecto.codigoContrato, 'CON-0001')

        assert.equal((await propuestas.buscarPorIdOCodigo('PRO-0001')).estado, 'aceptada')

        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        assert.equal(p.estado, 'activo')
        assert.equal(p.avance, 0)

        const c = await contratos.buscarPorIdOCodigo('CON-0001')
        assert.equal(c.estado, 'borrador')
        assert.equal(String(c.proyectoId), String(p._id))
    })

    await prueba('6. Una propuesta aceptada no se acepta dos veces', async () => {
        await assert.rejects(() => propuestaService.aceptar('PRO-0001'), /ya está aceptada/)
        assert.equal(await proyectos.contar(), 1, 'no nacio un segundo proyecto')
    })

    await prueba('7. Contrato: editar condiciones y firmar (transaccion)', async () => {
        await contratoService.editar('CON-0001', {
            condiciones: '50% al iniciar y 50% contra entrega final',
            formaPago: null,
        })

        const c = await contratoService.firmar('CON-0001')
        assert.equal(c.estado, 'activo')
        assert.ok(c.firmadoEn)

        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).contratoFirmado, true)
    })

    await prueba('8. Un contrato firmado ya no se edita ni se refirma', async () => {
        await assert.rejects(
            () => contratoService.editar('CON-0001', { condiciones: 'otras condiciones' }),
            /ya no se puede editar/,
        )
        await assert.rejects(() => contratoService.firmar('CON-0001'), /ya está activo/)
    })

    await prueba('9. Avance manual funciona mientras no haya entregables', async () => {
        await proyectoService.registrarAvance('PRY-0001', 20)
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).avance, 20)
    })

    await prueba('10. El avance no puede retroceder', async () => {
        await assert.rejects(
            () => proyectoService.registrarAvance('PRY-0001', 10),
            /no puede retroceder/,
        )
    })

    await prueba('11. Entregables ENT-0001 y ENT-0002', async () => {
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        const limite = new Date(p.fechaFinEstimada)
        limite.setDate(limite.getDate() - 5)
        const fecha = limite.toISOString().slice(0, 10)

        assert.equal(
            await entregableService.crear({
                proyectoId: 'PRY-0001',
                titulo: 'Diseno de la interfaz',
                fechaLimite: fecha,
                peso: 30,
            }),
            'ENT-0001',
        )
        assert.equal(
            await entregableService.crear({
                proyectoId: 'PRY-0001',
                titulo: 'Desarrollo del backend',
                fechaLimite: fecha,
                peso: 70,
            }),
            'ENT-0002',
        )
    })

    await prueba('12. La fecha limite no puede pasarse del fin del proyecto', async () => {
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        const tarde = new Date(p.fechaFinEstimada)
        tarde.setDate(tarde.getDate() + 30)
        await assert.rejects(
            () =>
                entregableService.crear({
                    proyectoId: 'PRY-0001',
                    titulo: 'Fuera de plazo',
                    fechaLimite: tarde.toISOString().slice(0, 10),
                    peso: 10,
                }),
            /posterior al fin del proyecto/,
        )
    })

    await prueba('13. Con entregables, el avance manual queda BLOQUEADO', async () => {
        await assert.rejects(
            () => proyectoService.registrarAvance('PRY-0001', 90),
            /tiene entregables/,
        )
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).avance, 20)
    })

    await prueba('14. Transiciones ilegales rechazadas', async () => {
        await assert.rejects(
            () => entregableService.cambiarEstado('ENT-0001', 'aprobado'),
            /No se puede pasar de "pendiente" a "aprobado"/,
        )
    })

    await prueba('15. Cambiar estado recalcula el avance (30/100 = 30%)', async () => {
        await entregableService.cambiarEstado('ENT-0001', 'entregado')
        const r = await entregableService.cambiarEstado('ENT-0001', 'aprobado')
        assert.equal(r.avance, 30)
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).avance, 30)
    })

    await prueba('16. Rechazar un entregable exige motivo', async () => {
        await entregableService.cambiarEstado('ENT-0002', 'entregado')
        await assert.rejects(
            () => entregableService.cambiarEstado('ENT-0002', 'rechazado', 'no'),
            /motivo del rechazo/,
        )
        const r = await entregableService.cambiarEstado(
            'ENT-0002',
            'rechazado',
            'Faltan las pantallas de checkout',
        )
        assert.equal(r.estadoNuevo, 'rechazado')
        assert.equal(r.avance, 30, 'rechazar no suma avance')
    })

    await prueba('17. Finanzas: MOV-0001 y acumulado del proyecto', async () => {
        const m = await finanzaService.registrar({
            proyectoId: 'PRY-0001',
            tipo: 'ingreso',
            categoria: 'anticipo',
            concepto: 'Anticipo del 50%',
            monto: 1250000,
            referencia: 'FAC-2026-001',
        })
        assert.equal(m.codigo, 'MOV-0001')
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).cobrado, 1250000)
    })

    await prueba('18. No se puede cobrar mas que el saldo pendiente', async () => {
        await assert.rejects(
            () =>
                finanzaService.registrar({
                    proyectoId: 'PRY-0001',
                    tipo: 'ingreso',
                    categoria: 'pago_final',
                    concepto: 'Cobro excesivo',
                    monto: 99999999,
                    referencia: 'FAC-2026-999',
                }),
            /supera el saldo pendiente/,
        )
        assert.equal(await movimientos.contar(), 1, 'no se guardo nada')
    })

    await prueba('19. Referencia duplicada rechazada (doble defensa)', async () => {
        await assert.rejects(
            () =>
                finanzaService.registrar({
                    proyectoId: 'PRY-0001',
                    tipo: 'ingreso',
                    categoria: 'pago_parcial',
                    concepto: 'Otro pago',
                    monto: 100000,
                    referencia: 'FAC-2026-001',
                }),
            /ya está registrada/,
        )
    })

    await prueba('20. Categoria que no corresponde al tipo, rechazada', async () => {
        await assert.rejects(
            () =>
                finanzaService.registrar({
                    proyectoId: 'PRY-0001',
                    tipo: 'ingreso',
                    categoria: 'licencias', // es de egreso
                    concepto: 'Mal clasificado',
                    monto: 1000,
                    referencia: 'FAC-2026-777',
                }),
            /Categoría no válida para un ingreso/,
        )
    })

    await prueba('21. Anular revierte el acumulado', async () => {
        await finanzaService.anular('MOV-0001', 'Se registro dos veces por error')
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).cobrado, 0)
        assert.equal((await movimientos.buscarPorIdOCodigo('MOV-0001')).anulado, true)
        assert.equal(await movimientos.contar({ anulado: false }), 0)
        await assert.rejects(() => finanzaService.anular('MOV-0001', 'otra vez'), /ya estaba anulado/)
    })

    await prueba('22. Todo se referencia por su codigo legible', async () => {
        assert.ok(await clientes.buscarPorIdOCodigo('CLI-0001'))
        assert.ok(await propuestas.buscarPorIdOCodigo('PRO-0001'))
        assert.ok(await proyectos.buscarPorIdOCodigo('PRY-0001'))
        assert.ok(await contratos.buscarPorIdOCodigo('CON-0001'))
        assert.ok(await entregables.buscarPorIdOCodigo('ENT-0001'))
        assert.ok(await movimientos.buscarPorIdOCodigo('MOV-0001'))

        // Minusculas, ObjectId y basura.
        assert.ok(await proyectos.buscarPorIdOCodigo('pry-0001'))
        const p = await proyectos.buscarPorIdOCodigo('PRY-0001')
        assert.ok(await proyectos.buscarPorIdOCodigo(p._id), 'acepta el ObjectId tal cual')
        assert.equal(await proyectos.buscarPorIdOCodigo('PRY-9999'), null)
        assert.equal(await proyectos.buscarPorIdOCodigo('basura'), null)
    })

    await prueba('23. Un entregable aprobado no se puede eliminar', async () => {
        await assert.rejects(() => entregableService.eliminar('ENT-0001'), /no se puede eliminar/)
    })

    await prueba('24. No se finaliza un proyecto al 30%', async () => {
        await assert.rejects(() => proyectoService.finalizar('PRY-0001'), /No puedes finalizar/)
    })

    await prueba('25. Rentabilidad y balance cuadran', async () => {
        const r = await finanzaService.rentabilidad('PRY-0001')
        assert.equal(r.codigo, 'PRY-0001')
        assert.equal(r.presupuesto, 2500000)
        assert.equal(r.cobrado, 0, 'el movimiento anulado no cuenta')
        assert.equal(r.pendienteDeCobro, 2500000)

        const b = await finanzaService.balance({})
        assert.equal(b.ingresos, 0)
        assert.equal(b.balance, 0)
    })

    // =================================================================
    // EDICIÓN
    // =================================================================
    await prueba('26. Editar un cliente valida igual que al crearlo', async () => {
        await assert.rejects(() => clienteService.editar('CLI-0001', { nombre: 'Ab' }), /3 caracteres/)
        await assert.rejects(() => clienteService.editar('CLI-0001', { email: 'malo' }), /formato válido/)

        const r = await clienteService.editar('CLI-0001', {
            nombre: 'Ana Gomez Lopez',
            empresa: 'Constructora Ejemplo, S.A.',
        })
        assert.equal(r.nombre, 'Ana Gomez Lopez')
        assert.equal(r.empresa, 'Constructora Ejemplo, S.A.')
        assert.equal(r.email, 'ana@correo.com', 'lo que no se toca se conserva')
    })

    await prueba('27. No se puede poner el email de otro cliente', async () => {
        await assert.rejects(
            () => clienteService.editar('CLI-0001', { email: 'x@y.com' }),
            /Ya existe otro cliente/,
        )
    })

    await prueba('28. Una propuesta aceptada ya no se edita', async () => {
        await assert.rejects(
            () => propuestaService.editar('PRO-0001', { monto: 1 }),
            /ya no se puede editar/,
        )
    })

    await prueba('29. Una propuesta pendiente si se edita', async () => {
        const codigo = await propuestaService.crear({
            clienteId: 'CLI-0001',
            titulo: 'Propuesta editable de prueba',
            monto: 1000,
            plazoDias: 10,
        })
        await propuestaService.editar(codigo, { monto: 2000, titulo: 'Titulo corregido' })
        const p = await propuestas.buscarPorIdOCodigo(codigo)
        assert.equal(p.monto, 2000)
        assert.equal(p.titulo, 'Titulo corregido')
        assert.equal(p.plazoDias, 10, 'lo no tocado se conserva')
    })

    await prueba('30. Editar un proyecto no permite tocar el monto', async () => {
        const antes = await proyectos.buscarPorIdOCodigo('PRY-0001')
        await proyectoService.editar('PRY-0001', {
            nombre: 'Rediseno de la tienda (fase 2)',
            monto: 999,
        })
        const despues = await proyectos.buscarPorIdOCodigo('PRY-0001')
        assert.equal(despues.nombre, 'Rediseno de la tienda (fase 2)')
        assert.equal(despues.monto, antes.monto, 'el monto no se movio')
    })

    await prueba('31. La fecha de fin no puede quedar antes del inicio', async () => {
        await assert.rejects(
            () => proyectoService.editar('PRY-0001', { fechaFinEstimada: '2020-01-01' }),
            /anterior al inicio/,
        )
    })

    await prueba('32. Editar el peso de un entregable recalcula el avance', async () => {
        // ENT-0001 (peso 30) esta aprobado -> avance 30 de 100.
        // Subimos ENT-0002 de 70 a 170: ahora el total es 200 y 30/200 = 15%.
        await entregableService.editar('ENT-0002', { peso: 170 })
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).avance, 15)
        await entregableService.editar('ENT-0002', { peso: 70 })
        assert.equal((await proyectos.buscarPorIdOCodigo('PRY-0001')).avance, 30)
    })

    await prueba('33. Un entregable aprobado no se puede editar', async () => {
        await assert.rejects(
            () => entregableService.editar('ENT-0001', { titulo: 'Otro titulo' }),
            /ya no se puede editar/,
        )
    })

    await prueba('34. Del movimiento solo se corrige el concepto', async () => {
        const m = await finanzaService.registrar({
            proyectoId: 'PRY-0001',
            tipo: 'ingreso',
            categoria: 'pago_parcial',
            concepto: 'Concepto con herror',
            monto: 5000,
            referencia: 'FAC-2026-050',
        })
        await finanzaService.editarConcepto(m.codigo, 'Concepto corregido')

        const guardado = await movimientos.buscarPorIdOCodigo(m.codigo)
        assert.equal(guardado.concepto, 'Concepto corregido')
        assert.equal(guardado.monto, 5000, 'el monto sigue intacto')

        // No existe forma de editar el monto: el servicio no expone ninguna.
        assert.equal(typeof finanzaService.editar, 'undefined')
    })

    await prueba('35. Un movimiento anulado no se puede corregir', async () => {
        await finanzaService.anular('MOV-0002', 'Anulado para la prueba')
        await assert.rejects(
            () => finanzaService.editarConcepto('MOV-0002', 'Nuevo concepto'),
            /anulado/,
        )
    })

} finally {
    await db.dropDatabase()
    await database.cerrar()
    console.log('\n(base de datos de prueba eliminada)')
}

console.log(`\n=====================================`)
console.log(`  ${ok}/35 pruebas OK`)
console.log(`=====================================`)
