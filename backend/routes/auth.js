const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

// 🔐 REGISTRO
// 🔐 REGISTRO (MODO PRO SIN EMAIL)
router.post("/registro", async (req, res) => {
  const { email, password, nombre } = req.body;

  // 🔒 VALIDACIÓN BACKEND (CRÍTICA)
if (!email || !password) {
  return res.status(400).json({ error: "Email y password requeridos" });
}

// 🧠 NORMALIZACIÓN (PRO)
const emailLimpio = email.trim().toLowerCase();
const nombreLimpio = nombre?.trim() || "Usuario";

  try {

    // 🔥 1. intentar registro normal
     let { data, error } = await supabase.auth.signUp({
  email: emailLimpio,
  password
});

    // 🔁 2. si ya existe → intentar login automático
    if (error && error.message.includes("already registered")) {

      const loginRes = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginRes.error) {
        return res.status(400).json({ error: "Usuario ya existe, pero contraseña incorrecta" });
      }

      data = loginRes.data;
    }

    const authUser = data.user;
    console.log("🔥 AUTH USER:", authUser);
console.log("🔥 EMAIL INPUT:", email);

    // 🔥 3. sincronizar SIEMPRE tabla usuarios
    await supabase
      .from("usuarios")
      .upsert({
        auth_id: authUser.id,
        email: emailLimpio,
        nombre: nombreLimpio,
        empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb23033d4",
      }, {
       onConflict: "auth_id"
      });

    res.json({ ok: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error en registro" });
  }
});

// 🔐 LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // 🔐 login con supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }

  const authUser = data.user;

  // 🔍 1. buscar usuario en tabla
  let { data: userData } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  // 🔁 2. fallback por email
  if (!userData) {
    const { data: userByEmail } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    userData = userByEmail;
  }

  // 🔥 3. upsert SIEMPRE (ahora sí seguro)
  const { error: insertError } = await supabase
    .from("usuarios")
    .upsert({
      auth_id: authUser.id,
      email: email.trim().toLowerCase(),
      nombre: userData?.nombre || "Usuario",
      empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb23033d4",
      rol: "admin"
    }, {
      onConflict: "email"
    });

  if (insertError) {
    console.log("❌ ERROR INSERT USUARIO:", insertError);
    return res.status(500).json({ error: insertError.message });
  }

  // 🔁 4. volver a buscar ya actualizado
  const { data: finalUser } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .single();

  if (!finalUser) {
    return res.json({ ok: false, error: "Usuario no encontrado" });
  }

  // ✅ 5. respuesta final
  res.json({
    ok: true,
    token: data.session.access_token,
    usuario: {
      id: finalUser.id,
      nombre: finalUser.nombre,
      rol: finalUser.rol,
      puesto_id: finalUser.puesto_id
    }
  });
});
module.exports = router;