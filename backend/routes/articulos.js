const express = require("express")
const router = express.Router()
const { supabase } = require("../../config/supabase")

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

async function getModeloPropio(modeloId, empresaId) {
  const { data, error } = await supabase
    .from("modelos")
    .select("id, empresa_id, marca, nombre")
    .eq("id", modeloId)
    .eq("empresa_id", empresaId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Maestro Modelo + Artículos. empresa_id siempre proviene de req.user.
router.get("/", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const { data, error } = await supabase
      .from("articulos")
      .select("id, modelo_id, codigo, color, activo, created_at, updated_at, modelos(id, marca, nombre)")
      .eq("empresa_id", empresaId)
      .order("codigo", { ascending: true })
    if (error) throw error
    return res.json(data)
  } catch (err) {
    console.error("Error listando artículos:", err)
    return res.status(500).json({ error: "Error listando artículos" })
  }
})

router.get("/modelo/:modeloId", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const modelo = await getModeloPropio(req.params.modeloId, empresaId)
    if (!modelo) return res.status(404).json({ error: "Modelo no encontrado" })

    const { data, error } = await supabase
      .from("articulos")
      .select("id, modelo_id, codigo, color, activo, created_at, updated_at")
      .eq("empresa_id", empresaId)
      .eq("modelo_id", modelo.id)
      .order("codigo", { ascending: true })
    if (error) throw error
    return res.json({ modelo, articulos: data })
  } catch (err) {
    console.error("Error obteniendo artículos del modelo:", err)
    return res.status(500).json({ error: "Error obteniendo artículos" })
  }
})

router.post("/", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const modeloId = Number(req.body.modelo_id)
    const codigo = clean(req.body.codigo)
    const color = clean(req.body.color)

    if (!modeloId || !codigo || !color) {
      return res.status(400).json({ error: "modelo_id, código y color son obligatorios" })
    }

    const modelo = await getModeloPropio(modeloId, empresaId)
    if (!modelo) return res.status(404).json({ error: "Modelo no encontrado para esta empresa" })

    const { data, error } = await supabase
      .from("articulos")
      .insert({ empresa_id: empresaId, modelo_id: modeloId, codigo, color, activo: true })
      .select("id, modelo_id, codigo, color, activo, created_at, updated_at")
      .single()

    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe un artículo con ese código en la empresa" })
    }
    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    console.error("Error creando artículo:", err)
    return res.status(500).json({ error: "Error creando artículo" })
  }
})

router.put("/:id", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const articuloId = Number(req.params.id)
    const codigo = clean(req.body.codigo)
    const color = clean(req.body.color)
    const modeloId = Number(req.body.modelo_id)

    if (!articuloId || !modeloId || !codigo || !color) {
      return res.status(400).json({ error: "modelo_id, código y color son obligatorios" })
    }

    const modelo = await getModeloPropio(modeloId, empresaId)
    if (!modelo) return res.status(404).json({ error: "Modelo no encontrado para esta empresa" })

    const { data, error } = await supabase
      .from("articulos")
      .update({ modelo_id: modeloId, codigo, color, updated_at: new Date().toISOString() })
      .eq("id", articuloId)
      .eq("empresa_id", empresaId)
      .select("id, modelo_id, codigo, color, activo, created_at, updated_at")
      .maybeSingle()

    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe un artículo con ese código en la empresa" })
    }
    if (error) throw error
    if (!data) return res.status(404).json({ error: "Artículo no encontrado" })
    return res.json(data)
  } catch (err) {
    console.error("Error editando artículo:", err)
    return res.status(500).json({ error: "Error editando artículo" })
  }
})

router.patch("/:id/estado", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const articuloId = Number(req.params.id)
    if (!articuloId || typeof req.body.activo !== "boolean") {
      return res.status(400).json({ error: "Estado inválido" })
    }

    const { data, error } = await supabase
      .from("articulos")
      .update({ activo: req.body.activo, updated_at: new Date().toISOString() })
      .eq("id", articuloId)
      .eq("empresa_id", empresaId)
      .select("id, modelo_id, codigo, color, activo, created_at, updated_at")
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: "Artículo no encontrado" })
    return res.json(data)
  } catch (err) {
    console.error("Error cambiando estado del artículo:", err)
    return res.status(500).json({ error: "Error cambiando estado del artículo" })
  }
})

module.exports = router
