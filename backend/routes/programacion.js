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
          modelo: 8,
          cantidad: prog.cantidad,
          estado: "pendiente",
          id_programacion: prog.id
        })
        .select()
        .single()

      if (errorOrden) throw errorOrden

      // 🔥 3. OBTENER CURVA DEL MODELO
const { data: curva, error: errorCurva } = await supabase
  .from("curvas_talles")
  .select("*")
  .eq("modelo_id", 8)

if (errorCurva) throw errorCurva

if (!curva || curva.length === 0) {
  throw new Error("El modelo no tiene curva de talles")
}

// 🔥 4. GENERAR DISTRIBUCIÓN
const tallesInsert = curva.map(c => ({
  orden_id: orden.id,
  talle: c.talle,
  cantidad: Math.round(prog.cantidad * c.porcentaje)
}))

// 🔥 5. INSERTAR TALLES
const { error: errorTalles } = await supabase
  .from("orden_talles")
  .insert(tallesInsert)

if (errorTalles) throw errorTalles

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