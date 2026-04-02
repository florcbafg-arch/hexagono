const express = require("express")
const router = express.Router()
const { supabase } = require("../../config/supabase")

console.log("✅ sacabocados.js cargado")

function abreviarMarca(marca = "") {
  const limpia = String(marca)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")

  if (!limpia) return "GEN"

  const palabras = limpia.split(" ").filter(Boolean)

  if (palabras.length === 1) {
    return palabras[0].slice(0, 4)
  }

  return palabras.map(p => p.slice(0, 2)).join("").slice(0, 4)
}

function abreviarPieza(pieza = "") {
  const mapa = {
    "PUNTERA": "PUNT",
    "CAÑA": "CANA",
    "CANA": "CANA",
    "CORDONERA": "CORD",
    "FORRO": "FORR",
    "CAPELLADA": "CAPE",
    "LENGUA": "LENG",
    "TALON": "TALO",
    "PLANTILLA": "PLAN",
    "BANDA": "BAND",
    "BUMPER": "BUMP",
    "BASE": "BASE"
  }

  const limpia = String(pieza)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")

  if (!limpia) return "PIEZ"

  if (mapa[limpia]) return mapa[limpia]

  return limpia.slice(0, 4)
}

async function generarCodigoSacabocado({ empresaId, marca, pieza }) {
  const marcaAbrev = abreviarMarca(marca)
  const piezaAbrev = abreviarPieza(pieza)
  const prefijo = `${marcaAbrev}-${piezaAbrev}-`

  const { data, error } = await supabase
    .from("sacabocados")
    .select("codigo")
    .eq("empresa_id", empresaId)
    .ilike("codigo", `${prefijo}%`)

  if (error) throw error

  let maxNumero = 0

  for (const item of data || []) {
    const codigo = item.codigo || ""
    const partes = codigo.split("-")
    const ultimo = partes[partes.length - 1]
    const numero = parseInt(ultimo, 10)

    if (!isNaN(numero) && numero > maxNumero) {
      maxNumero = numero
    }
  }

  const siguiente = String(maxNumero + 1).padStart(3, "0")
  return `${prefijo}${siguiente}`
}

// CREAR SACABOCADO
router.post("/sacabocados", async (req, res) => {
  console.log("🔥 HIT POST /api/sacabocados")
  console.log("📦 BODY POST /api/sacabocados:", req.body)
  console.log("👤 req.user en POST:", req.user)

  const empresaId = req.user?.empresa_id
  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

const {
  marca,
  modelo_referencia,
  pieza,
  subpieza,
  material_base,
  descripcion,
  ancho,
  alto,
  area_base,
  consumo_referencia,
  unidad_medida,
  imagen_url,
  observaciones,
  activo
} = req.body
  

  if (!marca?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Marca obligatoria"
    })
  }

  if (!pieza?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Pieza obligatoria"
    })
  }

  try {
    const codigo = await generarCodigoSacabocado({
      empresaId,
      marca,
      pieza
    })

    const { data, error } = await supabase
      .from("sacabocados")
      .insert([{
        empresa_id: empresaId,
        codigo,
        marca: marca?.trim() || "",
        modelo_referencia: modelo_referencia?.trim() || "",
        pieza: pieza?.trim() || "",
        subpieza: subpieza?.trim() || "",
        material_base: material_base?.trim() || "",
        descripcion: descripcion?.trim() || "",
        ancho: ancho ?? null,
        alto: alto ?? null,
        area_base: area_base ?? null,
        consumo_referencia: consumo_referencia ?? null,
        unidad_medida: unidad_medida?.trim() || "",
        imagen_url: imagen_url?.trim() || "",
        observaciones: observaciones?.trim() || "",
        activo: activo ?? true
      }])
      .select()
      .single()

    if (error) throw error

    return res.json({
      ok: true,
      message: "Sacabocado creado correctamente",
      sacabocado: data
    })
  } catch (error) {
    console.error("Error creando sacabocado:", error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

// LISTAR SACABOCADOS
router.get("/sacabocados", async (req, res) => {
  console.log("🔥 HIT GET /api/sacabocados")
  console.log("👤 req.user en GET:", req.user)

  const empresaId = req.user?.empresa_id

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

  
  try {
    const { data, error } = await supabase
      .from("sacabocados")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false })

    if (error) throw error

    return res.json({
      ok: true,
      sacabocados: data || []
    })
  } catch (error) {
    console.error("Error listando sacabocados:", error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

// TRAER UNO
router.get("/sacabocados/:id", async (req, res) => {
  const empresaId = req.user?.empresa_id
  const { id } = req.params

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

  try {
    const { data, error } = await supabase
      .from("sacabocados")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single()

    if (error) throw error

    return res.json({
      ok: true,
      sacabocado: data
    })
  } catch (error) {
    console.error("Error trayendo sacabocado:", error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

// ACTUALIZAR SACABOCADO
router.put("/sacabocados/:id", async (req, res) => {
  const empresaId = req.user?.empresa_id
  const { id } = req.params

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

  try {
    const {
  marca,
  modelo_referencia,
  pieza,
  subpieza,
  material_base,
  descripcion,
  ancho,
  alto,
  area_base,
  consumo_referencia,
  unidad_medida,
  imagen_url,
  observaciones,
  activo
} = req.body

    const { data, error } = await supabase
      .from("sacabocados")
      .update({
        marca,
        modelo_referencia,
        pieza,
        subpieza,
        material_base,
        descripcion,
        ancho,
        alto,
        area_base,
        consumo_referencia,
        unidad_medida,
        imagen_url,
        observaciones,
        activo
      })
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select()
      .single()

    if (error) throw error

    return res.json({
      ok: true,
      message: "Sacabocado actualizado",
      sacabocado: data
    })

  } catch (error) {
    console.error("Error actualizando sacabocado:", error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

// ELIMINAR SACABOCADO
router.delete("/sacabocados/:id", async (req, res) => {
  const empresaId = req.user?.empresa_id
  const { id } = req.params

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

  try {
    const { error } = await supabase
      .from("sacabocados")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId)

    if (error) throw error

    return res.json({
      ok: true,
      message: "Sacabocado eliminado correctamente"
    })

  } catch (error) {
    console.error("Error eliminando sacabocado:", error)
    return res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

// SUBIR IMAGEN SACABOCADO
router.post("/sacabocados/upload-imagen", async (req, res) => {
  console.log("🔥 HIT POST /api/sacabocados/upload-imagen")
  console.log("📦 BODY UPLOAD:", req.body)
  console.log("👤 req.user en UPLOAD:", req.user)

  const empresaId = req.user?.empresa_id

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    })
  }

  try {
    const { fileBase64, fileName } = req.body

    if (!fileBase64) {
      return res.status(400).json({
        ok: false,
        error: "Archivo requerido"
      })
    }

    const buffer = Buffer.from(fileBase64, "base64")

    const filePath = `sacabocados/${empresaId}/${Date.now()}_${fileName}`

    const { error } = await supabase.storage
     .from("fichas-tecnicas") // usamos mismo bucket
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: false
      })

    if (error) throw error

    const { data } = supabase
      .storage
      .from("fichas-tecnicas")
      .getPublicUrl(filePath)

    return res.json({
      ok: true,
      url: data.publicUrl
    })

 } catch (error) {
  console.error("❌ ERROR POST /api/sacabocados/upload-imagen:", error)
  return res.status(500).json({
    ok: false,
    error: error.message
  })
}
})

module.exports = router
