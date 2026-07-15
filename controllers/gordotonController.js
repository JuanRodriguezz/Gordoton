// controllers/gordotonController.js
// Implementa toda la lógica de negocio de HU-01.
//
// Endpoints cubiertos:
//   GET    /api/gordotones          → listar con participantes (CA-02)
//   POST   /api/gordotones          → crear nuevo (CA-01, CA-05, CA-07)
//   PUT    /api/gordotones/:id      → editar si estado=Activo (CA-03, CA-05, CA-07)
//   DELETE /api/gordotones/:id      → eliminar si sin dependencias (CA-04)
//   PATCH  /api/gordotones/:id/estado → cambiar estado manualmente

const Gordoton = require('../models/Gordoton');
const Participante = require('../models/Participante');
const Actualizacion = require('../models/Actualizacion');

// ─────────────────────────────────────────────
// GET /api/gordotones
// Lista todos los Gordotones con el conteo de participantes (CA-02)
// ─────────────────────────────────────────────
const listarGordotones = async (req, res, next) => {
  try {
    const gordotones = await Gordoton.find().sort({ createdAt: -1 }).lean();

    // Contar participantes por gordotón en una sola query agregada
    const conteos = await Participante.aggregate([
      { $group: { _id: '$gordotonId', total: { $sum: 1 } } },
    ]);

    const conteoMap = conteos.reduce((acc, c) => {
      acc[c._id.toString()] = c.total;
      return acc;
    }, {});

    const resultado = gordotones.map((g) => ({
      ...g,
      totalParticipantes: conteoMap[g._id.toString()] || 0,
    }));

    res.json({ success: true, total: resultado.length, data: resultado });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/gordotones/:id
// Obtiene un Gordotón por ID con sus participantes
// ─────────────────────────────────────────────
const obtenerGordoton = async (req, res, next) => {
  try {
    const gordoton = await Gordoton.findById(req.params.id).lean();

    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    const totalParticipantes = await Participante.countDocuments({
      gordotonId: req.params.id,
    });

    res.json({ success: true, data: { ...gordoton, totalParticipantes } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// POST /api/gordotones
// Crea un nuevo Gordotón (CA-01, CA-05, CA-06, CA-07)
// El estado inicial siempre es "Activo" (CA-01)
// CA-06: No hay restricción de un solo activo simultáneo
// ─────────────────────────────────────────────
const crearGordoton = async (req, res, next) => {
  try {
    const { nombre, descripcion, fechaInicio, fechaFin } = req.body;

    const gordoton = await Gordoton.create({
      nombre,
      descripcion,
      fechaInicio,
      fechaFin,
      estado: 'Activo', // siempre Activo al crear (CA-01)
    });

    res.status(201).json({
      success: true,
      message: 'Gordotón creado correctamente',
      data: gordoton,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// PUT /api/gordotones/:id
// Edita nombre, descripción y fechas (CA-03, CA-05, CA-07)
// Solo permite edición si el estado es "Activo"
// ─────────────────────────────────────────────
const editarGordoton = async (req, res, next) => {
  try {
    const gordoton = await Gordoton.findById(req.params.id);

    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    // CA-03: Solo editable si está Activo
    if (gordoton.estado !== 'Activo') {
      const err = new Error(
        'Solo se puede editar un Gordotón con estado "Activo"'
      );
      err.statusCode = 403;
      return next(err);
    }

    const { nombre, descripcion, fechaInicio, fechaFin } = req.body;

    // Aplicar solo los campos permitidos (estado no se edita aquí)
    if (nombre !== undefined) gordoton.nombre = nombre;
    if (descripcion !== undefined) gordoton.descripcion = descripcion;
    if (fechaInicio !== undefined) gordoton.fechaInicio = fechaInicio;
    if (fechaFin !== undefined) gordoton.fechaFin = fechaFin;

    // El pre-save del modelo valida CA-05 (fechas) y CA-07 (nombre único)
    await gordoton.save();

    res.json({
      success: true,
      message: 'Gordotón actualizado correctamente',
      data: gordoton,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/gordotones/:id
// Elimina solo si no tiene participantes ni actualizaciones (CA-04)
// ─────────────────────────────────────────────
const eliminarGordoton = async (req, res, next) => {
  try {
    const gordoton = await Gordoton.findById(req.params.id);

    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    // CA-04: Verificar dependencias antes de eliminar
    const [totalParticipantes, totalActualizaciones] = await Promise.all([
      Participante.countDocuments({ gordotonId: req.params.id }),
      Actualizacion.countDocuments({ gordotonId: req.params.id }),
    ]);

    if (totalParticipantes > 0 || totalActualizaciones > 0) {
      const err = new Error(
        `No se puede eliminar: este Gordotón tiene ${totalParticipantes} participante(s) y ${totalActualizaciones} actualización(es) registrada(s)`
      );
      err.statusCode = 409;
      return next(err);
    }

    await gordoton.deleteOne();

    res.json({
      success: true,
      message: 'Gordotón eliminado correctamente',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/gordotones/:id/estado
// Cambia el estado manualmente (Activo ↔ Finalizado)
// También puede automatizarse por fecha via un job externo
// ─────────────────────────────────────────────
const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;

    if (!['Activo', 'Finalizado'].includes(estado)) {
      const err = new Error('Estado inválido. Debe ser "Activo" o "Finalizado"');
      err.statusCode = 400;
      return next(err);
    }

    const gordoton = await Gordoton.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true, runValidators: true }
    );

    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }

    res.json({
      success: true,
      message: `Estado actualizado a "${estado}"`,
      data: gordoton,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarGordotones,
  obtenerGordoton,
  crearGordoton,
  editarGordoton,
  eliminarGordoton,
  cambiarEstado,
};
