// controllers/actualizacionController.js
// Captura las actualizaciones mensuales de cada participante.
// Calcula automáticamente los 3 scores de composición corporal
// antes de guardar en base de datos.
//
// Fórmulas de scoring:
//   scoreGrasa   = grasaInicial   - grasa        (↓ grasa = positivo)
//   scoreMusculo = musculo        - musculoInicial (↑ músculo = positivo)
//   scoreRecomp  = scoreGrasa     + scoreMusculo  (recomposición total)

const Actualizacion = require('../models/Actualizacion');
const Participante = require('../models/Participante');
const Gordoton = require('../models/Gordoton');

// ─────────────────────────────────────────────
// Función auxiliar: calcula los 3 scores
// ─────────────────────────────────────────────
const calcularScores = (participante, peso, musculo, grasa) => {
  const scoreGrasa   = Math.round(((participante.grasaInicial   - grasa)  / participante.grasaInicial)   * 100);
  const scoreMusculo = Math.round(((musculo - participante.musculoInicial) / participante.musculoInicial) * 100);
  const scoreRecomp  = Math.round((scoreGrasa + scoreMusculo) / 2);

  return { scoreGrasa, scoreMusculo, scoreRecomp };
};

// ─────────────────────────────────────────────
// GET /api/gordotones/:gordotonId/actualizaciones
// Lista todas las actualizaciones de un Gordotón
// ─────────────────────────────────────────────
const listarActualizaciones = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;

    const actualizaciones = await Actualizacion.find({ gordotonId })
      .populate('participanteId', 'nombre')
      .sort({ fecha: -1 })
      .lean();

    res.json({
      success: true,
      total: actualizaciones.length,
      data: actualizaciones,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/participantes/:participanteId/actualizaciones
// Historial completo de un participante (para dashboard HU-04)
// ─────────────────────────────────────────────
const historialParticipante = async (req, res, next) => {
  try {
    const { participanteId } = req.params;

    const participante = await Participante.findById(participanteId).lean();
    if (!participante) {
      const err = new Error('Participante no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const actualizaciones = await Actualizacion.find({ participanteId })
      .sort({ fecha: 1 })
      .lean();

    res.json({
      success: true,
      participante,
      total: actualizaciones.length,
      data: actualizaciones,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/actualizaciones
// Registra una nueva actualización y calcula los scores (HU-03)
// ─────────────────────────────────────────────
const crearActualizacion = async (req, res, next) => {
  try {
    const {
      gordotonId,
      participanteId,
      fecha,
      descripcion,
      peso,
      musculo,
      grasa,
    } = req.body;

    // Validar que el Gordotón exista y esté Activo
    const gordoton = await Gordoton.findById(gordotonId);
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }
    if (gordoton.estado !== 'Activo') {
      const err = new Error(
        'No se pueden registrar actualizaciones en un Gordotón Finalizado'
      );
      err.statusCode = 403;
      return next(err);
    }

    // Obtener participante para calcular scores contra valores iniciales
    const participante = await Participante.findById(participanteId);
    if (!participante) {
      const err = new Error('Participante no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    // Verificar que el participante pertenezca a ese Gordotón
    if (participante.gordotonId.toString() !== gordotonId) {
      const err = new Error(
        'El participante no pertenece al Gordotón especificado'
      );
      err.statusCode = 400;
      return next(err);
    }

    // Calcular los 3 scores automáticamente
    const scores = calcularScores(participante, peso, musculo, grasa);

    const actualizacion = await Actualizacion.create({
      gordotonId,
      participanteId,
      fecha: fecha || new Date(),
      descripcion,
      peso,
      musculo,
      grasa,
      ...scores,
    });

    res.status(201).json({
      success: true,
      message: 'Actualización registrada correctamente',
      data: actualizacion,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/actualizaciones/:id
// Elimina una actualización específica
// ─────────────────────────────────────────────
const eliminarActualizacion = async (req, res, next) => {
  try {
    const actualizacion = await Actualizacion.findByIdAndDelete(req.params.id);

    if (!actualizacion) {
      const err = new Error('Actualización no encontrada');
      err.statusCode = 404;
      return next(err);
    }

    res.json({ success: true, message: 'Actualización eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarActualizaciones,
  historialParticipante,
  crearActualizacion,
  eliminarActualizacion,
};
