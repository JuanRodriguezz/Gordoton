// routes/actualizacionRoutes.js

const express = require('express');
const router = express.Router();

const {
  crearActualizacion,
  eliminarActualizacion,
} = require('../controllers/actualizacionController');

// POST   /api/actualizaciones
router.post('/', crearActualizacion);

// DELETE /api/actualizaciones/:id
router.delete('/:id', eliminarActualizacion);

module.exports = router;
