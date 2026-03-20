const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

router.post("/fichas", async (req, res) => {
  const { modelo_id, codigo, nombre, secciones } = req.body;

  if (
  !modelo_id ||
  !Array.isArray(secciones) ||
  secciones.length === 0
) {
  return res.status(400).json({
    ok: false,
    error: "Estructura de ficha inválida"
  });
}

  try {
    // 1️⃣ Crear ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .insert([{ modelo_id, codigo, nombre }])
.select()
.single()

    if (fichaError) throw fichaError;

    const ficha_id = ficha.id;

    // 2️⃣ Recorrer secciones
    for (const [index, seccion] of secciones.entries()) {
      const { data: sec, error: secError } = await supabase
        .from("fichas_secciones")
        .insert([
          {
            ficha_id,
            nombre: seccion.nombre,
            orden: index + 1
          }
        ])
        .select()
        .single();

      if (secError) throw secError;

      const seccion_id = sec.id;

      // 3️⃣ Recorrer piezas
      for (const pieza of seccion.piezas) {
        const { data: piezaData, error: piezaError } = await supabase
          .from("fichas_piezas")
          .insert([
            {
              seccion_id,
              nombre: pieza.nombre.toLowerCase().trim()
            }
          ])
          .select()
          .single();

        if (piezaError) throw piezaError;

        const pieza_id = piezaData.id;

        // 4️⃣ Materiales
        if (pieza.materiales && pieza.materiales.length > 0) {
          const materialesInsert = pieza.materiales.map(m => ({
            pieza_id,
            material: m.material,
            especificacion: m.especificacion || "",
            color: m.color || ""
          }));

          const { error: matError } = await supabase
            .from("fichas_materiales")
            .insert(materialesInsert);

          if (matError) throw matError;
        }

        // 5️⃣ Operaciones
        if (pieza.operaciones && pieza.operaciones.length > 0) {
          const operacionesInsert = pieza.operaciones.map(o => ({
            pieza_id,
            tipo: o.tipo,
            detalle: o.detalle || ""
          }));

          const { error: opError } = await supabase
            .from("fichas_operaciones")
            .insert(operacionesInsert);

          if (opError) throw opError;
        }
      }
    }

    res.json({
      ok: true,
      message: "Ficha creada correctamente",
      ficha_id
    });

  } catch (error) {
    console.error("Error creando ficha:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/fichas/:modelo_id", async (req, res) => {
  const { modelo_id } = req.params;

  try {
    // 1️⃣ Traer ficha
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("*")
      .eq("modelo_id", modelo_id)
      .single();

    if (fichaError) throw fichaError;

    // 2️⃣ Traer secciones
    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("*")
      .eq("ficha_id", ficha.id)
      .order("orden", { ascending: true });

    if (secError) throw secError;

    // 3️⃣ Traer piezas
    const { data: piezas, error: piezasError } = await supabase
      .from("fichas_piezas")
      .select("*")
      .in("seccion_id", secciones.map(s => s.id));

    if (piezasError) throw piezasError;

    // 4️⃣ Traer materiales
    const { data: materiales, error: matError } = await supabase
      .from("fichas_materiales")
      .select("*")
      .in("pieza_id", piezas.map(p => p.id));

    if (matError) throw matError;

    // 5️⃣ Traer operaciones
    const { data: operaciones, error: opError } = await supabase
      .from("fichas_operaciones")
      .select("*")
      .in("pieza_id", piezas.map(p => p.id));

    if (opError) throw opError;

    // 🧠 6️⃣ ARMAR ESTRUCTURA (CLAVE 🔥)

   const resultado = {
  ...ficha,
  secciones: secciones.map(seccion => ({
    ...seccion,
    piezas: piezas
      .filter(p => p.seccion_id === seccion.id) // 🔥 CLAVE
      .map(pieza => ({
        ...pieza,
        materiales: materiales.filter(m => m.pieza_id === pieza.id),
        operaciones: operaciones.filter(o => o.pieza_id === pieza.id)
      }))
  }))
}; 

    res.json({
      ok: true,
      ficha: resultado
    });

  } catch (error) {
    console.error("Error obteniendo ficha:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/fichas", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("fichas_tecnicas")
      .select(`
        id,
        modelo_id,
        codigo,
        nombre,
        modelos(nombre)
      `)
      .order("id", { ascending: false })

    if (error) throw error

    const resultado = data.map(f => ({
      ...f,
      modelo_nombre: f.modelos?.nombre || "-"
    }))

    res.json(resultado)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "error fichas" })
  }
})

module.exports = router;