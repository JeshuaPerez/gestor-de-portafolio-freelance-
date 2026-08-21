import { RepositorioEscritura } from './RepositorioEscritura.js'

// PATRÓN REPOSITORY — NIVEL 3: TAMBIÉN BORRAR
//
// Hoy solo lo hereda EntregableRepositorio: el entregable es el único registro
// del sistema que se borra físicamente (y aun así, el estado "aprobado" lo
// impide — esa regla la pone el patrón State, no el repositorio).
export class RepositorioEliminable extends RepositorioEscritura {
    async eliminar(id, contexto) {
        const resultado = await this.coleccion.deleteOne(
            { _id: RepositorioEliminable.normalizarId(id) },
            { session: contexto },
        )
        return resultado.deletedCount > 0
    }
}
