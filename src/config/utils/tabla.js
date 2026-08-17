import Table from 'cli-table3'
import { estilo } from './estilo.js'

/**
 * =====================================================================
 *  TABLAS DE CONSOLA
 * =====================================================================
 *
 * Antes cada listado se pintaba a mano con console.log y `padEnd`:
 *
 *     console.log(`  ${c.codigo}  ${c.nombre}  <${c.email}>`)
 *
 * Eso se descuadra en cuanto un nombre es más largo de lo previsto, y hay
 * que repetir la misma chapuza en los seis módulos.
 *
 * cli-table3 calcula los anchos, corta el texto largo y dibuja los bordes.
 * Aquí lo envolvemos para que los seis listados se vean IGUAL: mismos
 * bordes, misma cabecera, mismo pie con el total.
 *
 * Fíjate en que este archivo no sabe nada de clientes ni de facturas.
 * Recibe cabeceras y filas. Por eso sirve para los seis módulos.
 */

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

    /*
     * OJO CON LAS OPCIONES OPCIONALES.
     *
     * Aquí había un bug: se pasaba `colWidths: anchos` siempre, y cuando
     * nadie indicaba anchos eso mandaba `colWidths: undefined`.
     *
     * No es lo mismo NO PASAR una opción que pasarla valiendo `undefined`.
     * cli-table3 mezcla lo que recibe con sus valores por defecto, así que
     * el `undefined` PISABA el `[]` que traía de fábrica, y al ir a leer
     * `colWidths[0]` reventaba con "Cannot read properties of undefined".
     *
     * La regla general: una opción que no tienes, no se envía.
     */
    const opciones = {
        head: cabeceras.map((c) => estilo.titulo(c)),
        wordWrap: true, // parte el texto largo en varias líneas en vez de romper la tabla
        style: {
            // Vacío a propósito: los colores los pone chalk desde estilo.js.
            // Si además los pusiera cli-table3, se pisarían entre ellos.
            head: [],
            border: [],
        },
        /*
         * Bordes redondeados, los mismos que usan los paneles de boxen.
         * Que las tablas y los recuadros compartan el mismo trazo hace que
         * la aplicación se vea como UNA cosa y no como pantallas sueltas.
         */
        chars: {
            'top-left': '╭',
            'top-right': '╮',
            'bottom-left': '╰',
            'bottom-right': '╯',
        },
    }
    if (anchos) opciones.colWidths = anchos

    /*
     * Los números van a la derecha. No es capricho tipográfico: alineados
     * a la derecha, las unidades quedan bajo las unidades y las decenas
     * bajo las decenas, y comparar dos cantidades es mirar cuál es más
     * larga. A la izquierda hay que leerlas una a una.
     */
    if (alineado) opciones.colAligns = alineado

    const tabla = new Table(opciones)

    for (const fila of filas) tabla.push(fila)

    console.log('')
    console.log(tabla.toString())
    console.log(estilo.tenue(`  ${resumen ?? `Total: ${filas.length} registro(s)`}\n`))
}
