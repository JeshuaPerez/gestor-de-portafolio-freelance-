# Freelance Portfolio CLI

Aplicación de línea de comandos en **Node.js** que permite a un freelancer gestionar su portafolio profesional completo: clientes, propuestas, proyectos, contratos, entregables y finanzas.

Construida con **Programación Orientada a Objetos**, aplicando **principios SOLID** y **patrones de diseño**, con persistencia en **MongoDB** mediante el driver oficial (`mongodb`, sin Mongoose) y **transacciones reales** en todas las operaciones que tocan más de una colección.

---

## Tabla de contenidos

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Vídeo de presentación](#-vídeo-de-presentación)
- [Requisitos previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración de MongoDB](-configuración-de-mongodb)
- [Uso](#-uso)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Modelo de datos](-modelo-de-datos)
- [Principios SOLID aplicados](#-principios-solid-aplicados)
- [Patrones de diseño usados](#-patrones-de-diseño-usados)
- [Transacciones: dónde y por qué](#-transacciones-dónde-y-por-qué)
- [Pruebas](#-pruebas)
- [Consideraciones técnicas](-consideraciones-técnicas)
- [Planeación Scrum](#-planeación-scrum)
- [Créditos](#-créditos)

---

## Descripción del proyecto

**Freelance Portfolio CLI** resuelve un problema real: un profesional independiente gestiona su negocio repartido entre hojas de cálculo, notas sueltas y correos. Esta herramienta centraliza todo el ciclo comercial en una única aplicación de consola:

```
Cliente → Propuesta → [aceptación] → Proyecto + Contrato → Entregables → Cobros
```

### Funcionalidades

| Módulo | Capacidades |
|---|---|
| ** Clientes** | Alta y **edición** con validación, búsqueda por código/nombre/empresa/email, desactivación y reactivación (borrado lógico) |
| ** Propuestas** | Crear y editar (solo mientras estén pendientes); **aceptar genera proyecto y contrato en una sola transacción**; rechazar con motivo; estadísticas de conversión |
| ** Proyectos** | Listado y filtro por estado, ficha completa, edición de nombre, descripción y fecha de fin, registro de avance manual, finalización y cancelación |
| ** Contratos** | Relación 1:1 con el proyecto, edición de condiciones, forma de pago y valor mientras sea borrador, **firma transaccional**, documento imprimible |
| ** Entregables** | Por proyecto, con fecha límite y peso. Máquina de estados (pendiente → entregado → aprobado/rechazado). **Cada cambio de estado —y cada edición del peso— recalcula el avance del proyecto dentro de una transacción** |
| ** Finanzas** | Ingresos y egresos por proyecto, **anti-duplicidad de pagos**, anulación con reversión de acumulados, balance general, balance por cliente y análisis de rentabilidad. Los importes **no se editan**: se anula y se registra de nuevo |

### Todo se identifica con códigos legibles

El usuario **nunca ve un `ObjectId`**. Cada registro recibe un código consecutivo al crearse:

```
CLI-0001   PRO-0001   PRY-0001   CON-0001   ENT-0001   MOV-0001
```

Los servicios aceptan indistintamente el código o el identificador interno (`BaseRepositorio.buscarPorIdOCodigo`), y los menús ofrecen listas navegables con flechas, así que en la práctica no hay que teclear ninguno.

---

## Vídeo de presentación

 **[VER VÍDEO DE PRESENTACIÓN](https://drive.google.com/drive/folders/1_GrZRgvlrmKPQLMRQV-TvCahsIXme-wQ?usp=sharing)**

---

## Requisitos previos

| Software | Versión mínima | Notas |
|---|---|---|
| **Node.js** | 18.0.0+ | Probado en Node 24. Requiere soporte de ESM y `await` en el nivel superior |
| **npm** | 9+ | Incluido con Node |
| **MongoDB** | 4.4+ | **Debe ser replica set o cluster sharded** — las transacciones no funcionan en `mongod` standalone |

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <URL-DEL-REPOSITORIO>
cd freelance-portfolio-cli

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de configuración
cp .env.example .env       # En Windows PowerShell: Copy-Item .env.example .env

# 4. Editar .env y colocar tu cadena de conexión de MongoDB
```

### Dependencias utilizadas

| Paquete | Para qué |
|---|---|
| `mongodb` | Driver **oficial** de MongoDB (no se usa Mongoose, por requisito) |
| `dotenv` | Carga de variables de entorno desde `.env` |
| `inquirer` | Menús con flechas, formularios y validación en vivo |
| `chalk` | Colores y estilos de la salida |
| `cli-table3` | Tablas de consola |
| `boxen` | Recuadros para fichas, balances y documentos |
| `figlet` | Banner ASCII de la aplicación |
| `gradient-string` | Degradado de color sobre el banner |
| `ora` | Indicador de progreso mientras trabaja la base de datos |
| `dayjs` | Fechas en español y fechas relativas ("vence en 3 días") |
| `log-symbols` | Símbolos ✔ ✖ ⚠ ℹ con alternativa automática si la consola no los soporta |

---

## Configuración de MongoDB

 **Importante:** las transacciones de MongoDB **solo funcionan sobre un replica set o un cluster sharded**. Un `mongod` en modo standalone las rechaza con el error *"Transaction numbers are only allowed on a replica set member or mongos"*.

### Opción A — MongoDB Atlas (recomendada)

Atlas despliega un replica set por defecto, así que no hace falta configurar nada más.

1. Crear una cuenta gratuita en [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Crear un cluster **M0** (gratuito).
3. En **Database Access**, crear un usuario con contraseña.
4. En **Network Access**, añadir tu IP (o `0.0.0.0/0` para desarrollo).
5. Copiar la cadena de conexión y pegarla en `.env`.

### Opción B — MongoDB local como replica set de un nodo

```bash
# 1. Arrancar mongod con un replica set
mongod --replSet rs0 --port 27017 --dbpath /ruta/a/tu/data

# 2. En otra terminal, iniciar el replica set (solo la primera vez)
mongosh
> rs.initiate()
```

### Variables de entorno

```env
MONGODB_URI=mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_V2=freelance_portfolio_v2

APP_CURRENCY=GTQ      # Código ISO 4217 de la moneda
APP_LOCALE=es-GT      # Idioma y país: decide cómo se formatean números y dinero
```

**La moneda y el país no están escritos en el código.** Salen del `.env` y los lee `src/utils/formato.js`. Cambiar de Guatemala a otro país es cambiar estas dos líneas, sin tocar un solo archivo `.js`.

Las colecciones y los índices se crean solos en el primer arranque.

---

## Uso

```bash
npm start        # Abrir la aplicación
npm run dev      # Modo desarrollo (recarga con --watch)
npm test         # Ejecutar las cuatro suites de pruebas
```

### Navegación

Se navega con **↑ ↓** y **Enter**; no hay que escribir números de opción. En cualquier formulario se puede escribir `cancelar` para abortar sin perder nada, y las acciones destructivas piden confirmación explícita que **empieza en "no"**, de modo que un Enter accidental nunca borra nada.

Como todavía no hay datos, el orden natural la primera vez es:

```
Clientes → Crear cliente
Propuestas → Crear propuesta → Aceptar propuesta   (nacen el proyecto y el contrato)
Contratos → Editar condiciones → Firmar contrato
Entregables → Crear entregable → Cambiar estado    (recalcula el avance)
Finanzas → Registrar ingreso → Rentabilidad
```

---

## Estructura del proyecto

```
freelance-portfolio-cli/
│
├── index.js                       # Arranca, muestra el menú y cierra. Nada más.
│
├── src/
│   ├── config/
│   │   ├── database.js            # Conexión a MongoDB — SINGLETON
│   │   └── contenedor.js          # COMPOSITION ROOT: el único sitio con `new`
│   │
│   ├── errors/
│   │   └── errores.js             # ValidacionError, ReglaNegocioError,
│   │                              # NoEncontradoError, ConflictoError...
│   ├── validacion/
│   │   └── reglas.js              # Motor de validación: de UNAS reglas salen
│   │                              # la validación, el $jsonSchema y las preguntas
│   ├── models/                    # Entidades: forma del dato y sus reglas
│   │   ├── Modelo.js              # Base común (Template Method)
│   │   ├── Cliente.js
│   │   ├── Propuesta.js
│   │   ├── Proyecto.js            # + FACTORY METHOD (desdePropuesta)
│   │   ├── Contrato.js            # + FACTORY METHOD (desdeProyecto)
│   │   ├── Entregable.js
│   │   ├── Movimiento.js
│   │   └── estados/
│   │       └── EstadoEntregable.js  # PATRÓN STATE: una clase por estado
│   │
│   ├── dominio/                   # Lógica de negocio pura, sin base de datos
│   │   ├── valores.js             # Fechas y dinero (el dominio ya no usa utils)
│   │   ├── CalculadoraAvance.js   # PATRÓN STRATEGY: manual vs. por entregables
│   │   └── SincronizadorAvance.js # PATRÓN OBSERVER: recalcula al oír un evento
│   │
│   ├── eventos/
│   │   └── EmisorEventos.js       # OBSERVER (sujeto): avisa en serie y con await
│   │
│   ├── persistencia/
│   │   └── UnidadDeTrabajo.js     # UNIT OF WORK: "hazlo atómico" como abstracción
│   │
│   ├── repositories/              # Acceso a datos — REPOSITORY (en 3 niveles, ISP)
│   │   ├── RepositorioLectura.js     # consultar
│   │   ├── RepositorioEscritura.js   # + crear / actualizar
│   │   ├── RepositorioEliminable.js  # + borrar  (solo lo hereda Entregable)
│   │   ├── ClienteRepositorio.js
│   │   ├── PropuestaRepositorio.js
│   │   ├── ProyectoRepositorio.js
│   │   ├── ContratoRepositorio.js
│   │   ├── EntregableRepositorio.js
│   │   └── MovimientoRepositorio.js
│   │
│   ├── services/                  # Reglas de negocio y operaciones atómicas
│   │   ├── ClienteService.js
│   │   ├── PropuestaService.js    # ★ aceptar → propuesta + proyecto + contrato
│   │   ├── ProyectoService.js
│   │   ├── ContratoService.js     # ★ firmar
│   │   ├── EntregableService.js   # ★ cambiar estado / editar / eliminar
│   │   └── FinanzaService.js      # ★ registrar / anular movimiento
│   │
│   ├── commands/                  # Presentación
│   │   ├── registro.js            # Los módulos del menú principal (OCP)
│   │   ├── comun.js               # Manejo de errores compartido por los menús
│   │   ├── clientes.js
│   │   ├── propuestas.js
│   │   ├── proyectos.js           # Contiene entregables y contrato
│   │   ├── entregables.js         # menuEntregablesDeProyecto(proyecto, …)
│   │   ├── contratos.js           # menuContratoDeProyecto(proyecto, …)
│   │   └── finanzas.js
│   │
│   └── utils/                     # Presentación transversal
│       ├── entrada.js             # Preguntar y validar (sobre inquirer)
│       ├── estilo.js              # Colores con significado (chalk)
│       ├── tabla.js               # Tablas (cli-table3)
│       ├── panel.js               # Recuadros (boxen)
│       ├── formato.js             # Dinero y fechas para pantalla (dayjs)
│       └── espera.js              # Indicador de progreso (ora)
│
└── tests/
    ├── reglas-negocio.test.js     # 35 pruebas de reglas y transacciones
    ├── consola.test.js            # 17 pruebas de la capa de consola
    ├── pantallas.test.js          #  9 pruebas de las vistas dibujando datos
    ├── caza-bugs.test.js          # 23 sondas contra casos límite
    └── ayuda-teclado.js           # Teclado y pantalla falsos
```

### El menú refleja a quién pertenece cada cosa

Un entregable no existe sin su proyecto, y un contrato tiene relación 1:1 con él.
Por eso **no son módulos del menú principal**: se entra a ellos desde su proyecto.

```
MENÚ PRINCIPAL
├── Clientes
├── Propuestas
├── Proyectos          ← aquí vive todo lo del proyecto
│   └── [elegir uno]
│       ├── Ver ficha completa
│       ├── Entregables (N)     → crear, editar, cambiar estado, eliminar
│       ├── Contrato            → ficha, documento, editar, firmar
│       ├── Editar datos
│       ├── Registrar avance
│       └── Finalizar / Cancelar
└── Finanzas
```

Lo único que se queda fuera es **«entregables vencidos»**, que es una alerta
transversal («qué se me está pasando en todos los proyectos»), no la gestión
de un entregable concreto.

### Arquitectura en capas

```
┌───────────────────────────────────────────────────┐
│  COMMANDS      Presentación (inquirer, chalk)     │  ← Solo pregunta y muestra
├───────────────────────────────────────────────────┤
│  SERVICES      Reglas de negocio + TRANSACCIONES  │  ← Consistencia
├───────────────────────────────────────────────────┤
│  REPOSITORIES  Acceso a datos                     │  ← Único sitio con MongoDB
├───────────────────────────────────────────────────┤
│  MODELS        Entidades + validaciones           │  ← Forma y reglas del dato
└───────────────────────────────────────────────────┘
      ↑ Las dependencias apuntan siempre hacia abajo.
      ↑ Ninguna capa inferior conoce a la superior.
```

 **Comprobación rápida:** busca `console.log` en `/src/services` — no hay ninguno. Busca `collection` u `ObjectId` en `/src/commands` — solo aparecen dentro de un comentario que explica precisamente que no deben aparecer.

---

## Modelo de datos

Cada modelo es una clase que **se valida a sí misma** antes de que nadie intente guardarla, y que se convierte en documento con `aDocumento()`. Ese método existe para controlar exactamente qué campos llegan a MongoDB: una propiedad temporal añadida a la clase no se cuela sin querer en la base de datos.

### Entidades y relaciones

```
Cliente ──┬──< Propuesta ──(al aceptar)──> Proyecto ──1:1──> Contrato
          │                                    │
          │                                    ├──< Entregable
          └──────────────< Movimiento >────────┘
```

### Máquina de estados de los entregables

Declarada como tabla en `Entregable.TRANSICIONES`, no como una cadena de `if`:

```
pendiente ──> entregado ──> aprobado   (estado final)
                  └───────> rechazado ──> entregado
```

El menú **solo ofrece las transiciones legales** desde el estado actual: lee esa misma tabla para construir sus opciones, así que la regla sigue viviendo en un único sitio.

### Índices únicos

| Colección | Índice | Propósito |
|---|---|---|
| `clientes` | `email`, `codigo` | Impide clientes duplicados |
| `propuestas` | `codigo` | Consecutivo irrepetible |
| `proyectos` | `codigo`, `propuestaId` | **Una propuesta no puede generar dos proyectos** |
| `contratos` | `codigo`, `proyectoId` | **Garantiza la relación 1:1 con el proyecto** |
| `entregables` | `codigo` | Consecutivo irrepetible |
| `movimientos` | `codigo`, `referencia` | **Garantía a nivel de motor contra pagos duplicados** |

---

## Validaciones

### Una regla se escribe UNA vez

Cada modelo declara sus restricciones en un único objeto `REGLAS`:

```js
// src/models/Entregable.js
static REGLAS = {
    titulo:      { tipo: 'texto',  min: 3, max: 150, etiqueta: 'título' },
    fechaLimite: { tipo: 'fecha',  etiqueta: 'fecha límite' },
    peso:        { tipo: 'numero', min: 1, max: 1000, etiqueta: 'peso' },
    estado:      { tipo: 'lista',  valores: EstadoEntregable.claves() },
}
```

De esa **misma** declaración salen las tres barreras:

| De `REGLAS` sale | Función | Dónde protege |
|---|---|---|
| La validación en memoria | `validarContra()` | Modelos y servicios |
| El validador de la colección | `aEsquemaMongo()` → `$jsonSchema` | **Dentro de MongoDB** |
| Los límites de la pregunta | `aOpcionesDeEntrada()` → `pedirSegunRegla()` | La consola |

Antes esto estaba escrito tres veces y podían desincronizarse. De hecho lo
estaban: la pantalla de propuestas pedía el título con `min: 3` mientras el
modelo exigía `5`, así que el usuario escribía 4 caracteres, la consola los
aceptaba y el error saltaba después. Ahora la pregunta **sale** de la regla.

### Editar valida igual que crear

El agujero más serio que había: `crear()` validaba con el modelo, pero
`editar()` comprobaba dos o tres campos a mano y se saltaba el resto.

```js
// ANTES — EntregableService.editar: solo miraba el título y el peso
const titulo = cambios.titulo ?? entregable.titulo
if (!titulo || titulo.trim().length < 3) throw new Error(...)

// AHORA — se reconstruye el modelo entero y se valida como un alta
const editado = Entregable.desdeDocumento(documento, cambios)
editado.validar()
```

Los cinco servicios que editan (`Cliente`, `Propuesta`, `Proyecto`,
`Contrato`, `Entregable`) pasan hoy por el mismo `validar()`.

### La base de datos también valida

`prepararColeccion()` aplica el `$jsonSchema` con `collMod`, así que las reglas
se mantienen al día sin borrar la base. Un documento que no cumpla el esquema
lo rechaza **MongoDB**, aunque venga de fuera de la aplicación.

### Los errores tienen tipo

Antes todo era `new Error(...)` y la consola imprimía `error.message` sin más:
un fallo del driver se veía igual que «el email está mal escrito». Ahora:

| Clase | Significa | Cómo se muestra |
|---|---|---|
| `ValidacionError` | El dato no cumple su forma | En rojo, nombrando el campo |
| `ReglaNegocioError` | El dato está bien, la operación no se puede | En rojo |
| `NoEncontradoError` | No existe ese registro | En amarillo (no es grave) |
| `ConflictoError` | Choca con algo que ya existe | En rojo |
| `OperacionCancelada` | El usuario escribió «cancelar» | En amarillo |
| *cualquier otra* | **Fallo del programa** | «Error inesperado» + aviso |

Además, la validación **acumula** los fallos y los enseña todos de una vez:

```
✖ El cliente no es válido:
  · "nombre" necesita al menos 3 caracteres (tiene 2)
  · "email" no tiene un formato válido (tiene que ser algo@algo.algo)
  · "teléfono" necesita al menos 7 dígitos (tiene 2)
```

---

## Principios SOLID aplicados

### SRP — Responsabilidad Única

| Archivo | Su única responsabilidad |
|---|---|
| `models/*.js` | Declarar la forma y las reglas de una entidad |
| `dominio/*.js` | Calcular y decidir, sin saber que existe una base de datos |
| `repositories/*.js` | Leer y escribir en MongoDB |
| `services/*.js` | Coordinar reglas de negocio |
| `commands/*.js` | Preguntar y mostrar |
| `utils/*.js` | Cómo se ve cada cosa |

Tres acoplamientos que había y se rompieron:

- **`ContratoService` maquetaba el documento del contrato** con sus rayas y su
  dinero formateado, y para eso importaba `utils/formato.js` — presentación
  dentro de la capa de negocio. Ahora devuelve datos (`datosParaDocumento`) y
  quien dibuja es `commands/contratos.js`.
- **`Entregable` y `Movimiento` importaban de `utils/`.** Las operaciones que de
  verdad necesitaban (interpretar una fecha, redondear dinero) se mudaron a
  `dominio/valores.js`. El dominio ya no depende de la capa de pantalla.
- **`commands/entregables.js` decidía reglas de negocio**: leía
  `Entregable.TRANSICIONES` para saber a qué estados se podía saltar, y
  `commands/proyectos.js` repetía la regla «el avance no retrocede» poniendo
  `min: proyecto.avance` en la pregunta. Las dos decisiones volvieron al dominio.

### OCP — Abierto/Cerrado

`index.js` tenía una cadena de `if/else` sobre el nombre del módulo: añadir uno
obligaba a **modificar** el arranque en dos sitios. Ahora el menú se genera desde
`commands/registro.js` y el despacho es una búsqueda:

```js
const modulo = buscarModulo(eleccion)
if (modulo) await modulo.abrir(servicios)
```

Lo mismo en otros tres puntos:

- Añadir un **estado de entregable** es crear una clase y registrarla; ni el
  servicio ni el menú se tocan.
- Añadir un **tipo de regla** de validación es añadir una entrada al mapa `TIPOS`.
- Añadir un **observador** al recalcular el avance es suscribirlo:
  `EntregableService` no cambia.

### LSP — Sustitución de Liskov

Los repositorios respetan el contrato de su base. Había una grieta:
`buscarPorIdOCodigo` aceptaba `"PRY-0001"`, pero `actualizar` hacía
`new ObjectId(id)` a pelo y reventaba con un error críptico del driver ante ese
mismo valor — dos métodos de la misma clase con contratos distintos. Ahora pasa
por `normalizarId()`, que lanza un `ValidacionError` explicando qué usar.

### ISP — Segregación de Interfaces

El `BaseRepositorio` anterior daba `eliminar()` a los seis repositorios, incluido
`ClienteRepositorio` — cuando la propia regla del negocio dice que **un cliente
no se borra nunca**. Heredar un método que tienes prohibido llamar es el ejemplo
de manual de violación de ISP.

Ahora la jerarquía tiene tres niveles y cada repositorio hereda solo lo que le
corresponde poder hacer:

| Nivel | Qué añade | Quién lo hereda |
|---|---|---|
| `RepositorioLectura` | consultar | *(base de todos)* |
| `RepositorioEscritura` | crear, actualizar, códigos | Cliente, Propuesta, Proyecto, Contrato, Movimiento |
| `RepositorioEliminable` | **eliminar** | Solo `EntregableRepositorio` |

El entregable es el único registro que se borra de verdad. Los clientes se
desactivan, las propuestas se rechazan, los proyectos se cancelan y los
movimientos se anulan.

### DIP — Inversión de Dependencias

La violación más seria que había: los servicios recibían **`mongoClient`**, el
cliente del driver de MongoDB, y hacían esto ellos mismos:

```js
// ANTES — la capa de negocio sabía qué es una sesión de Mongo
const session = this.mongoClient.startSession()
try { await session.withTransaction(async () => { … }) }
finally { await session.endSession() }
```

La política de alto nivel dependía del detalle de infraestructura. Ahora depende
de una abstracción, `UnidadDeTrabajo`, y solo dice *«haz esto de forma atómica»*:

```js
// AHORA — el servicio no sabe qué base de datos hay debajo
return this.unidadDeTrabajo.ejecutar(async (contexto) => { … })
```

`UnidadDeTrabajoMongo` es la implementación real; `UnidadDeTrabajoDirecta`
ejecuta sin transacción y sirve para probar servicios sin levantar un replica
set. `src/config/contenedor.js` es el **único sitio del proyecto donde se hace
`new`** de repositorios y servicios.

---

## Patrones de diseño usados

> **Nota de honestidad.** Dos de los patrones que este README declaraba antes
> estaban mal etiquetados, y aquí se explica por qué. Un *static factory method*
> no es el **Factory Method** de GoF, y pasar un callback no es **Strategy**.
> Los dos se han sustituido por implementaciones reales.

### 1. Singleton — `src/config/database.js`

Una sola instancia de `MongoClient` para toda la aplicación.

**Qué estaba mal.** El constructor tenía este guard:

```js
if (Database.instancia) return Database.instancia
```

…pero la clase **nunca se exportaba**, así que nadie podía llamar a `new` y esa
línea no se ejecutaba jamás. Era código muerto: lo que había en realidad era un
módulo con una instancia, no el patrón.

**Cómo está ahora.** El constructor está cerrado y el único acceso es
`Database.obtenerInstancia()`. Intentar `new Database()` lanza un error que
explica qué hacer.

**Por qué importa aquí:** una transacción vive dentro de una sesión, y una sesión
pertenece a un cliente. Con varios clientes los repositorios no podrían compartir
la misma transacción.

### 2. Repository — `src/repositories/`

Abstrae el acceso a datos: los servicios hablan de `crear`, `buscarPorId` y
`listar`, nunca de `insertOne` o `find`. Se puede probar la capa de negocio sin
base de datos, y la traducción de errores del driver a errores del dominio está
concentrada en un punto.

*(Este ya estaba bien aplicado; lo único que cambió es que ahora son tres niveles
por ISP.)*

### 3. Factory Method — `EstadoEntregable.desde()`

**Qué estaba mal.** El README llamaba «Factory Method» a
`Proyecto.desdePropuesta()`. Eso es un *static factory method* (un idiom muy
útil, pero un idiom): el método siempre construye la misma clase. El **Factory
Method de GoF** es un método que **delega la decisión de qué clase concreta
instanciar**.

**Cómo está ahora.** `EstadoEntregable.desde(clave)` consulta un registro de
implementaciones y devuelve la clase concreta que corresponde:

```js
const estado = EstadoEntregable.desde('aprobado')   // → EstadoAprobado
estado.cuentaParaAvance()                           // → true
```

Los servicios nunca hacen `new EstadoAprobado()`.

`Proyecto.desdePropuesta()` y `Contrato.desdeProyecto()` siguen existiendo y
siguen siendo útiles — ahora se documentan por lo que son: **métodos de
fabricación estáticos** que evitan copiar campo por campo.

### 4. State — `src/models/estados/EstadoEntregable.js`

El patrón que más falta hacía. El ciclo de vida del entregable era una tabla
`TRANSICIONES` más cuatro reglas repartidas por el código:

| Pregunta | Dónde vivía antes |
|---|---|
| ¿Puedo pasar de X a Y? | `EntregableService.cambiarEstado` |
| ¿Se puede editar? | `['pendiente','rechazado'].includes(estado)` |
| ¿Se puede borrar? | `if (estado === 'aprobado') throw` |
| ¿Suma al avance? | `filter(e => e.estado === 'aprobado')` |
| ¿Qué opciones enseño? | `commands/entregables.js` |

Cinco sitios que revisar al añadir un estado. Ahora **cada estado es una clase que
responde por sí misma** a todas esas preguntas:

```js
export class EstadoAprobado extends EstadoEntregable {
    static clave = 'aprobado'
    siguientes()         { return [] }      // final
    cuentaParaAvance()   { return true }
    permiteEliminacion() { return false }   // lo aprobado es historia
}
```

Añadir un estado `en_revision` es crear una clase y registrarla. Nada más cambia.

### 5. Strategy — `src/dominio/CalculadoraAvance.js`

**Qué estaba mal.** El README llamaba «Strategy (en su forma más simple)» a
pasarle un callback `describir` a `elegirDeLista`. Eso es una **función de orden
superior**, no Strategy: no hay familia de implementaciones intercambiables.

**Cómo está ahora.** Un proyecto calcula su avance de dos formas incompatibles, y
esa decisión era un `if` escondido dentro de `ProyectoService` con la fórmula
viviendo en otro servicio:

```js
// ANTES — una sola decisión repartida en dos servicios
if (entregables.length > 0) throw new Error('Este proyecto tiene entregables…')
```

Ahora son dos estrategias reales y un único sitio que elige:

| Estrategia | Cuándo | `permiteRegistroManual()` |
|---|---|---|
| `AvancePorEntregables` | El proyecto tiene entregables | `false` |
| `AvanceManual` | No tiene | `true` |

```js
const calculadora = calculadoraPara(proyecto, entregables)
if (!calculadora.permiteRegistroManual()) throw new ReglaNegocioError(…)
const nuevo = calculadora.calcular(porcentaje)
```

### 6. Observer — `src/eventos/` y `src/dominio/SincronizadorAvance.js`

La regla «cuando le pasa algo a un entregable, el avance del proyecto se
recalcula» estaba **copiada cuatro veces** dentro de `EntregableService` (crear,
editar, cambiar estado, eliminar), siempre el mismo bloque de leer hermanos,
calcular y actualizar.

Ahora el servicio solo anuncia lo que ha pasado:

```js
await this.emisor.emitir(EVENTOS.ENTREGABLE_CAMBIO_ESTADO, {
    proyectoId: documento.proyectoId,
    contexto,
})
```

Y `SincronizadorAvance` escucha y recalcula. El servicio ya no sabe que el avance
del proyecto existe.

**Detalle importante:** los observadores se avisan **en serie y con `await`**,
porque estos eventos ocurren dentro de una transacción: si el observador falla,
la transacción entera se deshace.

### 7. Unit of Work — `src/persistencia/UnidadDeTrabajo.js`

Encapsula «haz esto de forma atómica» detrás de una abstracción. Es la pieza que
arregla el DIP (ver arriba) y la que permite probar los servicios sin un replica
set.

### 8. Template Method — `src/models/Modelo.js`

Los seis modelos repetían la misma estructura de `validar()` y `aDocumento()`. La
base define el esqueleto y deja un gancho para lo específico:

```js
validar() {
    validarContra(this, this.constructor.REGLAS, this.constructor.entidad)
    this.validarReglasPropias()   // gancho: reglas que cruzan campos
    return this
}
```

`Movimiento` lo usa para comprobar que la categoría corresponde al tipo
(«licencias» es válida, pero no para un ingreso), algo que una regla suelta no
puede expresar.

---

## Transacciones: dónde y por qué

Todas las operaciones que escriben en **más de una colección** son transaccionales. Si cualquier paso falla, MongoDB ejecuta `abortTransaction()` y ningún cambio se persiste.

| # | Operación | Archivo | Colecciones | Qué protege |
|---|---|---|---|---|
| 1 | **Aceptar propuesta** | `PropuestaService.aceptar()` | propuestas, proyectos, contratos, contadores | Nunca queda una propuesta aceptada sin proyecto, ni un proyecto sin contrato |
| 2 | **Firmar contrato** | `ContratoService.firmar()` | contratos, proyectos | No hay contratos firmados sobre proyectos que no lo saben |
| 3 | **Cambiar estado de entregable** | `EntregableService.cambiarEstado()` | entregables, proyectos | El estado del entregable y el avance del proyecto nunca se contradicen |
| 4 | **Eliminar entregable** | `EntregableService.eliminar()` | entregables, proyectos | Borrar cambia los pesos: el avance se recalcula en el mismo acto |
| 5 | **Registrar movimiento** | `FinanzaService.registrar()` | movimientos, proyectos, contadores | **Anti-duplicidad de pagos** + acumulados siempre cuadrados |
| 6 | **Anular movimiento** | `FinanzaService.anular()` | movimientos, proyectos | La reversión del acumulado no puede perderse |

### Dónde NO se usa transacción, y por qué

`PropuestaService.rechazar()` toca **una sola colección**, así que no abre transacción. Usarlas donde no se necesitan cuesta rendimiento y complica el código sin aportar nada.

### Doble defensa contra pagos duplicados

1. **Comprobación explícita dentro de la transacción** (`FinanzaService.registrar`) — produce un mensaje claro para el usuario.
2. **Índice único en `movimientos.referencia`** — la garantía real. Si dos ejecuciones concurrentes superan la comprobación 1 a la vez, el motor rechaza la segunda y su transacción se revierte entera.

Confiar solo en la comprobación dejaría una ventana de carrera entre el `findOne` y el `insertOne`; el índice la cierra. Y cuando el índice salta, el error se traduce a una frase legible (`BaseRepositorio.traducirError`) en lugar de mostrar el `E11000` del driver.

El mismo razonamiento vale para la validación del email, que está a la vez en `utils/entrada.js` y en el modelo `Cliente`: la de la consola es para que el usuario corrija sin perder el formulario; la del modelo, porque el servicio puede llamarse desde otro sitio donde no hay nadie a quien preguntar.

---

## Pruebas

```bash
npm test                  # las cuatro suites (~1 min 30 s)

npm run test:reglas       # 35 pruebas de reglas de negocio y transacciones
npm run test:consola      # 17 pruebas de validación de entrada
npm run test:pantallas    #  8 pruebas de las vistas dibujando datos reales
npm run test:bugs         # 23 sondas que intentan romper la aplicación
```

Las pruebas se ejecutan **contra MongoDB de verdad**, sobre bases de datos desechables que se crean al empezar y se borran al terminar, así que nunca tocan tus datos.

| Suite | Qué cubre |
|---|---|
| **reglas-negocio** | Las seis transacciones, los códigos consecutivos, las máquinas de estado y todas las reglas de negocio (no cobrar más de lo pactado, no finalizar un proyecto a medias, no borrar un entregable aprobado…) |
| **consola** | Que la entrada rechaza lo que debe y vuelve a preguntar: letras donde van números, fechas imposibles como el 31 de febrero, emails sin arroba |
| **pantallas** | Conduce los seis menús con un teclado simulado y comprueba que ninguna vista revienta, ni con datos ni con las colecciones vacías |
| **caza-bugs** | Sondas dirigidas a los sitios donde suelen esconderse los errores: zonas horarias, texto libre del usuario, decimales del dinero, contadores |

La suite **caza-bugs** incluye la prueba del *rollback* real: provoca un fallo a mitad de transacción, después de que MongoDB haya incrementado un contador, y verifica que el contador vuelve solo a su valor anterior. No está simulado — es la base de datos deshaciendo un cambio ya escrito.

---

## Consideraciones técnicas

### Decisiones de diseño

| Decisión | Motivo |
|---|---|
| **Driver `mongodb` en vez de Mongoose** | Requisito del enunciado. Obliga a validar a mano, lo que se resolvió con un método `validar()` en cada modelo. |
| **ES Modules** (`"type": "module"`) | Sintaxis moderna, `import` estático y `await` en el nivel superior. |
| **Bucles en vez de recursión en los menús** | Un menú que se llama a sí mismo hace crecer la pila hasta reventar tras muchas operaciones. Cada menú es un `while (true)` del que se sale con `return`. |
| **Códigos consecutivos con `$inc` + `upsert`** | Operación atómica: dos procesos concurrentes nunca obtienen el mismo número. Participa en la transacción, así que un rollback también devuelve el consecutivo. |
| **Borrado lógico en clientes** | Un cliente con historial no se elimina, se desactiva. Preserva la integridad de proyectos y movimientos pasados. |
| **Movimientos anulados, no borrados** | Conservan su registro con estado `anulado` y cuentan 0 en el balance. Requisito contable de trazabilidad. |
| **Una sola fuente de verdad para el avance** | Si un proyecto tiene entregables, el avance lo calculan ellos y el avance manual se bloquea. Permitir ambos haría que los dos datos se contradijeran. |
| **Moneda e idioma en el `.env`** | Mudarse de país es cambiar dos líneas de configuración, no buscar y reemplazar por el código. |

### Errores corregidos que conviene conocer

Los encontró la suite de pruebas, y ninguno daba error visible:

| Problema | Consecuencia |
|---|---|
| `new Date('2026-09-15')` se interpreta como medianoche **UTC** | En Guatemala (UTC−6) las fechas se mostraban **un día antes**. En Europa el fallo no se nota, porque van por delante de UTC. |
| La coma tratada como separador decimal | Escribir `20,000` guardaba **20 quetzales**. Sin error, porque 20 es un número válido. En Guatemala la coma separa los miles. |
| `$inc` acumula error de coma flotante | El saldo pendiente salía `0.000000001` en vez de `0`, y el sistema **rechazaba el pago final exacto**. Ahora se redondea a centavos dentro de la transacción. |
| Texto del usuario directo a `$regex` | Buscar `C++` o `(web)` reventaba la consulta; buscar `.*` devolvía **todos** los registros. |

### Rendimiento

- **Pipelines de agregación** (`$group`) para los balances: sumar en Node exigiría traer todos los documentos a memoria.
- **Índices** en todos los campos usados para filtrar y ordenar.

### Seguridad

- Credenciales fuera del código, en `.env` (ignorado por git; el repositorio solo incluye `.env.example`).
- `aDocumento()` serializa **solo los campos declarados**: datos arbitrarios no pueden colarse en la base de datos.
- Escapado de caracteres especiales de regex en las búsquedas por texto.
- Confirmación explícita en las acciones destructivas, con el valor por defecto en "no".

### Limitaciones conocidas

- Aplicación **monousuario**: no hay autenticación ni control de roles.
- Los importes se manejan como `Number` en punto flotante, redondeados a centavos. Para un uso contable estricto convendría `Decimal128`.
- Sin conversión entre monedas: los balances asumen una moneda homogénea.
- La CLI está pensada para terminales con soporte UTF-8 y color.

---

## Planeación Scrum

| Elemento | Detalle |
|---|---|
| **Marco de trabajo** | SCRUM con 3 sprints de una semana |
| **Herramienta de seguimiento** | GitHub Projects *(actualizar si se usa otra)* |
| **Convención de commits** | [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`) |

---

## 👥 Créditos

Proyecto desarrollado como entrega del módulo de **Node.js con MongoDB**.

| Integrante | GitHub | Módulos a su cargo |
|---|---|---|
| **Jeshua Pérez** | [@JeshuaPerez](https://github.com/JeshuaPerez) | Clientes · Propuestas · Proyectos |
| **Daniel Borja** | [@jdanbo](https://github.com/jdanbo) | Contratos · Entregables · Finanzas |

### Agradecimientos

- Documentación oficial de [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [Refactoring Guru](https://refactoring.guru/es/design-patterns) como referencia de patrones de diseño

---

## 📄 Licencia

MIT — ver el campo `license` en `package.json`.
