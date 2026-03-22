const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

// 🔐 REGISTRO
// 🔐 REGISTRO (MODO PRO SIN EMAIL)
router.post("/registro", async (req, res) => {
  const { email, password, nombre } = req.body;

  try {

    // 🔥 1. intentar registro normal
    let { data, error } = await supabase.auth.signUp({
      email,
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
        email: authUser.email,
        nombre: nombre || "Sin nombre",
        empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb23033d4",
        rol: "admin"
      }, {
        onConflict: "email"
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

// 🔥 buscar por auth_id
let { data: userData } = await supabase
  .from("usuarios")
  .select("*")
  .or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
  .maybeSingle();

  if (userData && !userData.auth_id) {
  await supabase
    .from("usuarios")
    .update({ auth_id: authUser.id })
    .eq("id", userData.id);
}

// 🔁 fallback por email
if (!userData) {
  const { data: userByEmail } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  userData = userByEmail;

  // 🔧 reparar si estaba roto
  if (userData) {
    await supabase
      .from("usuarios")
      .update({ auth_id: authUser.id })
      .eq("id", userData.id);
  }
}

if (!userData) {
  return res.json({ ok: false, error: "Usuario no encontrado" });
}

res.json({
  ok: true,
  token: data.session.access_token,
  usuario: {
    id: userData.id,
    nombre: userData.nombre,
    rol: userData.rol,
    puesto_id: userData.puesto_id
  }
});
});
module.exports = router;