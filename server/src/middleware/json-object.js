export function requireJsonObject(req, res, next) {
  if (
    req.is('application/json') &&
    (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))
  ) {
    return res.status(400).json({ error: 'JSON request body must be an object' });
  }

  next();
}
