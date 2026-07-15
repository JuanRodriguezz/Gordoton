// middlewares/errorHandler.js
// Centraliza el manejo de errores para toda la API.
// Distingue entre errores de Mongoose (validación, duplicados)
// y errores genéricos del servidor.

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let errors = null;

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = 'Error de validación';
  }

  // Clave duplicada — índice único violado (CA-07: nombre único)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Ya existe un registro con ese valor en el campo "${field}"`;
  }

  // ObjectId inválido (ID mal formado en la URL)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `ID inválido: ${err.value}`;
  }

  // Error de validación pre-save (fechas, reglas de negocio)
  if (err.name === 'Error' && statusCode === 500) {
    statusCode = 400;
  }

  const response = {
    success: false,
    message,
  };

  if (errors) response.errors = errors;

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
