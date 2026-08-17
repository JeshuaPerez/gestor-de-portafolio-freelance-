import ora from 'ora'

/**
 * =====================================================================
 *  SPINNER PARA LAS OPERACIONES QUE TARDAN
 * =====================================================================
 *
 * ¿POR QUÉ AQUÍ Y NO DENTRO DE LOS SERVICIOS?
 *
 * Sería más cómodo meter el spinner dentro de `PropuestaService.aceptar()`,
 * que es quien tarda. Pero entonces el servicio estaría DIBUJANDO EN LA
 * PANTALLA, y un servicio no debe saber que existe una pantalla: el día que
 * llames a `aceptar()` desde una API web te aparecería un spinner girando
 * en los logs del servidor.
 *
 * La regla es la de siempre en este proyecto: quien pinta es la capa de
 * presentación. Los menús envuelven la llamada; el servicio ni se entera.
 *
 * ---------------------------------------------------------------------
 * POR QUÉ `stop()` Y NO `succeed()`
 * ---------------------------------------------------------------------
 * `succeed()` dejaría escrito su propio mensaje de éxito, y justo después
 * el menú imprime el suyo, mucho más detallado ("la propuesta quedó
 * aceptada, nació el proyecto..."). Saldrían dos mensajes diciendo lo
 * mismo. Con `stop()` el spinner desaparece sin dejar rastro y el menú
 * cuenta la historia completa él solo.
 */
export async function conSpinner(mensaje, tarea) {
    const spinner = ora(mensaje).start()

    try {
        return await tarea()
    } finally {
        // `finally`: si la transacción falla, el spinner TIENE que pararse
        // igualmente. Si no, se queda girando eternamente por encima del
        // mensaje de error, y no hay forma de leer nada.
        spinner.stop()
    }
}
