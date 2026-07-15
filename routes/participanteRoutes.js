// routes/participanteRoutes.js

const express = require('express');
const router = express.Router();

const {
  obtenerParticipante,
  eliminarParticipante,
} = require('../controllers/participanteController');

const {
  historialParticipante,
} = require('../controllers/actualizacionController');

// GET    /api/participantes/:id
router.get('/:id', obtenerParticipante);

// DELETE /api/participantes/:id
router.delete('/:id', eliminarParticipante);

// GET    /api/participantes/:participanteId/actualizaciones
router.get('/:participanteId/actualizaciones', historialParticipante);

module.exports = router;
