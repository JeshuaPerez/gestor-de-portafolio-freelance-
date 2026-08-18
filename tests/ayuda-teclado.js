import { PassThrough } from 'node:stream'
import { usarStreams } from '../src/utils/entrada.js'

// TECLADO Y PANTALLA FALSOS
export const teclado = new PassThrough()
teclado.isTTY = true
teclado.setRawMode = () => {}

export const pantalla = new PassThrough()
pantalla.isTTY = true
pantalla.columns = 120
pantalla.rows = 40
pantalla.resume() 

usarStreams({ input: teclado, output: pantalla })

// TECLAS 
const ESCAPE = String.fromCharCode(27)

export const ABAJO = `${ESCAPE}[B`
export const ARRIBA = `${ESCAPE}[A`
export const ENTER = '\n'
export const BORRAR_LINEA = String.fromCharCode(21) // Ctrl+U

// INQUIRER QUEDA CON DATOS PARA CORREGIR
export const corregir = (texto) => BORRAR_LINEA + texto + ENTER
export const bajar = (n) => [...Array(n).fill(ABAJO), ENTER]

let dibujos = 0
let instanteUltimoDibujo = 0

pantalla.on('data', () => {
    dibujos++
    instanteUltimoDibujo = Date.now()
})

const PAUSA_ENTRE_TECLAS = 300

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

export async function teclear(promesa, pulsaciones) {
    let terminado = false
    promesa.then(
        () => (terminado = true),
        () => (terminado = true),
    )

    for (const tecla of pulsaciones) {
        if (terminado) break
        await dormir(PAUSA_ENTRE_TECLAS)
        if (terminado) break
        teclado.write(tecla)
    }

    return promesa
}
