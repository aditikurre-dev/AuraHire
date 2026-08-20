import jwt from "jsonwebtoken";

// Protects a route: requires a valid "Authorization: Bearer <token>" header.
// On success, attaches req.companyId / req.companyEmail from the token so
// downstream controllers never have to trust a companyId sent by the client.
export function protect(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Not authorized. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.companyId = decoded.companyId;
    req.companyEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}
