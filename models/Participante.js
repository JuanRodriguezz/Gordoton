// models/Participante.js
// IMPORTANTE: se especifica { collection: 'participantes' } para evitar
// que Mongoose pluralice a "participantes" de forma incorrecta en algunos entornos.

const mongoose = require('mongoose');

const ParticipanteSchema = new mongoose.Schema(
  {
    gordotonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gordoton',
      required: [true, 'El ID del Gordotón es obligatorio'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del participante es obligatorio'],
      trim: true,
      maxlength: [150, 'El nombre no puede superar 150 caracteres'],
    },
    pesoInicial: {
      type: Number,
      required: [true, 'El peso inicial es obligatorio'],
      min: [1, 'El peso debe ser mayor a 0'],
    },
    musculoInicial: {
      type: Number,
      required: [true, 'El músculo inicial es obligatorio'],
      min: [0, 'El músculo no puede ser negativo'],
    },
    grasaInicial: {
      type: Number,
      required: [true, 'La grasa inicial es obligatoria'],
      min: [0, 'La grasa no puede ser negativa'],
    },
    fechaRegistro: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'participantes', // ← Fuerza el nombre correcto en MongoDB
  }
);

ParticipanteSchema.index({ gordotonId: 1 });
ParticipanteSchema.index({ gordotonId: 1, nombre: 1 });

module.exports = mongoose.model('Participante', ParticipanteSchema);
