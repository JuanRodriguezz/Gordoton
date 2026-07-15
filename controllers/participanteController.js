// controllers/participanteController.js
// Lógica de negocio para registro y consulta de participantes.
// Los valores iniciales (peso, musculo, grasa) se usan como
// línea base para calcular scores en cada actualización.

const Participante = require('../models/Participante');
const Gordoton = require('../models/Gordoton');
const Actualizacion = require('../models/Actualizacion');

// ─────────────────────────────────────────────
// GET /api/gordotones/:gordotonId/participantes
// Lista participantes de un Gordotón específico
// ─────────────────────────────────────────────
const listarParticipantes = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;

    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const participantes = await Participante.find({ gordotonId })
      .sort({ fechaRegistro: 1 })
      .lean();

    res.json({
      success: true,
      gordoton: gordoton.nombre,
      total: participantes.length,
      data: participantes,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/participantes/:id
// Obtiene un participante con su última actualización
// ─────────────────────────────────────────────
const obtenerParticipante = async (req, res, next) => {
  try {
    const participante = await Participante.findById(req.params.id)
      .populate('gordotonId', 'nombre estado')
      .lean();

    if (!participante) {
      const err = new Error('Participante no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const ultimaActualizacion = await Actualizacion.findOne({
      participanteId: req.params.id,
    })
      .sort({ fecha: -1 })
      .lean();

    res.json({
      success: true,
      data: { ...participante, ultimaActualizacion },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/gordotones/:gordotonId/participantes
// Registra un nuevo participante en un Gordotón
// ─────────────────────────────────────────────
const crearParticipante = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;
    const { nombre, pesoInicial, musculoInicial, grasaInicial } = req.body;

    const gordoton = await Gordoton.findById(gordotonId);
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    if (gordoton.estado !== 'Activo') {
      const err = new Error(
        'No se pueden registrar participantes en un Gordotón Finalizado'
      );
      err.statusCode = 403;
      return next(err);
    }

    const participante = await Participante.create({
      gordotonId,
      nombre,
      pesoInicial,
      musculoInicial,
      grasaInicial,
      fechaRegistro: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Participante registrado correctamente',
      data: participante,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/participantes/:id
// Elimina participante si no tiene actualizaciones
// ─────────────────────────────────────────────
const eliminarParticipante = async (req, res, next) => {
  try {
    const participante = await Participante.findById(req.params.id);
    if (!participante) {
      const err = new Error('Participante no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const totalActualizaciones = await Actualizacion.countDocuments({
      participanteId: req.params.id,
    });

    if (totalActualizaciones > 0) {
      const err = new Error(
        `No se puede eliminar: este participante tiene ${totalActualizaciones} actualización(es) registrada(s)`
      );
      err.statusCode = 409;
      return next(err);
    }

    await participante.deleteOne();
    res.json({ success: true, message: 'Participante eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarParticipantes,
  obtenerParticipante,
  crearParticipante,
  eliminarParticipante,
};
