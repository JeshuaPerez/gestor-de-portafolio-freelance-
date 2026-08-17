# 💼 Freelance Portfolio CLI

Aplicación de línea de comandos en **Node.js** que permite a un freelancer gestionar su portafolio profesional completo: clientes, propuestas, proyectos, contratos, entregables y finanzas.

Construida con **Programación Orientada a Objetos**, aplicando **principios SOLID** y **patrones de diseño**, con persistencia en **MongoDB** mediante el driver oficial (`mongodb`, sin Mongoose) y **transacciones reales** en todas las operaciones que tocan más de una colección.

---

## 📑 Tabla de contenidos

- [Descripción del proyecto](#-descripción-del-proyecto)
- [Vídeo de presentación](#-vídeo-de-presentación)
- [Requisitos previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración de MongoDB](#️-configuración-de-mongodb)
- [Uso](#-uso)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Modelo de datos](#️-modelo-de-datos)
- [Principios SOLID aplicados](#-principios-solid-aplicados)
- [Patrones de diseño usados](#-patrones-de-diseño-usados)
- [Transacciones: dónde y por qué](#-transacciones-dónde-y-por-qué)
- [Pruebas](#-pruebas)
- [Consideraciones técnicas](#️-consideraciones-técnicas)
- [Planeación Scrum](#-planeación-scrum)
- [Créditos](#-créditos)

---

## 📖 Descripción del proyecto

**Freelance Portfolio CLI** resuelve un problema real: un profesional independiente gestiona su negocio repartido entre hojas de cálculo, notas sueltas y correos. Esta herramienta centraliza todo el ciclo comercial en una única aplicación de consola:

```
Cliente → Propuesta → [aceptación] → Proyecto + Contrato → Entregables → Cobros
```

### Funcionalidades

| Módulo | Capacidades |
|---|---|
| **👥 Clientes** | Alta y **edición** con validación, búsqueda por código/nombre/empresa/email, desactivación y reactivación (borrado lógico) |
| **📄 Propuestas** | Crear y editar (solo mientras estén pendientes); **aceptar genera proyecto y contrato en una sola transacción**; rechazar con motivo; estadísticas de conversión |
| **🗂️ Proyectos** | Listado y filtro por estado, ficha completa, edición de nombre, descripción y fecha de fin, registro de avance manual, finalización y cancelación |
| **📜 Contratos** | Relación 1:1 con el proyecto, edición de condiciones, forma de pago y valor mientras sea borrador, **firma transaccional**, documento imprimible |
| **📦 Entregables** | Por proyecto, con fecha límite y peso. Máquina de estados (pendiente → entregado → aprobado/rechazado). **Cada cambio de estado —y cada edición del peso— recalcula el avance del proyecto dentro de una transacción** |
| **💰 Finanzas** | Ingresos y egresos por proyecto, **anti-duplicidad de pagos**, anulación con reversión de acumulados, balance general, balance por cliente y análisis de rentabilidad. Los importes **no se editan**: se anula y se registra de nuevo |

### Todo se identifica con códigos legibles

El usuario **nunca ve un `ObjectId`**. Cada registro recibe un código consecutivo al crearse:

```
CLI-0001   PRO-0001   PRY-0001   CON-0001   ENT-0001   MOV-0001
```

Los servicios aceptan indistintamente el código o el identificador interno (`BaseRepositorio.buscarPorIdOCodigo`), y los menús ofrecen listas navegables con flechas, así que en la práctica no hay que teclear ninguno.

---

## 🎥 Vídeo de presentación

> 🔗 **[VER VÍDEO DE PRESENTACIÓN](https://ENLACE-PENDIENTE)**

---

## ✅ Requisitos previos

| Software | Versión mínima | Notas |
|---|---|---|
| **Node.js** | 18.0.0+ | Probado en Node 24. Requiere soporte de ESM y `await` en el nivel superior |
| **npm** | 9+ | Incluido con Node |
| **MongoDB** | 4.4+ | **Debe ser replica set o cluster sharded** — las transacciones no funcionan en `mongod` standalone |

---

## 🚀 Instalación

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

## 🗄️ Configuración de MongoDB

> ⚠️ **Importante:** las transacciones de MongoDB **solo funcionan sobre un replica set o un cluster sharded**. Un `mongod` en modo standalone las rechaza con el error *"Transaction numbers are only allowed on a replica set member or mongos"*.

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

## 💻 Uso

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

## 📁 Estructura del proyecto

```
freelance-portfolio-cli/
│
├── index.js                     # Punto de entrada: aquí se arma la aplicación
├── package.json
├── .env.example                 # Plantilla de variables de entorno
├── .gitignore
├── README.md
│
├── src/
│   ├── config/
│   │   └── database.js          # Conexión a MongoDB — SINGLETON
│   │
│   ├── models/                  # 📋 Entidades: forma del dato y sus validaciones
│   │   ├── Cliente.js
│   │   ├── Propuesta.js
│   │   ├── Proyecto.js          # + FACTORY METHOD (desdePropuesta)
│   │   ├── Contrato.js          # + FACTORY METHOD (desdeProyecto)
│   │   ├── Entregable.js        # + máquina de estados (TRANSICIONES)
│   │   └── Movimiento.js        # + categorías cruzadas con el tipo
│   │
│   ├── repositories/            # 🗄️ Acceso a datos — REPOSITORY
│   │   ├── BaseRepositorio.js   # CRUD genérico, códigos consecutivos, sesiones
│   │   ├── ClienteRepositorio.js
│   │   ├── PropuestaRepositorio.js
│   │   ├── ProyectoRepositorio.js
│   │   ├── ContratoRepositorio.js
│   │   ├── EntregableRepositorio.js
│   │   └── MovimientoRepositorio.js
│   │
│   ├── services/                # 🧠 Reglas de negocio y TRANSACCIONES
│   │   ├── ClienteService.js
│   │   ├── PropuestaService.js  # ★ aceptar → propuesta + proyecto + contrato
│   │   ├── ProyectoService.js
│   │   ├── ContratoService.js   # ★ firmar
│   │   ├── EntregableService.js # ★ cambiar estado / eliminar
│   │   └── FinanzaService.js    # ★ registrar / anular movimiento
│   │
│   ├── commands/                # 🎮 Presentación: los seis menús
│   │   ├── clientes.js
│   │   ├── propuestas.js
│   │   ├── proyectos.js
│   │   ├── contratos.js
│   │   ├── entregables.js
│   │   └── finanzas.js
│   │
│   └── utils/                   # 🛠️ Utilidades transversales
│       ├── entrada.js           # Preguntar Y validar (sobre inquirer)
│       ├── estilo.js            # Colores con significado (chalk)
│       ├── tabla.js             # Tablas (cli-table3)
│       ├── panel.js             # Recuadros (boxen)
│       ├── formato.js           # Dinero, fechas y zona horaria (dayjs)
│       └── espera.js            # Indicador de progreso (ora)
│
└── tests/
    ├── reglas-negocio.test.js   # 35 pruebas de reglas y transacciones
    ├── consola.test.js          # 17 pruebas de la capa de consola
    ├── pantallas.test.js        #  8 pruebas de las vistas dibujando datos
    ├── caza-bugs.test.js        # 23 sondas contra errores conocidos
    └── ayuda-teclado.js         # Teclado y pantalla simulados
```

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

📍 **Comprobación rápida:** busca `console.log` en `/src/services` — no hay ninguno. Busca `collection` u `ObjectId` en `/src/commands` — solo aparecen dentro de un comentario que explica precisamente que no deben aparecer.

---

## 🗃️ Modelo de datos

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

## 🧱 Principios SOLID aplicados

### 1️⃣ SRP — Responsabilidad Única

| Archivo | Su única responsabilidad | Lo que NO hace |
|---|---|---|
| `models/Cliente.js` | Definir la forma y validez de un cliente | No sabe guardar ni imprimir |
| `repositories/ClienteRepositorio.js` | Leer y escribir en MongoDB | No conoce reglas de negocio |
| `services/ClienteService.js` | Aplicar reglas de negocio | No imprime nada por consola |
| `commands/clientes.js` | Preguntar y mostrar | No consulta la base de datos, ni valida |
| `utils/entrada.js` | Preguntar y validar la respuesta | No decide qué se pregunta |
| `utils/estilo.js` | Decidir cómo se ve cada cosa | No decide qué se muestra |

📍 Ejemplo pequeño pero claro: `config/database.js` **no imprime nada**. Antes hacía un `console.log` al conectarse, lo que le daba dos trabajos: conectarse y contarlo. Ahora solo se conecta, y quien avisa al usuario es `index.js`.

### 2️⃣ OCP — Abierto/Cerrado

- 📍 `repositories/BaseRepositorio.js` no se modifica nunca. Cuando un repositorio necesita algo propio (`buscarPorEmail`, `listarVencidos`), lo **añade** en su propia clase.
- 📍 Añadir un estado nuevo a los entregables es añadir una fila a `Entregable.TRANSICIONES`; ni el servicio ni el menú cambian.
- 📍 Añadir una categoría financiera es añadirla a `Movimiento.CATEGORIAS`; el menú la ofrecerá sola.

### 3️⃣ LSP — Sustitución de Liskov

Los seis repositorios heredan de `BaseRepositorio` y respetan su contrato: cualquiera puede usarse donde se espere el padre. Ninguno endurece las condiciones ni cambia el significado de los métodos heredados — `crear` siempre crea y devuelve el identificador, `actualizar` siempre devuelve si encontró el documento.

### 4️⃣ ISP — Segregación de Interfaces

- 📍 `utils/entrada.js` expone funciones pequeñas y específicas (`pedirTexto`, `pedirNumero`, `pedirFecha`, `pedirEmail`, `confirmar`, `elegirDeLista`) en lugar de un único método gigante con veinte parámetros.
- 📍 Cada menú recibe **solo su servicio**, no un objeto con toda la aplicación.

### 5️⃣ DIP — Inversión de Dependencias

📍 Todos los servicios reciben sus colaboradores por constructor, nunca los construyen:

```js
// src/services/PropuestaService.js
constructor(propuestaRepositorio, proyectoRepositorio, contratoRepositorio,
            clienteRepositorio, mongoClient) { … }
```

📍 `index.js` es el **único sitio de todo el proyecto** donde se hace `new` de repositorios y servicios. Consecuencias directas:

- Para probar un servicio se le pasan repositorios falsos sin tocar su código.
- Cambiar MongoDB por otra base implicaría reescribir `/repositories` y nada más: ningún servicio cambiaría.

---

## 🎯 Patrones de diseño usados

### 1. 🏛️ Singleton — `src/config/database.js`

Una única instancia de `MongoClient` compartida por toda la aplicación. La clase guarda su propia instancia en una propiedad estática y la devuelve si alguien intenta crear otra.

**Por qué:** abrir un cliente por operación agotaría el pool de conexiones, y sobre todo impediría compartir sesiones coherentes entre repositorios dentro de una misma transacción — una transacción vive dentro de una conexión.

### 2. 🗄️ Repository — `src/repositories/`

Abstrae el acceso a datos. Los servicios hablan de `crear`, `buscarPorId`, `listar`; nunca de `insertOne` o `find`.

**Por qué:** aísla la persistencia en una capa, permite probar los servicios sin base de datos y concentra en un punto la traducción de errores del driver a mensajes de dominio.

La herencia hace el trabajo pesado: `ClienteRepositorio` recibe todo el CRUD de `BaseRepositorio` y solo escribe lo que es exclusivamente suyo.

### 3. 🏭 Factory Method — `Proyecto.desdePropuesta()` y `Contrato.desdeProyecto()`

El propio modelo sabe cómo derivarse de otro:

```js
const proyecto = Proyecto.desdePropuesta(propuesta, codigo)
```

**Por qué:** si el servicio fuera copiando campo por campo, el día que el proyecto herede un dato más de la propuesta habría que recordar cambiarlo allí. Así se cambia en un solo sitio, y es el modelo —que es quien sabe de su propia forma— el que decide.

### 4. 🎭 Strategy (en su forma más simple) — `utils/entrada.js`

`elegirDeLista` no sabe cómo se describe un cliente ni una propuesta. Recibe esa decisión desde fuera:

```js
await elegirDeLista(clientes, {
    etiqueta: 'Elige el cliente',
    describir: (c) => `${c.codigo}  ${c.nombre}  <${c.email}>`,
})
```

**Por qué:** el "cómo se pinta" se inyecta en lugar de estar escrito dentro, y por eso la misma función sirve para los seis módulos.

---

## 🔐 Transacciones: dónde y por qué

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

## 🧪 Pruebas

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

## ⚙️ Consideraciones técnicas

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

## 📋 Planeación Scrum

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
