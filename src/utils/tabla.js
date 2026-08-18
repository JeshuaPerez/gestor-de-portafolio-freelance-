import Table from 'cli-table3'
import { estilo } from './estilo.js'

// TABLAS DE CONSOLA
/**
 * Imprime una tabla, o un aviso si no hay nada que mostrar.
 *
 * @param {object} opciones
 * @param {string[]} opciones.cabeceras  títulos de las columnas
 * @param {Array[]}  opciones.filas      array de arrays (una fila por registro)
 * @param {number[]} [opciones.anchos]   ancho fijo por columna, si hace falta
 * @param {string[]} [opciones.alineado] 'left'|'right'|'center' por columna
 * @param {string}   [opciones.vacio]    qué decir cuando no hay filas
 * @param {string}   [opciones.resumen]  pie de tabla; por defecto el total
 */
export function mostrarTabla({ cabeceras, filas, anchos, alineado, vacio, resumen }) {
    if (filas.length === 0) {
        console.log(estilo.tenue(`\n  ${vacio ?? '(No hay nada que mostrar)'}\n`))
        return
    }

    const opciones = {
        head: cabeceras.map((c) => estilo.titulo(c)),
        wordWrap: true, // parte el texto largo en varias líneas en vez de romper la tabla
        style: {
            // COLORES LOS PONE EL ESTILO, NO LA TABLA CHALK
            head: [],
            border: [],
        },
        // BORDES
        chars: {
            'top-left': '╭',
            'top-right': '╮',
            'bottom-left': '╰',
            'bottom-right': '╯',
        },
    }
    if (anchos) opciones.colWidths = anchos

    // NUMEROS A LA DERECHA, TEXTO A LA IZQUIERDA, CABECERAS CENTRADAS
    if (alineado) opciones.colAligns = alineado

    const tabla = new Table(opciones)

    for (const fila of filas) tabla.push(fila)

    console.log('')
    console.log(tabla.toString())
    console.log(estilo.tenue(`  ${resumen ?? `Total: ${filas.length} registro(s)`}\n`))
}
