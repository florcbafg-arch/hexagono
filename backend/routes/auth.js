const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");
const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const { crearTokenOperario } = require("../security/operarioToken")

// 🔐 REGISTRO
router.post("/registro", async (req, res) => {
  const { email, password, nombre } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email y password requeridos" })
  }

  const emailLimpio = email.trim().toLowerCase()
  const nombreLimpio = nombre?.trim() || "Usuario"

  try {
    let { data, error } = await supabase.auth.signUp({
      email: emailLimpio,
      password
    })

    if (error) {
  if (error.message.includes("already registered")) {
    const loginRes = await supabase.auth.signInWithPassword({
      email: emailLimpio,
      password
    })

    if (loginRes.error) {
      return res.status(400).json({
        error: "Usuario ya existe, pero contraseña incorrecta"
      })
    }

    data = loginRes.data
  } else {
    return res.status(400).json({ error: error.message })
  }
}

    const authUser = data.user
    if (!authUser) {
      return res.status(500).json({ error: "No se pudo crear usuario auth" })
    }

    // 1. buscar si ya existe usuario sincronizado
    let { data: usuarioExistente, error: errorUsuarioExistente } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_id", authUser.id)
      .maybeSingle()

    if (errorUsuarioExistente) {
      return res.status(500).json({ error: errorUsuarioExistente.message })
    }

    let empresaIdFinal = usuarioExistente?.empresa_id || null

    // 2. si no tiene empresa, crear empresa nueva
    if (!empresaIdFinal) {
      const nuevaEmpresaId = crypto.randomUUID()

const { data: empresaNueva, error: errorEmpresa } = await supabase
  .from("empresas")
  .insert([
    {
      id: nuevaEmpresaId,
      nombre: `${nombreLimpio} - empresa`
    }
  ])
  .select()
  .single()

      if (errorEmpresa || !empresaNueva) {
  console.log("❌ ERROR CREANDO EMPRESA:", errorEmpresa)
  return res.status(500).json({
    error: "No se pudo crear la empresa",
    detalle: errorEmpresa?.message || "Sin detalle"
  })
}

      empresaIdFinal = empresaNueva.id
    }

    // 3. sincronizar usuario con su empresa real
    const { error: errorUpsertUsuario } = await supabase
      .from("usuarios")
      .upsert({
        auth_id: authUser.id,
        email: emailLimpio,
        nombre: nombreLimpio,
        empresa_id: empresaIdFinal,
        rol: "admin"
      }, {
        onConflict: "auth_id"
      })

    if (errorUpsertUsuario) {
      console.log("❌ ERROR UPSERT USUARIO:", errorUpsertUsuario)
      return res.status(500).json({ error: errorUpsertUsuario.message })
    }

    res.json({
      ok: true,
      empresa_id: empresaIdFinal
    })

  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Error en registro" })
  }
})
// 🔐 LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
  return res.status(400).json({ ok: false, error: "Email y password requeridos" })
}

  const emailLimpio = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailLimpio,
    password
  })

  if (error) {
    return res.json({ ok: false, error: "Usuario o contraseña incorrectos" })
  }

  const authUser = data.user
  if (!authUser) {
    return res.status(500).json({ ok: false, error: "Auth inválido" })
  }

  let { data: userData } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle()

  if (!userData) {
    const { data: userByEmail } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", emailLimpio)
      .maybeSingle()

    userData = userByEmail
  }

  // El login nunca crea ni reasigna empresas. El usuario debe estar provisionado.
  if (!userData) {
    return res.status(403).json({ ok: false, error: "Usuario no provisionado en Hexaflow" })
  }

  if (userData.activo === false) {
    return res.status(403).json({ ok: false, error: "Usuario inactivo" })
  }

  if (!userData.empresa_id) {
    return res.status(403).json({ ok: false, error: "Usuario sin empresa asignada" })
  }

  if (!userData.auth_id) {
    const { error: syncError } = await supabase
      .from("usuarios")
      .update({ auth_id: authUser.id })
      .eq("id", userData.id)
      .is("auth_id", null)

    if (syncError) {
      return res.status(500).json({ ok: false, error: "No se pudo sincronizar el usuario" })
    }
  } else if (userData.auth_id !== authUser.id) {
    return res.status(403).json({ ok: false, error: "Usuario no provisionado para esta identidad" })
  }

  const { data: finalUser, error: errorFinalUser } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", emailLimpio)
    .single()

  if (errorFinalUser || !finalUser) {
    return res.json({ ok: false, error: "Usuario no encontrado" })
  }

  res.json({
    ok: true,
    token: data.session.access_token,
    usuario: {
      id: finalUser.id,
      nombre: finalUser.nombre,
      rol: finalUser.rol,
      puesto_id: finalUser.puesto_id,
      empresa_id: finalUser.empresa_id
    }
  })
})

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null

    if (!token) {
      return res.status(401).json({ error: "Sin token" })
    }

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
      return res.status(401).json({ error: "Token inválido" })
    }

    const authUser = data.user

    const { data: usuario, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_id", authUser.id)
      .single()

    if (userError || !usuario) {
      return res.status(401).json({ error: "Usuario no sincronizado" })
    }

    return res.json({
      id: usuario.id,
      auth_id: usuario.auth_id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      puesto_id: usuario.puesto_id,
      empresa_id: usuario.empresa_id,
      tipo_login: usuario.tipo_login,
      activo: usuario.activo
    })
  } catch (err) {
    console.error("Error en /api/auth/me:", err)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
})

