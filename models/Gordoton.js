// models/Gordoton.js
// IMPORTANTE: se especifica { collection: 'gordotones' } para evitar
// que Mongoose pluralice automáticamente a "gordotons" (pluralización en inglés).

const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GordotonSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del Gordotón es obligatorio'],
      unique: true,
      trim: true,
      maxlength: [100, 'El nombre no puede superar 100 caracteres'],
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción no puede superar 500 caracteres'],
      default: '',
    },
    fechaInicio: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },
    fechaFin: {
      type: Date,
      required: [true, 'La fecha de fin es obligatoria'],
    },
    estado: {
      type: String,
      enum: {
        values: ['Activo', 'Finalizado'],
        message: 'El estado debe ser "Activo" o "Finalizado"',
      },
      default: 'Activo',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'gordotones', // ← Fuerza el nombre correcto en MongoDB
  }
);

// Validación CA-05: fechaInicio no posterior a fechaFin
GordotonSchema.pre('save', function (next) {
  if (this.fechaInicio > this.fechaFin) {
    return next(new Error('La fecha de inicio no puede ser posterior a la fecha de fin'));
  }
  next();
});

GordotonSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const inicio = update.fechaInicio || update.$set?.fechaInicio;
  const fin    = update.fechaFin    || update.$set?.fechaFin;
  if (inicio && fin && new Date(inicio) > new Date(fin)) {
    return next(new Error('La fecha de inicio no puede ser posterior a la fecha de fin'));
  }
  next();
});

module.exports = mongoose.model('Gordoton', GordotonSchema);
