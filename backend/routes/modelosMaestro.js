const express = require("express")
const router = express.Router()
const { supabase } = require("../../config/supabase")

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

router.get("/", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const { data, error } = await supabase
      .from("modelos")
      .select("id, marca, nombre, fecha_creacion")
      .eq("empresa_id", empresaId)
      .order("marca", { ascending: true })
      .order("nombre", { ascending: true })
    if (error) throw error
    return res.json(data)
  } catch (err) {
    console.error("Error listando modelos maestro:", err)
    return res.status(500).json({ error: "Error listando modelos" })
  }
})

router.post("/", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const marca = clean(req.body.marca)
    const nombre = clean(req.body.nombre)
    if (!marca || !nombre) return res.status(400).json({ error: "Marca y nombre son obligatorios" })

    const { data: existente, error: findError } = await supabase
      .from("modelos")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("marca", marca)
      .ilike("nombre", nombre)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError
    if (existente) return res.status(409).json({ error: "Ese modelo ya existe para la marca" })

    const { data, error } = await supabase
      .from("modelos")
      .insert({ empresa_id: empresaId, marca, nombre })
      .select("id, marca, nombre, fecha_creacion")
      .single()
    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    console.error("Error creando modelo maestro:", err)
    return res.status(500).json({ error: "Error creando modelo" })
  }
})

router.put("/:id", async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const id = Number(req.params.id)
    const marca = clean(req.body.marca)
    const nombre = clean(req.body.nombre)
    if (!id || !marca || !nombre) return res.status(400).json({ error: "Marca y nombre son obligatorios" })

    const { data: duplicado, error: findError } = await supabase
      .from("modelos")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("marca", marca)
      .ilike("nombre", nombre)
      .neq("id", id)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError
    if (duplicado) return res.status(409).json({ error: "Ese modelo ya existe para la marca" })

    const { data, error } = await supabase
      .from("modelos")
      .update({ marca, nombre })
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("id, marca, nombre, fecha_creacion")
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: "Modelo no encontrado" })
    return res.json(data)
  } catch (err) {
    console.error("Error editando modelo maestro:", err)
    return res.status(500).json({ error: "Error editando modelo" })
  }
})

module.exports = router
