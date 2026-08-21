import {
    AppError,
    ConflictoError,
    NoEncontradoError,
    OperacionCancelada,
    ReglaNegocioError,
    ValidacionError,
} from '../errors/errores.js'
import { estilo, mensaje } from '../utils/estilo.js'

// PIEZAS COMPARTIDAS POR TODOS LOS MENÚS
//
// Los seis menús repetían el mismo `try/catch` al final, y todos trataban
// cualquier error igual: `console.log(error.message)`. Con eso, un fallo del
// driver de MongoDB se veía exactamente igual que "el email está mal escrito".
//
// Ahora hay un solo manejador, y distingue por el TIPO de error.

/** Cómo se anuncia cada clase de error. Añadir una es añadir una entrada. */
const PRESENTACION = [
    {
        clase: OperacionCancelada,
        mostrar: () => console.log('\n' + mensaje.aviso('Operación cancelada.')),
    },
    {
        clase: ValidacionError,
        mostrar: (error) => {
            console.log('\n' + mensaje.error(error.message))
            if (error.campo) console.log(estilo.tenue(`  Campo: ${error.campo}`))
        },
    },
    {
        clase: NoEncontradoError,
        mostrar: (error) => console.log('\n' + mensaje.aviso(error.message)),
    },
    {
        clase: ConflictoError,
        mostrar: (error) => console.log('\n' + mensaje.error(error.message)),
    },
    {
        clase: ReglaNegocioError,
        mostrar: (error) => console.log('\n' + mensaje.error(error.message)),
    },
]

/**
 * Ejecuta una acción de menú y traduce cualquier fallo a un mensaje legible.
 * Devuelve `true` si salió bien.
 */
export async function ejecutarAccion(tarea) {
    try {
        await tarea()
        return true
    } catch (error) {
        const encontrada = PRESENTACION.find(({ clase }) => error instanceof clase)

        if (encontrada) {
            encontrada.mostrar(error)
            return false
        }

        if (error instanceof AppError) {
            console.log('\n' + mensaje.error(error.message))
            return false
        }

        // No es un error del dominio: es un fallo del programa. Se dice claro,
        // porque el usuario no puede hacer nada por arreglarlo.
        console.log('\n' + mensaje.error(`Error inesperado: ${error.message}`))
        console.log(estilo.tenue('  (esto es un fallo del programa, no un dato mal escrito)'))
        return false
    }
}

/** Cabecera de pantalla, para no repetir el console.log con guiones. */
export function encabezado(texto, pistas = []) {
    console.log(estilo.titulo(`\n--- ${texto} ---`))
    for (const pista of pistas.filter(Boolean)) console.log(estilo.tenue(`  ${pista}`))
}
