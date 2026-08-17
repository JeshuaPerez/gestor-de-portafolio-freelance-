// Prueba la capa de consola conduciendo inquirer con un teclado falso.
// Le enchufamos streams propios con `usarStreams` y le mandamos las mismas
// pulsaciones que haria una persona, flechas incluidas.
import assert from 'node:assert/strict'

// El teclado y la pantalla falsos viven en su propio modulo, compartidos
// con la prueba de pantallas. Importarlo tambien deja a inquirer
// enchufado a esos streams, asi que tiene que ir ANTES de usar entrada.js.
import { ABAJO, ENTER, corregir, teclear } from './ayuda-teclado.js'
import {
    pedirTexto,
    pedirNumero,
    pedirFecha,
    pedirEmail,
    pedirTelefono,
    pedirOpcion,
    confirmar,
    elegirDeLista,
    elegirAccion,
    OperacionCancelada,
} from '../src/utils/entrada.js'

let ok = 0
async function prueba(nombre, fn) {
    await fn()
    ok++
    console.log(`  OK  ${nombre}`)
}

console.log('\n=== CAPA DE CONSOLA (inquirer con teclado falso) ===\n')

await prueba('pedirTexto insiste si es demasiado corto', async () => {
    const valor = await teclear(pedirTexto('Nombre', { min: 3 }), [
        'Ab' + ENTER, // muy corto: inquirer lo rechaza y repite
        corregir('Ana Gomez'),
    ])
    assert.equal(valor, 'Ana Gomez')
})

await prueba('pedirTexto acepta vacio si es opcional', async () => {
    const valor = await teclear(pedirTexto('Empresa', { opcional: true }), [ENTER])
    assert.equal(valor, null)
})

await prueba('pedirEmail insiste y normaliza a minusculas', async () => {
    const valor = await teclear(pedirEmail('Email'), [
        'correo-malo' + ENTER,
        corregir('Ana@Correo.COM'),
    ])
    assert.equal(valor, 'ana@correo.com')
})

await prueba('pedirTelefono exige los 8 digitos de Guatemala', async () => {
    const valor = await teclear(pedirTelefono('Telefono'), [
        '5512' + ENTER, // solo 4 digitos: lo rechaza
        corregir('5512 3456'),
    ])
    assert.equal(valor, '5512 3456')
})

await prueba('pedirTelefono admite el prefijo +502 y los guiones', async () => {
    assert.equal(
        await teclear(pedirTelefono('Telefono'), ['+502 5512-3456' + ENTER]),
        '+502 5512-3456',
    )
})

await prueba('pedirNumero rechaza letras y valores fuera de rango', async () => {
    const valor = await teclear(pedirNumero('Avance', { min: 0, max: 100 }), [
        'abc' + ENTER,
        corregir('150'),
        corregir('50'),
    ])
    assert.equal(valor, 50)
})

await prueba('pedirNumero NO confunde vacio con cero', async () => {
    // Number('') === 0: si no se comprueba el vacio antes, un Enter se cuela
    // como un 0 valido. Este es el fallo silencioso que queriamos evitar.
    const valor = await teclear(pedirNumero('Plazo', { min: 1 }), [ENTER, '7' + ENTER])
    assert.equal(valor, 7)
})

await prueba('la coma es separador de MILES, no decimal (Guatemala)', async () => {
    // Este era el bug: con las reglas colombianas, "20,000" se convertia en
    // "20.000" y se guardaban 20 quetzales en vez de veinte mil. Sin error,
    // porque 20 es un numero perfectamente valido.
    assert.equal(await teclear(pedirNumero('Monto'), ['20,000' + ENTER]), 20000)
    assert.equal(await teclear(pedirNumero('Monto'), ['1,500.50' + ENTER]), 1500.5)
    assert.equal(await teclear(pedirNumero('Monto'), ['20 000' + ENTER]), 20000)
    assert.equal(await teclear(pedirNumero('Monto'), ['7500' + ENTER]), 7500)
})

await prueba('pedirFecha rechaza formato y dias inexistentes', async () => {
    const valor = await teclear(pedirFecha('Limite'), [
        '31-12-2026' + ENTER, // formato al reves
        corregir('2026-02-31'), // dia que no existe (JS lo desbordaria a marzo)
        corregir('2026-03-15'),
    ])
    assert.equal(valor, '2026-03-15')
})

await prueba('pedirOpcion elige con las flechas', async () => {
    const valor = await teclear(pedirOpcion('Tipo', ['ingreso', 'egreso']), [ABAJO, ENTER])
    assert.equal(valor, 'egreso')
})

await prueba('confirmar acepta la respuesta escrita', async () => {
    assert.equal(await teclear(confirmar('Seguro?'), ['y' + ENTER]), true)
    assert.equal(await teclear(confirmar('Seguro?'), ['n' + ENTER]), false)
})

await prueba('confirmar por defecto dice que NO en lo destructivo', async () => {
    // Enter a secas, sin escribir nada: no debe destruir nada.
    assert.equal(await teclear(confirmar('Borrar?'), [ENTER]), false)
})

await prueba('elegirDeLista devuelve el elemento elegido', async () => {
    const items = [{ n: 'uno' }, { n: 'dos' }, { n: 'tres' }]
    const elegido = await teclear(elegirDeLista(items, { describir: (x) => x.n }), [
        ABAJO,
        ABAJO,
        ENTER,
    ])
    assert.equal(elegido.n, 'tres')
})

await prueba('elegirDeLista avisa con su mensaje propio si no hay nada', async () => {
    await assert.rejects(
        () => elegirDeLista([], { siVacio: 'No hay clientes activos.' }),
        /No hay clientes activos/,
    )
})

await prueba('elegirAccion devuelve el valor, no el numero', async () => {
    const valor = await teclear(
        elegirAccion('MENU', [
            { nombre: 'Crear', valor: 'crear' },
            { nombre: 'Listar', valor: 'listar' },
            { separador: true },
            { nombre: 'Volver', valor: 'volver' },
        ]),
        [ABAJO, ENTER],
    )
    assert.equal(valor, 'listar')
})

await prueba('escribir "cancelar" aborta la operacion', async () => {
    await assert.rejects(
        () => teclear(pedirTexto('Nombre', { min: 3 }), ['cancelar' + ENTER]),
        (e) => e instanceof OperacionCancelada,
    )
})

await prueba('la opcion Cancelar de una lista tambien aborta', async () => {
    const items = [{ n: 'uno' }, { n: 'dos' }]
    await assert.rejects(
        () =>
            // uno -> (abajo) dos -> (abajo) Cancelar.
            // El separador NO cuenta: inquirer lo salta solo.
            teclear(elegirDeLista(items, { describir: (x) => x.n }), [ABAJO, ABAJO, ENTER]),
        (e) => e instanceof OperacionCancelada,
    )
})

console.log(`\n=====================================`)
console.log(`  ${ok} pruebas OK`)
console.log(`=====================================`)
process.exit(0)
