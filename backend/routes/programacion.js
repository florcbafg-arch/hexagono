const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

// 📥 IMPORTAR PROGRAMACIÓN
router.post("/importar", async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No se recibieron items válidos" })
    }

    console.log("📥 Items recibidos:", items.length)
    console.log("📌 Primer item:", items[0])

    const dataInsert = items.map((item, index) => ({
      modelo: item.modelo ?? item.Modelo ?? null,
      cantidad: Number(item.cantidad ?? item.Cantidad ?? 0),
      fecha: item.fecha ?? item.Fecha ?? null,
      prioridad: item.prioridad ?? item.Prioridad ?? "normal",
      estado: "pendiente"
    }))

    // validar filas mínimas
    const invalidos = dataInsert.filter(
      (x) => !x.modelo || !x.cantidad || !x.fecha
    )

    if (invalidos.length > 0) {
      console.log("❌ Filas inválidas:", invalidos.slice(0, 5))
      return res.status(400).json({
        error: "Hay filas inválidas en el Excel",
        ejemplo: invalidos[0]
      })
    }

    // insertar en bloque
    const { error } = await supabase
      .from("programacion")
      .insert(dataInsert)

    if (error) {
      console.error("❌ Error Supabase al importar:", error)
      return res.status(500).json({
        error: error.message,
        detalle: error
      })
    }

    res.json({ ok: true, total: dataInsert.length })
  } catch (error) {
    console.error("❌ Error al importar programación:", error)
    res.status(500).json({
      error: error.message || "Error al importar programación"
    })
  }
})

module.exports = router