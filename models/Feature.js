import mongoose from 'mongoose'

const featureSchema = new mongoose.Schema({
  type: { type: String, required: true },
  position: { x: Number, y: Number },
  details: { type: Object, default: {} },
})

const Feature = mongoose.model('Feature', featureSchema)

export default Feature
