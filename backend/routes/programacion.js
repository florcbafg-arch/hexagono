const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

// 📥 IMPORTAR PROGRAMACIÓN (STAGING)
router.post("/importar", async (req, res) => {

  try {

    const items = req.body

    for (const item of items) {

      const { error } = await supabase
        .from("programacion")
        .insert({
          modelo: item.modelo, // luego lo cambiamos a modelo_id
          cantidad: item.cantidad,
          fecha: item.fecha,
          prioridad: item.prioridad,
          estado: "pendiente"
        })

      if (error) throw error
    }

    res.json({ ok: true })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al importar programación" })
  }

})

// 🚀 GENERAR ÓRDENES DESDE PROGRAMACIÓN
router.post("/generar", async (req, res) => {

  try {

    // 1. TRAER SOLO PROGRAMACIÓN PENDIENTE
    const { data: pendientes, error } = await supabase
      .from("programacion")
      .select("*")
      .eq("estado", "pendiente")

    if (error) throw error

    for (const prog of pendientes) {

      // 2. CREAR ORDEN
      const { data: orden, error: errorOrden } = await supabase
        .from("ordenes")
        .insert({
          modelo: prog.modelo,
          cantidad: prog.cantidad,
          estado: "pendiente",
          id_programacion: prog.id
        })
        .select()
        .single()

      if (errorOrden) throw errorOrden

      // 3. CREAR ORDEN_TALLES (BASE)
      const { error: errorTalle } = await supabase
        .from("orden_talles")
        .insert([
          {
            orden_id: orden.id,
            talle: 40,
            cantidad: prog.cantidad
          }
        ])

      if (errorTalle) throw errorTalle

      // 4. MARCAR COMO PROCESADO
      await supabase
        .from("programacion")
        .update({ estado: "procesado" })
        .eq("id", prog.id)

    }

    res.json({ ok: true })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error generando órdenes" })
  }

})

module.exports = router