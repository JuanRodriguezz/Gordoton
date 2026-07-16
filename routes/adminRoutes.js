// routes/adminRoutes.js
const express      = require('express');
const router       = express.Router();
const Participante = require('../models/Participante');
const Actualizacion= require('../models/Actualizacion');
 
// GET /api/admin/participantes
// Lista todos los participantes con su ID para saber qué ID usar
router.get('/participantes', async (req, res) => {
  try {
    const participantes = await Participante.find({}, 'nombre gordotonId pesoInicial musculoInicial grasaInicial').lean();
    res.json({ success: true, total: participantes.length, data: participantes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
 
// GET /api/admin/recalcular/:participanteId
// Recalcula los scores de todas las actualizaciones de un participante
router.get('/recalcular/:participanteId', async (req, res) => {
  try {
    const participante = await Participante.findById(req.params.participanteId);
    if (!participante) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
 
    const actualizaciones = await Actualizacion.find({
      participanteId: participante._id
    });
 
    if (!actualizaciones.length) {
      return res.json({
        success: false,
        mensaje: 'Este participante no tiene actualizaciones registradas',
        participante: participante.nombre,
      });
    }
 
    const resultados = [];
    for (const act of actualizaciones) {
      const scoreGrasa   = Math.round(((participante.grasaInicial   - act.grasa)  / participante.grasaInicial)   * 100);
      const scoreMusculo = Math.round(((act.musculo - participante.musculoInicial) / participante.musculoInicial) * 100);
      const scoreRecomp  = scoreGrasa + scoreMusculo;
 
      await Actualizacion.findByIdAndUpdate(act._id, {
        scoreGrasa, scoreMusculo, scoreRecomp
      });
 
      resultados.push({
        fecha:        act.fecha,
        peso:         act.peso,
        grasa:        act.grasa,
        musculo:      act.musculo,
        scoreGrasa,
        scoreMusculo,
        scoreRecomp,
      });
    }
 
    res.json({
      success:      true,
      participante: participante.nombre,
      valoresBase: {
        pesoInicial:    participante.pesoInicial,
        musculoInicial: participante.musculoInicial,
        grasaInicial:   participante.grasaInicial,
      },
      recalculadas: resultados.length,
      resultados,
    });
 
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
 
module.exports = router;