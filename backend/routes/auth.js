const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");
const crypto = require("crypto")

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

  // si por alguna razón no existe usuario sincronizado, crearlo bien
  if (!userData) {
    const { data: empresaNueva, error: errorEmpresa } = await supabase
      .from("empresas")
      .insert([
        {
          nombre: `${emailLimpio} - empresa`
        }
      ])
      .select()
      .single()

    if (errorEmpresa || !empresaNueva) {
      return res.status(500).json({ error: "No se pudo crear empresa para el usuario" })
    }

    const { error: errorInsertUsuario } = await supabase
      .from("usuarios")
      .insert([
        {
          auth_id: authUser.id,
          email: emailLimpio,
          nombre: "Usuario",
          empresa_id: empresaNueva.id,
          rol: "admin"
        }
      ])

    if (errorInsertUsuario) {
      return res.status(500).json({ error: errorInsertUsuario.message })
    }
  } else {
  let empresaIdFinal = userData.empresa_id

  if (!empresaIdFinal) {
    const { data: empresaNueva, error: errorEmpresa } = await supabase
      .from("empresas")
      .insert([
        {
          nombre: `${emailLimpio} - empresa`
        }
      ])
      .select()
      .single()

    if (errorEmpresa || !empresaNueva) {
      return res.status(500).json({ error: "No se pudo crear empresa para usuario existente" })
    }

    empresaIdFinal = empresaNueva.id
  }

  const { error: errorUpdateUsuario } = await supabase
    .from("usuarios")
    .update({
      auth_id: authUser.id,
      empresa_id: empresaIdFinal
    })
    .eq("email", emailLimpio)

  if (errorUpdateUsuario) {
    return res.status(500).json({ error: errorUpdateUsuario.message })
  }
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
module.exports = router;