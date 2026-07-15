// routes/dashboardRoutes.js
// HU-04 — Dashboard de avance por participante

const express = require('express');
const router  = express.Router();
const {
  obtenerDashboard,
  listarParticipantesConActualizacion,
} = require('../controllers/dashboardController');

// GET /api/dashboard/:gordotonId/participantes
// Lista participantes del gordotón para el selector (CA-01)
router.get('/:gordotonId/participantes', listarParticipantesConActualizacion);

// GET /api/dashboard/:gordotonId/:participanteId
// ?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
// Datos completos del dashboard (CA-01 al CA-08)
router.get('/:gordotonId/:participanteId', obtenerDashboard);

module.exports = router;
