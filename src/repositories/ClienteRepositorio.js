import { BaseRepositorio } from './BaseRepositorio.js'

//PATRÓN REPOSITORY — CLIENTES. HEREDA EL CRUD COMPLETO DE BASEREPOSITORIO 
//(CREAR, BUSCARPORID, LISTAR, ACTUALIZAR...).
export class ClienteRepositorio extends BaseRepositorio {
    constructor(db) {
        super(db, 'clientes') //LLAMA AL CONSTRUCTOR DEL PADRE
    }

    async buscarPorEmail(email, session) {
        return this.coleccion.findOne({ email: email.trim().toLowerCase() }, { session })
    }

    async buscarPorTexto(texto) {

        const patron = BaseRepositorio.escaparRegex(texto)

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
        await this.prepararColeccion()
        await this.coleccion.createIndex({ email: 1 }, { unique: true })
        await this.coleccion.createIndex({ codigo: 1 }, { unique: true })
    }
}
