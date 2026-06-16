import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000
    })
    console.log('MongoDB connected')
  } catch (err) {
    console.warn('MongoDB not available — running in offline mode.')
    console.warn('(Set MONGO_URI in .env to enable persistence)')
  }
}

export default connectDB
