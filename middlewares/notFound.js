// middlewares/notFound.js
// Captura cualquier ruta que no coincida con las definidas
// y devuelve un 404 estructurado.

const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = notFound;
