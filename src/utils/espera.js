import ora from 'ora'

// SPINNER
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
