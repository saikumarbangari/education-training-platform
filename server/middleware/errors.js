export function notFound(request, response) {
  response.status(404).json({ message: "API route not found." });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return response
      .status(400)
      .json({ message: "Request body contains invalid JSON." });
  }
  if (error.type === "entity.too.large") {
    return response.status(413).json({ message: "Request body is too large." });
  }
  // Avoid logging query parameters, passwords or device coordinates.
  console.error("API request failed", { name: error.name, code: error.code });
  response
    .status(500)
    .json({ message: "The server could not complete this request." });
}
