import { Cliente } from '../models/Cliente.js'
import { RepositorioEscritura } from './RepositorioEscritura.js'

// PATRÓN REPOSITORY — CLIENTES
//
// Hereda de RepositorioEscritura, NO de RepositorioEliminable: un cliente
// nunca se borra, se desactiva. Ahora eso no es solo un comentario en el
// servicio — es que el método `eliminar` no existe en esta clase.
export class ClienteRepositorio extends RepositorioEscritura {
    constructor(db) {
        super(db, 'clientes')
    }

    async buscarPorEmail(email, contexto) {
        return this.coleccion.findOne(
            { email: email.trim().toLowerCase() },
            { session: contexto },
        )
    }

    async buscarPorTexto(texto) {
        const patron = ClienteRepositorio.escaparRegex(texto)

        return this.coleccion
            .find({
                $or: [
                    { codigo: { $regex: patron, $options: 'i' } },
                    { nombre: { $regex: patron, $options: 'i' } },
                    { empresa: { $regex: patron, $options: 'i' } },
                    { email: { $regex: patron, $options: 'i' } },
                ],
            })
            .toArray()
    }

    async crearIndices() {
        // El esquema sale del modelo: la misma declaración que valida en memoria.
        await this.prepararColeccion(Cliente.esquemaMongo())
        await this.coleccion.createIndex({ email: 1 }, { unique: true })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
