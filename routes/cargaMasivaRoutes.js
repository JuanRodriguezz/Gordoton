// routes/cargaMasivaRoutes.js
// HU-06 — Endpoints de carga masiva
// IMPORTANTE: las rutas estáticas (/plantilla, /detalle) deben ir
// ANTES de las rutas dinámicas (/:gordotonId, /:cargaId) para que
// Express no las capture como parámetros.

const express = require('express');
const router  = express.Router();
const {
  procesarCarga,
  listarCargas,
  detalleCarga,
  obtenerPlantilla,
} = require('../controllers/cargaMasivaController');

// ── Rutas estáticas PRIMERO ──────────────────────────────────────
// GET /api/carga-masiva/plantilla/:gordotonId
router.get('/plantilla/:gordotonId', obtenerPlantilla);

// GET /api/carga-masiva/detalle/:cargaId
router.get('/detalle/:cargaId', detalleCarga);

// ── Rutas dinámicas DESPUÉS ──────────────────────────────────────
// POST /api/carga-masiva/:gordotonId
router.post('/:gordotonId', procesarCarga);

// GET /api/carga-masiva/:gordotonId
router.get('/:gordotonId', listarCargas);

module.exports = router;
