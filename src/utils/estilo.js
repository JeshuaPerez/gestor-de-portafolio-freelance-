import chalk from 'chalk'
import simbolos from 'log-symbols'

/**
 * =====================================================================
 *  COLORES DE LA CONSOLA — un único sitio donde se decide cómo se ve
 * =====================================================================
 *
 * LA TENTACIÓN, Y POR QUÉ NO LA SEGUIMOS
 *
 * Lo fácil sería escribir `chalk.red(...)` directamente en cada menú.
 * Funciona, pero acabas con `chalk.red` repetido en cuarenta sitios, y el
 * día que decidas que los errores van en amarillo tienes que buscarlos
 * todos. Y siempre se escapa alguno.
 *
 * Aquí no exportamos COLORES, exportamos SIGNIFICADOS: `error`, `exito`,
 * `codigo`. El menú dice qué es cada cosa, no de qué color va. Cambiar la
 * paleta entera es cambiar este archivo.
 *
 * Es la misma idea que `entrada.js`: quien llama describe su intención, y
 * el detalle técnico vive en un solo lugar.
 */

export const estilo = {
    /** Cabeceras de sección: ========== CLIENTES ========== */
    titulo: (texto) => chalk.bold.cyan(texto),

    /** Una operación salió bien. */
    exito: (texto) => chalk.green(texto),

    /** Algo falló y el usuario tiene que leerlo. */
    error: (texto) => chalk.red(texto),

    /** Ni error ni éxito: una advertencia o un dato que conviene mirar. */
    aviso: (texto) => chalk.yellow(texto),

    /** Los códigos legibles: CLI-0001, PRY-0003... */
    codigo: (texto) => chalk.bold.magenta(texto),

    /** Cantidades de dinero. */
    dinero: (texto) => chalk.bold.green(texto),

    /** Texto secundario: pistas, ejemplos, aclaraciones entre paréntesis. */
    tenue: (texto) => chalk.dim(texto),

    /** Las opciones numeradas de los menús. */
    opcion: (numero, texto) => `${chalk.bold.cyan(numero)}. ${texto}`,

    /** Resalta un dato dentro de una frase. */
    dato: (texto) => chalk.bold.white(texto),
}

/**
 * ---------------------------------------------------------------------
 * SÍMBOLOS
 * ---------------------------------------------------------------------
 * Antes escribíamos ✓ y ✗ a mano en cada mensaje. El problema: no todas
 * las consolas saben dibujarlos. En la consola antigua de Windows (cmd.exe)
 * salen como cuadraditos o interrogantes, y el mensaje queda peor que sin
 * símbolo.
 *
 * `log-symbols` MIRA la terminal en la que estás: si aguanta Unicode usa
 * ✔ ✖ ⚠ ℹ, y si no, cae a √ × ‼ i, que se ven bien en cualquier sitio.
 *
 * Es la misma idea que chalk con los colores: la librería se encarga de
 * saber qué soporta el sitio donde escribes.
 */
export const icono = {
    exito: simbolos.success,
    error: simbolos.error,
    aviso: simbolos.warning,
    info: simbolos.info,
}

/** Mensajes de una línea con su símbolo y su color, ya montados. */
export const mensaje = {
    exito: (texto) => `${icono.exito} ${chalk.green(texto)}`,
    error: (texto) => `${icono.error} ${chalk.red(texto)}`,
    aviso: (texto) => `${icono.aviso} ${chalk.yellow(texto)}`,
    info: (texto) => `${icono.info} ${chalk.cyan(texto)}`,
}

/**
 * Colorea el estado de cualquier registro según lo que significa.
 *
 * Los seis módulos tienen estados, y varios comparten nombre ("activo" lo
 * usan clientes, proyectos y contratos). Traducirlos a color en un único
 * sitio evita que cada menú invente su propio criterio.
 */
export function colorEstado(estado) {
    const verdes = ['activo', 'aceptada', 'aprobado', 'finalizado', 'firmado']
    const rojos = ['rechazada', 'rechazado', 'cancelado', 'anulado', 'inactivo']
    const amarillos = ['pendiente', 'borrador', 'entregado']

    const texto = String(estado).toUpperCase()

    if (verdes.includes(estado)) return chalk.green(texto)
    if (rojos.includes(estado)) return chalk.red(texto)
    if (amarillos.includes(estado)) return chalk.yellow(texto)
    return texto
}

/**
 * La barra de avance, coloreada según lo lleno que esté.
 *
 * Vivía en formato.js sin color; la traemos aquí porque ahora su aspecto
 * es una decisión de estilo, no de formato.
 */
export function barraDeAvance(porcentaje, ancho = 22) {
    const lleno = Math.round((porcentaje / 100) * ancho)

    let color = chalk.red
    if (porcentaje >= 100) color = chalk.green
    else if (porcentaje >= 50) color = chalk.yellow

    return `${color('█'.repeat(lleno))}${chalk.dim('·'.repeat(ancho - lleno))} ${color(`${porcentaje}%`)}`
}
