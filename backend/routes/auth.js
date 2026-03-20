const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

// 🔐 REGISTRO
router.post("/registro", async (req, res) => {
  const { email, password } = req.body;

  // 1. Crear usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const authUser = data.user;

  // 2. Guardar en tu tabla usuarios
  const { error: errorInsert } = await supabase
    .from("usuarios")
    .insert({
      auth_id: authUser.id,
      email: authUser.email,
      empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb23033d4",
      rol: "admin"
    });

  if (errorInsert) {
    return res.status(400).json({ error: errorInsert.message });
  }

  res.json({ ok: true });
});

module.exports = router;