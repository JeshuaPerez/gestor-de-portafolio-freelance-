import { PassThrough } from 'node:stream'
import { usarStreams } from '../src/utils/entrada.js'

/**
 * =====================================================================
 *  TECLADO Y PANTALLA FALSOS
 * =====================================================================
 *
 * Permite probar la consola sin que haya nadie tecleando: le enchufamos a
 * inquirer dos streams nuestros y le mandamos las mismas pulsaciones que
 * haría una persona, flechas incluidas.
 *
 * HAY QUE FINGIR QUE SOMOS UNA TERMINAL (isTTY + setRawMode + columns).
 * Si no, readline no entra en modo terminal: no limpia la línea al repetir
 * una pregunta y el texto rechazado se queda pegado al siguiente, con lo
 * que "Ab" + "Ana" acaba siendo "AbAna".
 */
export const teclado = new PassThrough()
teclado.isTTY = true
teclado.setRawMode = () => {}

export const pantalla = new PassThrough()
pantalla.isTTY = true
pantalla.columns = 120
pantalla.rows = 40
pantalla.resume() // hay que consumir lo que inquirer dibuja o se atasca

usarStreams({ input: teclado, output: pantalla })

/**
 * ---------------------------------------------------------------------
 * LAS TECLAS
 * ---------------------------------------------------------------------
 * Las flechas no son letras: se mandan como SECUENCIAS DE ESCAPE, que
 * empiezan por el carácter número 27 (la tecla Escape) seguido de un
 * código. La flecha abajo es Escape + "[B".
 *
 * Se construyen con `String.fromCharCode` en vez de escribir ""
 * porque así el archivo no depende de cómo lo guarde el editor: un
 * carácter de control invisible dentro del código es fácil de romper sin
 * darse cuenta.
 */
const ESCAPE = String.fromCharCode(27)

export const ABAJO = `${ESCAPE}[B`
export const ARRIBA = `${ESCAPE}[A`
export const ENTER = '\n'
export const BORRAR_LINEA = String.fromCharCode(21) // Ctrl+U

/**
 * DETALLE DE INQUIRER QUE CONVIENE CONOCER:
 *
 * cuando `validate` rechaza un dato, inquirer NO limpia lo que escribiste:
 * lo deja en la línea con el cursor al final para que lo CORRIJAS en vez de
 * reescribirlo entero. Si el email fallaba por una letra, arreglas la letra.
 *
 * O sea que quien quiera cambiar el valor completo primero borra (Ctrl+U).
 * Esto simula justo eso.
 */
export const corregir = (texto) => BORRAR_LINEA + texto + ENTER

/** Baja N veces y pulsa Enter. Los separadores no cuentan: se saltan solos. */
export const bajar = (n) => [...Array(n).fill(ABAJO), ENTER]

/**
 * ---------------------------------------------------------------------
 * ESPERAR A QUE LA PANTALLA SE QUEDE QUIETA
 * ---------------------------------------------------------------------
 *
 * Aquí estaba el fallo de la primera versión de estas pruebas: entre tecla
 * y tecla esperaba 70 milisegundos fijos.
 *
 * El problema es que 70 ms es una ADIVINANZA. Si la pantalla siguiente hace
 * dos consultas a MongoDB, tarda más que eso, y la tecla se escribe cuando
 * todavía no hay ningún prompt escuchando: se pierde, y la prueba se queda
 * esperando para siempre una respuesta que ya mandamos.
 *
 * Eso convierte la prueba en FRÁGIL: pasa o falla según lo cargada que esté
 * la red ese día. Es la peor clase de prueba que existe, porque dejas de
 * fiarte de ella y acabas ignorándola.
 *
 * La solución es no adivinar. Inquirer escribe en la pantalla cada vez que
 * redibuja, y cuando termina de dibujar deja de escribir.
 *
 * OJO CON LA TRAMPA, que me costó un rato:
 *
 * no basta con "esperar a que la pantalla esté callada", porque el silencio
 * tiene DOS significados opuestos:
 *
 *     a) ya terminó de dibujar   -> se puede teclear
 *     b) todavía no ha empezado  -> NO se puede teclear
 *
 * Si la pantalla siguiente consulta a MongoDB antes de dibujar, está en el
 * caso (b) y parece el (a). Por eso esta función exige ver PRIMERO algo
 * dibujado, y solo entonces empieza a contar el silencio.
 */
/*
 * Y OTRA TRAMPA MÁS, que costó otro rato:
 *
 * el primer intento ponía el escuchador de la pantalla al empezar a esperar
 * y lo quitaba al terminar. Entre que lo quitaba y volvía a ponerlo pasaba
 * un instante... y era justo cuando la aplicación redibujaba, porque acababa
 * de recibir la tecla. Se perdía ese dibujo, y la espera siguiente se
 * quedaba mirando una pantalla que "no dibujaba nada".
 *
 * La solución es tener el escuchador puesto SIEMPRE, contando dibujos. Cada
 * espera se apunta cuántos había al empezar y aguarda a que aparezca alguno
 * nuevo. Así no hay ningún hueco en el que se pierda información.
 */
let dibujos = 0
let instanteUltimoDibujo = 0

pantalla.on('data', () => {
    dibujos++
    instanteUltimoDibujo = Date.now()
})

/*
 * Y LA ÚLTIMA TRAMPA, que es la que costó encontrar.
 *
 * El intento anterior hacía esto:
 *
 *     teclado.write(tecla)
 *     await esperarUnDibujoNuevo()   // <-- MAL
 *
 * Parece razonable: pulso y espero a que la pantalla reaccione. Pero
 * escribir en el teclado hace que inquirer redibuje INMEDIATAMENTE, antes
 * de que la línea siguiente llegue a ejecutarse. Cuando `esperarUnDibujo`
 * empieza a mirar, el dibujo que esperaba YA HABÍA PASADO. Se quedaba
 * aguardando un dibujo que nunca iba a repetirse, hasta agotar el tope.
 *
 * Es una carrera clásica: mirar DESPUÉS de que ocurra lo que quieres ver.
 *
 * La solución es apuntar el contador ANTES de pulsar. Así da igual si el
 * dibujo llega antes o después de que empecemos a mirar: lo detectamos
 * igual, porque comparamos contra una marca tomada antes del suceso.
 */
/*
 * DECISIÓN PRÁCTICA, y conviene explicarla porque parece un atajo sucio.
 *
 * Intenté que la espera fuera "lista": mirar el flujo de la pantalla y
 * pulsar en cuanto inquirer terminara de dibujar. Suena mejor que esperar
 * un tiempo fijo, pero se me llenó de casos límite —dibujos que llegan
 * antes de empezar a mirarlos, pantallas que no redibujan, huecos entre
 * escuchadores— y acabé con un mecanismo más complicado y más frágil que
 * el problema que resolvía.
 *
 * Así que: una pausa fija y holgada. 300 ms es cuatro veces lo que tarda
 * la pantalla más lenta de la aplicación, y el código cabe en cinco
 * líneas que se entienden de un vistazo.
 *
 * La lección, que vale para cualquier proyecto: cuando la solución
 * "elegante" te está costando más de lo que vale el problema, la sencilla
 * suele ser la correcta. La complejidad también hay que pagarla, y se paga
 * cada vez que alguien vuelve a leer el código.
 */
const PAUSA_ENTRE_TECLAS = 300

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Lanza las pulsaciones sobre un menú o pregunta que ya está en marcha.
 *
 * Si la operación termina antes de gastar todas las teclas, deja de
 * teclear: si no, cada tecla sobrante costaría su pausa entera contra una
 * pantalla que ya no existe.
 */
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
