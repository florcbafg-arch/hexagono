const { supabase } = require("../../config/supabase")

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

    const authUser = data.user

    const { data: usuarioDb, error: errorUsuario } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_id", authUser.id)
      .maybeSingle()

    if (errorUsuario) {
      console.error("Error buscando usuario DB:", errorUsuario)
      return res.status(500).json({ error: "Error validando usuario" })
    }

    if (!usuarioDb) {
      return res.status(401).json({ error: "Usuario no sincronizado" })
    }

    req.user = {
      id: usuarioDb.id,
      auth_id: authUser.id,
      email: authUser.email,
      nombre: usuarioDb.nombre,
      rol: usuarioDb.rol,
      puesto_id: usuarioDb.puesto_id,
      empresa_id: usuarioDb.empresa_id
    }

    next()
  } catch (err) {
    console.error("Error en authMiddleware:", err)
    return res.status(500).json({ error: "Error en autenticación" })
  }
}

module.exports = { authMiddleware }