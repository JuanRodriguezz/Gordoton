// config/db.js
// Gestiona la conexión a MongoDB con Mongoose.
// Carga el .env con ruta absoluta para garantizar que MONGO_URI
// esté disponible sin importar desde qué directorio se ejecute el script.

// config/db.js — corregido para Railway
const path    = require('path');
const mongoose = require('mongoose');

// Solo cargar dotenv si existe el archivo .env (desarrollo local)
// En Railway las variables ya están en process.env sin necesidad de dotenv
const envPath = path.resolve(__dirname, '../.env');
if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gordoton';

const connectDB = async () => {
  try {
    console.log('🔍 Conectando a:', MONGO_URI.substring(0, 30) + '...'); // muestra inicio de URI sin exponer contraseña
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB desconectado.'));
    mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconectado.'));
  } catch (error) {
    console.error(`❌ Error al conectar MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;