// config/db.js
// Gestiona la conexión a MongoDB con Mongoose.
// Carga el .env con ruta absoluta para garantizar que MONGO_URI
// esté disponible sin importar desde qué directorio se ejecute el script.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gordoton';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado. Reintentando...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado.');
    });
  } catch (error) {
    console.error(`❌ Error al conectar MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
