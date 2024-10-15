import mongoose from 'mongoose'

const entitySchema = new mongoose.Schema({
  type: { type: String, required: true },
  position: { x: Number, y: Number },
  attributes: { type: Object, default: {} },
})

const Entity = mongoose.model('Entity', entitySchema)

export default Entity
