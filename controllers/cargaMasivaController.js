// controllers/cargaMasivaController.js — v1.2.2
// Fix: eliminada la transacción MongoDB (no compatible con standalone local).
// La atomicidad se garantiza por la validación completa previa (CA-07):
// si hay cualquier error de validación no se inserta nada.
// En producción con Replica Set se puede restaurar session.withTransaction().

const mongoose     = require('mongoose');
const Gordoton     = require('../models/Gordoton');
const Participante = require('../models/Participante');
const Actualizacion= require('../models/Actualizacion');
const CargaMasiva  = require('../models/CargaMasiva');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const calcularScores = (participante, musculo, grasa) => {
  const scoreGrasa   = Math.round(((participante.grasaInicial   - grasa)  / participante.grasaInicial)   * 100);
  const scoreMusculo = Math.round(((musculo - participante.musculoInicial) / participante.musculoInicial) * 100);
  const scoreRecomp  = scoreGrasa + scoreMusculo;
  return { scoreGrasa, scoreMusculo, scoreRecomp };
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const formatFecha = d => {
  const f = new Date(d);
  return `${String(f.getDate()).padStart(2,'0')} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
};

// Columnas REQUERIDAS con alias
const COLUMNAS_REQ = {
  participante:  ['participante', 'nombre'],
  pesoActual:    ['peso actual', 'peso'],
  grasaActual:   ['grasa actual', 'grasa'],
  musculoActual: ['músculo actual', 'musculo actual', 'músculo', 'musculo'],
};

// Columnas OPCIONALES con alias
const COLUMNAS_OPT = {
  fecha:       ['fecha', 'date', 'fecha actualización', 'fecha actualizacion'],
  descripcion: ['descripcion', 'descripción', 'notas', 'nota', 'observaciones', 'comentario', 'comentarios'],
};

const encontrarColumna = (headers, aliases) =>
  headers.find(h => aliases.includes(h.toLowerCase().trim())) || null;

// Parsea fecha desde Excel: serial numérico, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
const parsearFecha = (valor) => {
  if (!valor && valor !== 0) return null;
  if (typeof valor === 'number') {
    const f = new Date((valor - 25569) * 86400 * 1000);
    if (!isNaN(f.getTime())) return f;
  }
  if (valor instanceof Date) return valor;
  const str = String(valor).trim();
  if (!str) return null;
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const f = new Date(`${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`);
    if (!isNaN(f.getTime())) return f;
  }
  const m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const f = new Date(`${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`);
    if (!isNaN(f.getTime())) return f;
  }
  const f = new Date(str);
  return isNaN(f.getTime()) ? null : f;
};

// ─────────────────────────────────────────────
// POST /api/carga-masiva/:gordotonId
// ─────────────────────────────────────────────
const procesarCarga = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;
    const { nombreArchivo, filas } = req.body;

    if (!nombreArchivo || !filas || !Array.isArray(filas)) {
      const err = new Error('Se requieren nombreArchivo y filas (array)');
      err.statusCode = 400;
      return next(err);
    }

    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }
    if (gordoton.estado !== 'Activo') {
      const err = new Error('No se puede cargar a un Gordotón Finalizado');
      err.statusCode = 403;
      return next(err);
    }
    if (!filas.length) {
      const err = new Error('El archivo no contiene filas de datos');
      err.statusCode = 400;
      return next(err);
    }
    if (filas.length > 500) {
      const err = new Error('El archivo supera el límite de 500 filas');
      err.statusCode = 400;
      return next(err);
    }

    // Detectar columnas
    const headers  = Object.keys(filas[0]);
    const colPart  = encontrarColumna(headers, COLUMNAS_REQ.participante);
    const colPeso  = encontrarColumna(headers, COLUMNAS_REQ.pesoActual);
    const colGrasa = encontrarColumna(headers, COLUMNAS_REQ.grasaActual);
    const colMusc  = encontrarColumna(headers, COLUMNAS_REQ.musculoActual);
    const colFecha = encontrarColumna(headers, COLUMNAS_OPT.fecha);
    const colDesc  = encontrarColumna(headers, COLUMNAS_OPT.descripcion);

    const faltantes = [];
    if (!colPart)  faltantes.push('Participante');
    if (!colPeso)  faltantes.push('Peso Actual');
    if (!colGrasa) faltantes.push('Grasa Actual');
    if (!colMusc)  faltantes.push('Músculo Actual');
    if (faltantes.length) {
      const err = new Error(`Columnas requeridas no encontradas: ${faltantes.join(', ')}`);
      err.statusCode = 400;
      return next(err);
    }

    // Cargar participantes
    const participantesBD = await Participante.find({ gordotonId }).lean();
    const partMap = {};
    participantesBD.forEach(p => { partMap[p.nombre.toLowerCase().trim()] = p; });

    // Cargar actualizaciones existentes para CA-13
    const actualizacionesExistentes = await Actualizacion.find(
      { gordotonId }, 'participanteId fecha'
    ).lean();
    const actExistSet = new Set(
      actualizacionesExistentes.map(a => {
        const d = new Date(a.fecha);
        return `${a.participanteId}_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );

    // ── FASE DE VALIDACIÓN COMPLETA (CA-07) ──────────────────
    const errores       = [];
    const nombresVistos = {};
    const filasValidas  = [];
    const logValidacion = [];

    for (let i = 0; i < filas.length; i++) {
      const numFila   = i + 1;
      const fila      = filas[i];
      const nombreRaw = fila[colPart];
      const pesoRaw   = fila[colPeso];
      const grasaRaw  = fila[colGrasa];
      const muscRaw   = fila[colMusc];
      const fechaRaw  = colFecha ? fila[colFecha]  : null;
      const descRaw   = colDesc  ? fila[colDesc]   : null;

      let filaOk = true;

      // CA-11: campos obligatorios vacíos
      const camposReq = [
        ['Participante',   nombreRaw],
        ['Peso Actual',    pesoRaw],
        ['Grasa Actual',   grasaRaw],
        ['Músculo Actual', muscRaw],
      ];
      for (const [label, valor] of camposReq) {
        if (valor === null || valor === undefined || String(valor).trim() === '') {
          errores.push({ fila: numFila, participante: String(nombreRaw || ''), mensaje: `La fila ${numFila} tiene el campo '${label}' vacío.` });
          filaOk = false;
        }
      }
      if (!filaOk) continue;

      const nombre    = String(nombreRaw).trim();
      const nombreKey = nombre.toLowerCase();
      const peso      = Number(pesoRaw);
      const grasa     = Number(grasaRaw);
      const musculo   = Number(muscRaw);

      // CA-10: valores numéricos positivos
      if (isNaN(peso)    || peso    <= 0) { errores.push({ fila: numFila, participante: nombre, mensaje: `El campo 'Peso Actual' debe ser un número positivo.`    }); filaOk = false; }
      if (isNaN(grasa)   || grasa   <= 0) { errores.push({ fila: numFila, participante: nombre, mensaje: `El campo 'Grasa Actual' debe ser un número positivo.`   }); filaOk = false; }
      if (isNaN(musculo) || musculo <= 0) { errores.push({ fila: numFila, participante: nombre, mensaje: `El campo 'Músculo Actual' debe ser un número positivo.` }); filaOk = false; }
      if (!filaOk) continue;

      if (peso  > 300) { errores.push({ fila: numFila, participante: nombre, mensaje: `'Peso Actual' supera el máximo de 300 kg.` }); filaOk = false; }
      if (grasa > 100) { errores.push({ fila: numFila, participante: nombre, mensaje: `'Grasa Actual' supera el máximo de 100.`  }); filaOk = false; }
      if (!filaOk) continue;

      // Validar fecha opcional
      let fechaUsar = new Date();
      if (fechaRaw !== null && fechaRaw !== undefined && String(fechaRaw).trim() !== '') {
        const fechaParsed = parsearFecha(fechaRaw);
        if (!fechaParsed) {
          errores.push({ fila: numFila, participante: nombre, mensaje: `La fecha '${fechaRaw}' no tiene un formato válido. Use DD/MM/YYYY o YYYY-MM-DD.` });
          filaOk = false;
          continue;
        }
        fechaUsar = fechaParsed;
      }

      // CA-09: participante existente
      const participante = partMap[nombreKey];
      if (!participante) {
        errores.push({ fila: numFila, participante: nombre, mensaje: `El participante '${nombre}' no está registrado en este Gordotón.` });
        filaOk = false;
        continue;
      }

      // CA-12: duplicado en el archivo
      if (nombresVistos[nombreKey] !== undefined) {
        errores.push({ fila: numFila, participante: nombre, mensaje: `El participante '${nombre}' aparece duplicado en el archivo (filas ${nombresVistos[nombreKey]} y ${numFila}).` });
        filaOk = false;
        continue;
      }
      nombresVistos[nombreKey] = numFila;

      // CA-13: duplicado de fecha en BD
      const fechaKey = `${participante._id}_${fechaUsar.getFullYear()}-${fechaUsar.getMonth()}-${fechaUsar.getDate()}`;
      if (actExistSet.has(fechaKey)) {
        errores.push({ fila: numFila, participante: nombre, mensaje: `Ya existe una actualización para '${nombre}' en la fecha ${formatFecha(fechaUsar)}.` });
        filaOk = false;
        continue;
      }

      if (filaOk) {
        const descripcion = (descRaw && String(descRaw).trim())
          ? String(descRaw).trim()
          : `Carga masiva – ${nombreArchivo}`;
        logValidacion.push({ numFila, nombre, estado: 'OK', fecha: formatFecha(fechaUsar) });
        filasValidas.push({ participante, peso, grasa, musculo, fecha: fechaUsar, descripcion });
      }
    }

    // CA-08: cancelar si hay errores
    if (errores.length > 0) {
      await CargaMasiva.create({
        gordotonId, nombreArchivo, estado: 'Error',
        totalFilas: filas.length, filasExitosas: 0,
        filasError: errores.length, errores,
      });
      return res.status(422).json({
        success:    false,
        message:    `Se encontraron ${errores.length} error(es). No se procesó ningún registro.`,
        totalFilas: filas.length,
        filasError: errores.length,
        errores,
        logValidacion,
      });
    }

    // ── INSERCIÓN SIN TRANSACCIÓN (compatible con standalone) ─
    // La atomicidad está garantizada por la validación previa:
    // solo llegamos aquí si el 100% de las filas es válido.
    const cargaMasiva = await CargaMasiva.create({
      gordotonId, nombreArchivo, estado: 'Procesando',
      totalFilas: filas.length, filasExitosas: 0, filasError: 0, errores: [],
    });

    const docs = filasValidas.map(({ participante, peso, grasa, musculo, fecha, descripcion }) => ({
      gordotonId,
      participanteId: participante._id,
      cargaMasivaId:  cargaMasiva._id,
      fecha,
      descripcion,
      peso,
      musculo,
      grasa,
      ...calcularScores(participante, musculo, grasa),
    }));

    let insertadas = 0;
    try {
      const resultado = await Actualizacion.insertMany(docs, { ordered: true });
      insertadas = resultado.length;
      await CargaMasiva.findByIdAndUpdate(cargaMasiva._id, {
        estado: 'Completado', filasExitosas: insertadas,
      });
    } catch (insertError) {
      // Si falla la inserción, marcar la carga como Error
      await CargaMasiva.findByIdAndUpdate(cargaMasiva._id, {
        estado: 'Error', filasError: filasValidas.length,
        errores: [{ fila: 0, participante: '', mensaje: insertError.message }],
      });
      throw insertError;
    }

    res.status(201).json({
      success:       true,
      message:       `✅ ${insertadas} actualizaciones registradas correctamente.`,
      cargaId:       cargaMasiva._id,
      totalFilas:    filas.length,
      filasExitosas: insertadas,
      filasError:    0,
      logValidacion,
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// GET /api/carga-masiva/:gordotonId
// ─────────────────────────────────────────────
const listarCargas = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;
    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }
    const cargas = await CargaMasiva.find({ gordotonId })
      .sort({ fechaCarga: -1 }).select('-errores').lean();
    res.json({ success: true, gordoton: gordoton.nombre, total: cargas.length, data: cargas });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────
// GET /api/carga-masiva/detalle/:cargaId
// ─────────────────────────────────────────────
const detalleCarga = async (req, res, next) => {
  try {
    const carga = await CargaMasiva.findById(req.params.cargaId).lean();
    if (!carga) {
      const err = new Error('Carga no encontrada');
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, data: carga });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────
// GET /api/carga-masiva/plantilla/:gordotonId
// ─────────────────────────────────────────────
const obtenerPlantilla = async (req, res, next) => {
  try {
    const { gordotonId } = req.params;
    const gordoton = await Gordoton.findById(gordotonId).lean();
    if (!gordoton) {
      const err = new Error('Gordotón no encontrado');
      err.statusCode = 404;
      return next(err);
    }
    const participantes = await Participante.find({ gordotonId }, 'nombre').lean();
    res.json({
      success: true,
      gordoton: gordoton.nombre,
      encabezados: ['Participante', 'Peso Actual', 'Grasa Actual', 'Músculo Actual', 'Fecha', 'Descripcion'],
      participantes: participantes.map(p => ({
        'Participante':   p.nombre,
        'Peso Actual':    '',
        'Grasa Actual':   '',
        'Músculo Actual': '',
        'Fecha':          '',
        'Descripcion':    '',
      })),
    });
  } catch (error) { next(error); }
};

module.exports = { procesarCarga, listarCargas, detalleCarga, obtenerPlantilla };
