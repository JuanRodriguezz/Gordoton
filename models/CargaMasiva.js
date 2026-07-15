// models/CargaMasiva.js
// Registra el historial de cada operación de carga masiva.
// Permite trazabilidad completa: qué archivo generó qué actualizaciones.

const mongoose = require('mongoose');

const ErrorFila = new mongoose.Schema({
  fila:        { type: Number, required: true },
  participante:{ type: String, default: '' },
  mensaje:     { type: String, required: true },
}, { _id: false });

const CargaMasivaSchema = new mongoose.Schema(
  {
    gordotonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gordoton',
      required: [true, 'El ID del Gordotón es obligatorio'],
    },
    nombreArchivo: {
      type: String,
      required: true,
      trim: true,
    },
    estado: {
      type: String,
      enum: ['Validando', 'Procesando', 'Completado', 'Error'],
      default: 'Validando',
    },
    totalFilas:    { type: Number, default: 0 },
    filasExitosas: { type: Number, default: 0 },
    filasError:    { type: Number, default: 0 },
    errores:       { type: [ErrorFila], default: [] },
    fechaCarga:    { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'cargas_masivas',
  }
);

CargaMasivaSchema.index({ gordotonId: 1, fechaCarga: -1 });

module.exports = mongoose.model('CargaMasiva', CargaMasivaSchema);