// 🔐 RECUPERACIÓN DE CONTRASEÑA
router.post("/recovery-password", async (req, res) => {
  try {
    const { access_token, password } = req.body
    if (!access_token || !password || password.length < 8) {
      return res.status(400).json({ ok: false, error: "Token y contraseña de al menos 8 caracteres requeridos" })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(access_token)
    if (userError || !userData?.user) {
      return res.status(401).json({ ok: false, error: "El enlace de recuperación es inválido o venció" })
    }

    const { error } = await supabase.auth.admin.updateUserById(userData.user.id, { password })
    if (error) throw error

    return res.json({ ok: true })
  } catch (err) {
    console.error("Error recuperando contraseña:", err)
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la contraseña" })
  }
})

// 🔐 LOGIN OPERARIO
router.post("/login-operario", async (req, res) => {
  try {
    const { codigo_acceso, pin } = req.body

    if (!codigo_acceso || !pin) {
      return res.status(400).json({
        ok: false,
        error: "Código y PIN requeridos"
      })
    }

    const codigoLimpio = codigo_acceso.trim().toUpperCase()

    const { data: operario, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("codigo_acceso", codigoLimpio)
      .eq("tipo_login", "operario")
      .eq("activo", true)
      .maybeSingle()

    if (error || !operario) {
      return res.json({
        ok: false,
        error: "Operario no encontrado"
      })
    }

    const pinOk = await bcrypt.compare(pin, operario.pin_hash || "")

    if (!pinOk) {
      return res.json({
        ok: false,
        error: "Código o PIN incorrectos"
      })
    }

    if (!operario.empresa_id || !operario.puesto_id) {
      return res.status(403).json({ ok: false, error: "Operario sin empresa o puesto asignado" })
    }

    const tokenOperario = crearTokenOperario(operario)

    return res.json({
      ok: true,
      token: tokenOperario,
      usuario: {
        id: operario.id,
        nombre: operario.nombre,
        rol: operario.rol,
        puesto_id: operario.puesto_id,
        empresa_id: operario.empresa_id,
        tipo_login: operario.tipo_login,
        codigo_acceso: operario.codigo_acceso
      }
    })

  } catch (err) {
    console.error("Error login operario:", err)
    return res.status(500).json({
      ok: false,
      error: "Error en login operario"
    })
  }
})

module.exports = router;