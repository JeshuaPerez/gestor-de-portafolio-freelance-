import { menuClientes } from './clientes.js'
import { menuFinanzas } from './finanzas.js'
import { menuPropuestas } from './propuestas.js'
import { menuProyectos } from './proyectos.js'

// REGISTRO DE MÓDULOS DEL MENÚ PRINCIPAL (OCP)
//
// index.js tenía esto:
//
//     if (modulo === 'clientes') await menuClientes(clienteService)
//     else if (modulo === 'propuestas') await menuPropuestas(propuestaService)
//     else if (...)  ...seis veces
//
// Añadir un módulo obligaba a MODIFICAR index.js en dos sitios (la lista de
// opciones y la cadena de ifs). Eso es justo lo que el principio de
// Abierto/Cerrado quiere evitar.
//
// Ahora el menú se genera desde esta lista y el despacho es una búsqueda.
// Añadir un módulo es añadir una entrada aquí: index.js no se toca.
//
// Fíjate en quién falta: Entregables y Contratos. Ya no son módulos del menú
// principal porque no son entidades independientes — se entra a ellos desde
// su proyecto.

export const MODULOS = [
    {
        id: 'clientes',
        nombre: 'Clientes',
        // Cada módulo recibe SOLO el servicio que necesita, no la app entera (ISP).
        abrir: (servicios) => menuClientes(servicios.clientes),
    },
    {
        id: 'propuestas',
        nombre: 'Propuestas',
        abrir: (servicios) => menuPropuestas(servicios.propuestas),
    },
    {
        id: 'proyectos',
        nombre: 'Proyectos',
        pista: 'entregables y contrato están dentro de cada proyecto',
        // Este necesita tres servicios porque los entregables y el contrato
        // son parte del proyecto. Se le pasan los tres, nombrados: no un
        // objeto con todo.
        abrir: (servicios) =>
            menuProyectos({
                proyectos: servicios.proyectos,
                entregables: servicios.entregables,
                contratos: servicios.contratos,
            }),
    },
    {
        id: 'finanzas',
        nombre: 'Finanzas',
        abrir: (servicios) => menuFinanzas(servicios.finanzas),
    },
]

/** Las opciones tal y como las espera `elegirAccion`. */
export function opcionesDelMenu(estilo) {
    return [
        ...MODULOS.map((modulo) => ({
            nombre: modulo.pista
                ? `${modulo.nombre}  ${estilo.tenue(`(${modulo.pista})`)}`
                : modulo.nombre,
            valor: modulo.id,
        })),
        { separador: true },
        { nombre: 'Salir', valor: 'salir' },
    ]
}

export function buscarModulo(id) {
    return MODULOS.find((modulo) => modulo.id === id)
}
