// routes/gordotonRoutes.js

const express = require('express');
const router = express.Router();
const {
  listarGordotones,
  obtenerGordoton,
  crearGordoton,
  editarGordoton,
  eliminarGordoton,
  cambiarEstado,
} = require('../controllers/gordotonController');

const {
  listarParticipantes,
  crearParticipante,
} = require('../controllers/participanteController');

const { listarActualizaciones } = require('../controllers/actualizacionController');

// ── Gordotones ──────────────────────────────────
// GET    /api/gordotones
router.get('/', listarGordotones);

// GET    /api/gordotones/:id
router.get('/:id', obtenerGordoton);

// POST   /api/gordotones
router.post('/', crearGordoton);

// PUT    /api/gordotones/:id
router.put('/:id', editarGordoton);

// DELETE /api/gordotones/:id
router.delete('/:id', eliminarGordoton);

// PATCH  /api/gordotones/:id/estado
router.patch('/:id/estado', cambiarEstado);

// ── Sub-rutas de participantes por gordotón ──────
// GET    /api/gordotones/:gordotonId/participantes
router.get('/:gordotonId/participantes', listarParticipantes);

// POST   /api/gordotones/:gordotonId/participantes
router.post('/:gordotonId/participantes', crearParticipante);

// ── Sub-rutas de actualizaciones por gordotón ───
// GET    /api/gordotones/:gordotonId/actualizaciones
router.get('/:gordotonId/actualizaciones', listarActualizaciones);

module.exports = router;
