const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado" })
    }

    const token = authHeader.split(" ")[1]

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({ error: "Token inválido" })
    }

    req.user = data.user

    next()
  } catch (err) {
    console.error("Error en authMiddleware:", err)
    return res.status(500).json({ error: "Error en autenticación" })
  }
}

module.exports = { authMiddleware }