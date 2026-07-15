// controllers/rankingController.js
// HU-05 — Ranking por categoría y Gordotón.
//
// Endpoints:
//   GET /api/ranking/:gordotonId          → ranking completo (3 categorías)
//   GET /api/ranking/:gordotonId/grasa    → solo pérdida de grasa
//   GET /api/ranking/:gordotonId/musculo  → solo ganancia muscular
//   GET /api/ranking/:gordotonId/recomp   → solo recomposición corporal
//
// Regla de negocio (CA-03):
//   Se toma la ÚLTIMA actualización de cada participante.
//   Participantes sin actualizaciones NO aparecen en el ranking (CA-05).
//   El ranking se actualiza automáticamente al consultar (CA-06).

const Gordoton      = require('../models/Gordoton');
const Participante  = require('../models/Participante');
const Actualizacion = require('../models/Actualizacion');

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const formatFecha = (d) => {
  const f = new Date(d);
  return `${String(f.getDate()).padStart(2,'0')} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
};

// ─────────────────────────────────────────────────────────────
// Función central: obtiene la última actualización por participante
// y construye un ranking ordenado por el score especificado.
// ─────────────────────────────────────────────────────────────
const construirRanking = async (gordotonId, scoreField) => {

  // Agregación MongoDB:
  // 1. Filtrar por gordotón
  // 2. Ordenar por fecha DESC dentro de cada participante
  // 3. Tomar solo la primera (más reciente) por participante ($first)
  // 4. Ordenar el resultado por el score solicitado DESC (CA-03)
  const pipeline = [
    { $match: { gordotonId: require('mongoose').Types.ObjectId.createFromHexString(gordotonId) } },
    { $sort: { participanteId: 1, fecha: -1 } },
    {
      $group: {
        _id: '$participanteId',
        ultimaFecha:    { $first: '$fecha' },
        scoreGrasa:     { $first: '$scoreGrasa' },
        scoreMusculo:   { $first: '$scoreMusculo' },
        scoreRecomp:    { $first: '$scoreRecomp' },
        peso:           { $first: '$peso' },
        grasa:          { $first: '$grasa' },
        musculo:        { $first: '$musculo' },
      }
    },
    { $sort: { [scoreField]: -1 } },
  ];

  const resultados = await Actualizacion.aggregate(pipeline);

  // Obtener nombres de participantes en una sola query
  const ids = resultados.map(r => r._id);
  const participantes = await Participante.find({ _id: { $in: ids } }, 'nombre').lean();
  const partMap = participantes.reduce((acc, p) => {
    acc[p._id.toString()] = p.nombre;
    return acc;
  }, {});

  // Construir lista final con posición (#1, #2, ...)
  return resultados.map((r, i) => ({
    posicion:      i + 1,
    participanteId: r._id,
    nombre:         partMap[r._id.toString()] || 'Desconocido',
    scoreGrasa:     r.scoreGrasa,
    scoreMusculo:   r.scoreMusculo,
    scoreRecomp:    r.scoreRecomp,
    peso:           r.peso,
    grasa:          r.grasa,
    musculo:        r.musculo,
    ultimaFecha:    formatFecha(r.ultimaFecha),
    esPrimero:      i === 0,  // CA-04: resaltado visual del #1
  }));
};

// ─────────────────────────────────────────────────────────────
// GET /api/ranking/:gordotonId
// Devuelve las 3 tablas de ranking en un solo endpoint (CA-01)
// ─────────────────────────────────────────────────────────────
const obtenerRankingCompleto = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;

    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    // Construir los 3 rankings en paralelo
    const [rankingGrasa, rankingMusculo, rankingRecomp] = await Promise.all([
      construirRanking(gordotonId, 'scoreGrasa'),
      construirRanking(gordotonId, 'scoreMusculo'),
      construirRanking(gordotonId, 'scoreRecomp'),
    ]);

    res.json({
      success: true,
      gordoton: { _id: gordoton._id, nombre: gordoton.nombre, estado: gordoton.estado },
      rankings: {
        perdidaGrasa:         { titulo: 'Pérdida de grasa',        scoreKey: 'scoreGrasa',   data: rankingGrasa },
        gananciaMusculo:      { titulo: 'Ganancia muscular',        scoreKey: 'scoreMusculo', data: rankingMusculo },
        recomposicionCorporal:{ titulo: 'Recomposición corporal',   scoreKey: 'scoreRecomp',  data: rankingRecomp },
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/ranking/:gordotonId/:categoria
// Ranking de una categoría específica (grasa | musculo | recomp)
// ─────────────────────────────────────────────────────────────
const obtenerRankingCategoria = async (req, res, next) => {
  try {
    const { gordotonId, categoria } = req.params;

    const scoreMap = {
      grasa:   'scoreGrasa',
      musculo: 'scoreMusculo',
      recomp:  'scoreRecomp',
    };

    if (!scoreMap[categoria]) {
      const err = new Error('Categoría inválida. Valores aceptados: grasa, musculo, recomp');
      err.statusCode = 400;
      return next(err);
    }

    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const ranking = await construirRanking(gordotonId, scoreMap[categoria]);

    res.json({
      success: true,
      gordoton: { _id: gordoton._id, nombre: gordoton.nombre },
      categoria,
      scoreKey: scoreMap[categoria],
      total: ranking.length,
      data: ranking,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { obtenerRankingCompleto, obtenerRankingCategoria };
