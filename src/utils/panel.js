import boxen from 'boxen'
import { estilo } from './estilo.js'

// PANELES — recuadros para la información que hay que leer con calma
//COLORES
const BORDES = {
    normal: 'cyan',
    exito: 'green',
    error: 'red',
    aviso: 'yellow',
}

/**
 * Dibuja un panel.
 *
 * @param {object} opciones
 * @param {string}   [opciones.titulo]  cabecera del recuadro
 * @param {string[]} opciones.lineas    contenido, una entrada por línea
 * @param {string}   [opciones.tono]    normal | exito | error | aviso
 */
export function mostrarPanel({ titulo, lineas, tono = 'normal' }) {
    const contenido = lineas.join('\n')

    console.log(
        boxen(contenido, {
            title: titulo,
            titleAlignment: 'left',
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 1, bottom: 0, left: 2, right: 0 },
            borderStyle: 'round', // esquinas redondeadas: menos duro a la vista
            borderColor: BORDES[tono] ?? BORDES.normal,
        }),
    )
}

export function panelTransaccion(titulo, pasos) {
    mostrarPanel({
        titulo: ` ${titulo} `,
        tono: 'exito',
        lineas: pasos.map((paso) => `${estilo.exito('·')} ${paso}`),
    })
}

export function comoFicha(pares) {
    const ancho = Math.max(...pares.map(([etiqueta]) => etiqueta.length))
    return pares.map(([etiqueta, valor]) => `${estilo.tenue(etiqueta.padEnd(ancho))}  ${valor}`)
}
