// routes/rankingRoutes.js
// HU-05 — Ranking por categoría y Gordotón

const express = require('express');
const router  = express.Router();
const {
  obtenerRankingCompleto,
  obtenerRankingCategoria,
} = require('../controllers/rankingController');

// GET /api/ranking/:gordotonId
// Devuelve las 3 categorías en un solo request
router.get('/:gordotonId', obtenerRankingCompleto);

// GET /api/ranking/:gordotonId/:categoria  (grasa | musculo | recomp)
// Ranking de una sola categoría
router.get('/:gordotonId/:categoria', obtenerRankingCategoria);

module.exports = router;
