import { SincronizadorAvance } from '../dominio/SincronizadorAvance.js'
import { EmisorEventos } from '../eventos/EmisorEventos.js'
import { UnidadDeTrabajoMongo } from '../persistencia/UnidadDeTrabajo.js'
import { ClienteRepositorio } from '../repositories/ClienteRepositorio.js'
import { ContratoRepositorio } from '../repositories/ContratoRepositorio.js'
import { EntregableRepositorio } from '../repositories/EntregableRepositorio.js'
import { MovimientoRepositorio } from '../repositories/MovimientoRepositorio.js'
import { PropuestaRepositorio } from '../repositories/PropuestaRepositorio.js'
import { ProyectoRepositorio } from '../repositories/ProyectoRepositorio.js'
import { ClienteService } from '../services/ClienteService.js'
import { ContratoService } from '../services/ContratoService.js'
import { EntregableService } from '../services/EntregableService.js'
import { FinanzaService } from '../services/FinanzaService.js'
import { PropuestaService } from '../services/PropuestaService.js'
import { ProyectoService } from '../services/ProyectoService.js'

// COMPOSITION ROOT — EL ÚNICO SITIO DONDE SE HACE `new`
//
// Aquí es donde vive la Inversión de Dependencias: ninguna clase construye a
// sus colaboradores, todas los reciben. Este archivo los junta.
//
// Consecuencia práctica: para probar cualquier servicio se le pasan dobles
// (repositorios falsos, una UnidadDeTrabajoDirecta) sin tocar su código.

export function construirRepositorios(db) {
    return {
        clientes: new ClienteRepositorio(db),
        propuestas: new PropuestaRepositorio(db),
        proyectos: new ProyectoRepositorio(db),
        contratos: new ContratoRepositorio(db),
        entregables: new EntregableRepositorio(db),
        movimientos: new MovimientoRepositorio(db),
    }
}

export async function prepararColecciones(repositorios) {
    for (const repositorio of Object.values(repositorios)) {
        await repositorio.crearIndices()
    }
}

/**
 * Monta la capa de negocio.
 *
 * @param repositorios   los seis repositorios
 * @param unidadDeTrabajo  cómo se ejecuta algo de forma atómica (abstracción)
 */
export function construirServicios(repositorios, unidadDeTrabajo) {
    const { clientes, propuestas, proyectos, contratos, entregables, movimientos } = repositorios

    // OBSERVER: el emisor y quien escucha. El sincronizador es el que
    // recalcula el avance del proyecto cuando un entregable se mueve.
    const emisor = new EmisorEventos()
    new SincronizadorAvance(entregables, proyectos).registrarEn(emisor)

    return {
        emisor,
        clientes: new ClienteService(clientes),
        proyectos: new ProyectoService(proyectos, clientes, entregables),
        propuestas: new PropuestaService(
            propuestas,
            proyectos,
            contratos,
            clientes,
            unidadDeTrabajo,
        ),
        contratos: new ContratoService(contratos, proyectos, clientes, unidadDeTrabajo),
        entregables: new EntregableService(entregables, proyectos, unidadDeTrabajo, emisor),
        finanzas: new FinanzaService(movimientos, proyectos, clientes, unidadDeTrabajo),
    }
}

/** Atajo para el arranque normal de la aplicación. */
export async function construirAplicacion(db, mongoClient) {
    const repositorios = construirRepositorios(db)
    await prepararColecciones(repositorios)

    const unidadDeTrabajo = new UnidadDeTrabajoMongo(mongoClient)

    return construirServicios(repositorios, unidadDeTrabajo)
}
