// controllers/dashboardController.js
// HU-04 — Dashboard de avance por participante.
//
// Endpoints:
//   GET /api/dashboard/:gordotonId/:participanteId
//       ?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
//
// Devuelve:
//   - participante con datos iniciales (línea base)
//   - historial de actualizaciones ordenado cronológicamente
//   - series listas para graficar (labels + datasets)
//   - deltas calculados: Δ peso, Δ grasa, Δ músculo vs valores iniciales
//   - última actualización con indicadores positivo/negativo

const Gordoton      = require('../models/Gordoton');
const Participante  = require('../models/Participante');
const Actualizacion = require('../models/Actualizacion');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Formatea una fecha a string legible "DD mmm YYYY"
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const formatFecha = (d) => {
  const f = new Date(d);
  return `${String(f.getDate()).padStart(2,'0')} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
};

// Calcula el delta entre valor final e inicial, redondeado a 2 decimales
const delta = (final, inicial) => Math.round((final - inicial) * 100) / 100;

// Determina si un delta es "positivo" desde la perspectiva de la competencia:
//   grasa: bajar es positivo   → delta negativo = mejora
//   peso:  bajar es positivo   → delta negativo = mejora
//   musculo: subir es positivo → delta positivo = mejora
const direccion = (campo, valor) => {
  if (campo === 'musculo') return valor >= 0 ? 'positivo' : 'negativo';
  return valor <= 0 ? 'positivo' : 'negativo';
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/:gordotonId/:participanteId
// ─────────────────────────────────────────────────────────────
const obtenerDashboard = async (req, res, next) => {
  try {
    const { gordotonId, participanteId } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    // Validar gordotón
    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    // Validar participante y que pertenezca al gordotón
    const participante = await Participante.findById(participanteId).lean();
    if (!participante) {
      const err = new Error('Participante no encontrado');
      err.statusCode = 404;
      return next(err);
    }
    if (participante.gordotonId.toString() !== gordotonId) {
      const err = new Error('El participante no pertenece a este Gordotón');
      err.statusCode = 400;
      return next(err);
    }

    // Construir filtro de fechas (CA-06)
    const filtro = { gordotonId, participanteId };
    if (fechaInicio || fechaFin) {
      filtro.fecha = {};
      if (fechaInicio) filtro.fecha.$gte = new Date(fechaInicio);
      if (fechaFin)    filtro.fecha.$lte = new Date(fechaFin + 'T23:59:59.999Z');
    }

    // Consultar historial ordenado cronológicamente (CA-02)
    const actualizaciones = await Actualizacion
      .find(filtro)
      .sort({ fecha: 1 })
      .lean();

    // CA-07: si no hay actualizaciones, devolver estado vacío
    if (!actualizaciones.length) {
      return res.json({
        success: true,
        vacio: true,
        mensaje: 'Este participante no tiene actualizaciones registradas en el período seleccionado',
        gordoton: { _id: gordoton._id, nombre: gordoton.nombre },
        participante,
      });
    }

    // ── Series para gráficas (CA-02) ─────────────────────────
    const labels        = actualizaciones.map(a => formatFecha(a.fecha));
    const seriePeso     = actualizaciones.map(a => a.peso);
    const serieGrasa    = actualizaciones.map(a => a.grasa);
    const serieMusculo  = actualizaciones.map(a => a.musculo);
    const serieScoreG   = actualizaciones.map(a => a.scoreGrasa);
    const serieScoreM   = actualizaciones.map(a => a.scoreMusculo);
    const serieScoreR   = actualizaciones.map(a => a.scoreRecomp);

    // ── Deltas vs valores iniciales (CA-04) ──────────────────
    const ultima = actualizaciones[actualizaciones.length - 1];

    const deltaPeso    = delta(ultima.peso,    participante.pesoInicial);
    const deltaGrasa   = delta(ultima.grasa,   participante.grasaInicial);
    const deltaMusculo = delta(ultima.musculo,  participante.musculoInicial);

    const resumen = {
      deltaPeso:    { valor: deltaPeso,    direccion: direccion('peso',    deltaPeso)    },
      deltaGrasa:   { valor: deltaGrasa,   direccion: direccion('grasa',   deltaGrasa)   },
      deltaMusculo: { valor: deltaMusculo, direccion: direccion('musculo', deltaMusculo) },
      pesoInicial:    participante.pesoInicial,
      pesoActual:     ultima.peso,
      grasaInicial:   participante.grasaInicial,
      grasaActual:    ultima.grasa,
      musculoInicial: participante.musculoInicial,
      musculoActual:  ultima.musculo,
      ultimaFecha:    formatFecha(ultima.fecha),
    };

    res.json({
      success: true,
      vacio: false,
      gordoton:    { _id: gordoton._id, nombre: gordoton.nombre },
      participante,
      resumen,
      graficas: {
        labels,
        peso:        { serie: seriePeso },
        composicion: { grasa: serieGrasa, musculo: serieMusculo },
        scores:      { grasa: serieScoreG, musculo: serieScoreM, recomp: serieScoreR },
      },
      totalActualizaciones: actualizaciones.length,
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/:gordotonId/participantes
// Lista los participantes de un gordotón para el selector (CA-01)
// ─────────────────────────────────────────────────────────────
const listarParticipantesConActualizacion = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;

    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const participantes = await Participante
      .find({ gordotonId })
      .sort({ nombre: 1 })
      .lean();

    // Marcar cuáles tienen al menos una actualización
    const conAct = await Actualizacion.distinct('participanteId', { gordotonId });
    const conActSet = new Set(conAct.map(id => id.toString()));

    const resultado = participantes.map(p => ({
      ...p,
      tieneActualizaciones: conActSet.has(p._id.toString()),
    }));

    res.json({
      success: true,
      gordoton: { _id: gordoton._id, nombre: gordoton.nombre },
      total: resultado.length,
      data: resultado,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { obtenerDashboard, listarParticipantesConActualizacion };
