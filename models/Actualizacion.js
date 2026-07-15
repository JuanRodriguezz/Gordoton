// models/Actualizacion.js — v1.1.0 + HU-06
// Se agrega cargaMasivaId (opcional) para trazabilidad de cargas masivas.

const mongoose = require('mongoose');

const ActualizacionSchema = new mongoose.Schema(
  {
    gordotonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gordoton',
      required: [true, 'El ID del Gordotón es obligatorio'],
    },
    participanteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participante',
      required: [true, 'El ID del participante es obligatorio'],
    },
    // Referencia opcional a la carga masiva que generó este registro (HU-06)
    cargaMasivaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CargaMasiva',
      default: null,
    },
    fecha: {
      type: Date,
      required: [true, 'La fecha es obligatoria'],
      default: Date.now,
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción no puede superar 500 caracteres'],
      default: '',
    },
    peso:    { type: Number, required: true, min: [1, 'El peso debe ser mayor a 0'] },
    musculo: { type: Number, required: true, min: [0, 'El músculo no puede ser negativo'] },
    grasa:   { type: Number, required: true, min: [0, 'La grasa no puede ser negativa'] },
    scoreGrasa:   { type: Number, default: 0 },
    scoreMusculo: { type: Number, default: 0 },
    scoreRecomp:  { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'actualizaciones',
  }
);

ActualizacionSchema.index({ gordotonId: 1, participanteId: 1 });
ActualizacionSchema.index({ gordotonId: 1, fecha: -1 });
ActualizacionSchema.index({ gordotonId: 1, scoreRecomp: -1 });

module.exports = mongoose.model('Actualizacion', ActualizacionSchema);
