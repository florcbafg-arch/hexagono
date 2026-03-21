const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

// 🔐 REGISTRO
// 🔐 REGISTRO (MODO PRO SIN EMAIL)
router.post("/registro", async (req, res) => {
  const { email, password, nombre } = req.body;

  try {

    // 🔥 crear usuario SIN email confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const authUser = data.user;

    // guardar en tabla usuarios
    const { error: errorInsert } = await supabase
      .from("usuarios")
      .insert({
        auth_id: authUser.id,
        email: authUser.email,
        nombre: nombre || "Sin nombre",
        empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb23033d4",
        rol: "admin"
      });

    if (errorInsert) {
      return res.status(400).json({ error: errorInsert.message });
    }

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
    return res.json({ ok: false, error: error.message });
  }

  const authUser = data.user; // 🔥 ESTO ES CLAVE

  // 🔍 buscar en tabla usuarios
  const { data: userData, error: errorUser } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_id", authUser.id)
    .single();

  if (errorUser || !userData) {
    return res.json({ ok: false, error: "Usuario no encontrado" });
  }

 res.json({
  ok: true,
  token: data.session.access_token, // 💣 ESTO ES LO IMPORTANTE
  usuario: {
    id: userData.id,
    nombre: userData.nombre,
    rol: userData.rol,
    puesto_id: userData.puesto_id
  }
});
});
module.exports = router;