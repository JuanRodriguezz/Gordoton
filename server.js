// server.js — v1.2.0 (agrega HU-06 carga masiva)
// Diferencia respecto a v1.1.0: nueva ruta /api/carga-masiva
// y aumento del límite de payload para recibir archivos Excel grandes

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const connectDB              = require('./config/db');
const gordotonRoutes         = require('./routes/gordotonRoutes');
const participanteRoutes     = require('./routes/participanteRoutes');
const actualizacionRoutes    = require('./routes/actualizacionRoutes');
const dashboardRoutes        = require('./routes/dashboardRoutes');
const rankingRoutes          = require('./routes/rankingRoutes');
const cargaMasivaRoutes      = require('./routes/cargaMasivaRoutes');
const notFound               = require('./middlewares/notFound');
const errorHandler           = require('./middlewares/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST','PUT','PATCH','DELETE'] }));

// Aumentar límite a 10mb para recibir Excel grandes como JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => res.json({
  success: true, message: 'Gordotón API v1.2.0', version: '1.2.0',
  timestamp: new Date().toISOString(),
}));

// Rutas API
app.use('/api/gordotones',    gordotonRoutes);
app.use('/api/participantes', participanteRoutes);
app.use('/api/actualizaciones', actualizacionRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/ranking',       rankingRoutes);
app.use('/api/carga-masiva',  cargaMasivaRoutes);  // HU-06

// Frontend fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`📋 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
