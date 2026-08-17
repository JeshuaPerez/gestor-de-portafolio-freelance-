import boxen from 'boxen'
import { estilo } from './estilo.js'

/**
 * =====================================================================
 *  PANELES — recuadros para la información que hay que leer con calma
 * =====================================================================
 *
 * ¿CUÁNDO UNA TABLA Y CUÁNDO UN PANEL?
 *
 *   - TABLA  -> muchos registros del mismo tipo, para comparar entre sí.
 *               "dame todos los proyectos".
 *   - PANEL  -> UN registro mirado en detalle, o un resumen que cierra una
 *               operación. "la ficha de este proyecto", "el balance".
 *
 * Mezclarlos es lo que hace que una consola parezca desordenada: si todo
 * se imprime con console.log seguidos, el ojo no distingue dónde empieza y
 * acaba cada cosa. El recuadro pone ese límite.
 *
 * Igual que `tabla.js`, este archivo no sabe nada de clientes ni facturas:
 * recibe un título y unas líneas.
 */

/** Colores del borde según lo que el panel esté contando. */
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

/**
 * Panel de "operación completada", con los pasos que se dieron.
 *
 * Lo usan las cuatro operaciones transaccionales. Que las cuatro se vean
 * igual no es capricho: el usuario aprende a reconocer de un vistazo que
 * lo que acaba de pasar fue una transacción, y qué colecciones tocó.
 */
export function panelTransaccion(titulo, pasos) {
    mostrarPanel({
        titulo: ` ${titulo} `,
        tono: 'exito',
        lineas: pasos.map((paso) => `${estilo.exito('·')} ${paso}`),
    })
}

/**
 * Alinea etiquetas y valores en dos columnas, para las fichas.
 *
 * Recibe pares [etiqueta, valor] y calcula solo el ancho de la columna
 * izquierda, para que los valores queden todos empezando en el mismo sitio
 * sin tener que contar espacios a mano.
 */
export function comoFicha(pares) {
    const ancho = Math.max(...pares.map(([etiqueta]) => etiqueta.length))
    return pares.map(([etiqueta, valor]) => `${estilo.tenue(etiqueta.padEnd(ancho))}  ${valor}`)
}
