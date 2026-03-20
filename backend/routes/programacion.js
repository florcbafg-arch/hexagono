const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

// 🚀 GENERAR PROGRAMACIÓN + ÓRDENES
router.post("/generar", async (req, res) => {

  try {

    const items = req.body

    for (const item of items) {

      // 1. GUARDAR PROGRAMACIÓN
      const { data: prog, error: errorProg } = await supabase
        .from("programacion")
        .insert({
          modelo: item.modelo,
          cantidad: item.cantidad,
          fecha: item.fecha,
          prioridad: item.prioridad
        })
        .select()
        .single()

      if (errorProg) throw errorProg

      // 2. CREAR ORDEN
      const { data: orden, error: errorOrden } = await supabase
        .from("ordenes")
        .insert({
          modelo: item.modelo,
          cantidad: item.cantidad,
          estado: "pendiente",
          id_programacion: prog.id
        })
        .select()
        .single()

      if (errorOrden) throw errorOrden

      // 3. CREAR PRODUCCIÓN AUTOMÁTICA 🔥
      await supabase.from("produccion").insert({
  orden_id: orden.id,
  modelo: orden.modelo
})

      // 4. MARCAR PROGRAMACIÓN COMO PROCESADA
      await supabase
        .from("programacion")
        .update({ estado: "procesado" })
        .eq("id", prog.id)

    }

    res.json({ ok: true })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al generar programación" })
  }

})

module.exports = router