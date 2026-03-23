const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

// 📊 OBTENER PROGRAMACION 🔥🔥🔥
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("programacion")
      .select("*")
      .order("fecha", { ascending: false })

    if (error) {
      console.error("ERROR SUPABASE:", error)
      return res.status(500).json({ error: "Error al obtener programación" })
    }

    res.json(data)
  } catch (err) {
    console.error("ERROR SERVER:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// 📥 IMPORTAR PROGRAMACIÓN
router.post("/importar", async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No se recibieron items válidos" })
    }

    console.log("📥 Items recibidos:", items.length)
    console.log("📌 Primer item:", items[0])

    const dataInsert = items.map((item) => ({
      modelo: item.modelo ?? item.Modelo ?? null,
      cantidad: Number(item.cantidad ?? item.Cantidad ?? 0),
      fecha: item.fecha ?? item.Fecha ?? null,
      prioridad: item.prioridad ?? item.Prioridad ?? "normal",
      estado: "pendiente"
    }))

    const validos = dataInsert.filter(
      (x) => x.modelo && x.cantidad > 0 && x.fecha
    )

    if (validos.length === 0) {
      return res.status(400).json({
        error: "No hay datos válidos para importar"
      })
    }

    console.log("⚠️ Filas ignoradas:", dataInsert.length - validos.length)

    const chunkSize = 200

    for (let i = 0; i < validos.length; i += chunkSize) {
      const chunk = validos.slice(i, i + chunkSize)

      console.log(`🚀 Insertando bloque ${i} - ${i + chunk.length}`)

      const { error } = await supabase
        .from("programacion")
        .insert(chunk)

      if (error) {
        console.error("❌ Error en bloque:", error)
        return res.status(500).json({
          error: error.message,
          bloque: i
        })
      }
    }

    res.json({ ok: true, total: validos.length })
  } catch (error) {
    console.error("❌ Error al importar programación:", error)
    res.status(500).json({
      error: error.message || "Error al importar programación"
    })
  }
})

module.exports = router