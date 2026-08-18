import chalk from 'chalk'
import simbolos from 'log-symbols'

// COLORES DE CONSOLA

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

// SIMBOLOS Y MENSAJES
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

// COLOREA LOS ESTADOS DE UN REGISTRO
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

// BARRA DE AVANCE
export function barraDeAvance(porcentaje, ancho = 22) {
    const lleno = Math.round((porcentaje / 100) * ancho)

    let color = chalk.red
    if (porcentaje >= 100) color = chalk.green
    else if (porcentaje >= 50) color = chalk.yellow

    return `${color('█'.repeat(lleno))}${chalk.dim('·'.repeat(ancho - lleno))} ${color(`${porcentaje}%`)}`
}
