const express = require("express")
const router = express.Router()
const { supabase } = require("../../config/supabase")

function empresa(req, res) {
  const empresaId = req.user?.empresa_id
  if (!empresaId) {
    res.status(401).json({ ok: false, error: "Empresa no identificada" })
    return null
  }
  return empresaId
}

function texto(valor) {
  return String(valor || "").trim()
}

function normalizar(valor) {
  return texto(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const PIEZAS_EXCLUIDAS_PATRON = new Set([
  "CAJA",
  "CORDONES",
  "GRIFA DE CAÑA EXT",
  "ETIQ. DE LENGUA",
  "CALCOMANIA",
  "PLANTILLA"
])

function piezaExcluidaPatron(nombre) {
  return PIEZAS_EXCLUIDAS_PATRON.has(normalizar(nombre))
}

function bloqueSugerido(seccion, pieza) {
  const nombreSeccion = normalizar(seccion?.nombre)
  const titulo = normalizar(seccion?.titulo_impresion)
  const tipo = normalizar(seccion?.tipo_seccion)
  const nombrePieza = normalizar(pieza?.nombre)
  const combinado = [nombreSeccion, titulo, tipo].join(" ")

  if (combinado.includes("REFUERZO") || combinado.includes("STROBEL")) {
    return "CORTE REFUERZO"
  }
  if (combinado.includes("FORRO")) return "CORTE FORRO"
  if (combinado.includes("CAPELLADA")) return "CORTE CAPELLADA"

  const pistasForro = ["FORRO CAÑA", "FORRO CANA", "FORRO CAPELLADA", "FORRO LENGUA"]
  if (pistasForro.some(x => nombrePieza.includes(x))) return "CORTE FORRO"

  const pistasRefuerzo = [
    "RELLENO", "CONTRAFUERTE", "PUNTERA TERMOPLAST", "REFUERZO",
    "STROBEL", "COSTURADO C/MANTA", "LIENZO TERMO"
  ]
  if (pistasRefuerzo.some(x => nombrePieza.includes(x))) return "CORTE REFUERZO"

  return "CORTE CAPELLADA"
}

async function obtenerArticulo(articuloId, empresaId) {
  const { data, error } = await supabase
    .from("articulos")
    .select("id, empresa_id, modelo_id, codigo, color, activo, modelos(id, nombre, marca)")
    .eq("id", articuloId)
    .eq("empresa_id", empresaId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function obtenerFichaVigente(articuloId, empresaId) {
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select("id, articulo_id, version, estado, sistema_constructivo, vigente_desde, vigente_hasta")
    .eq("empresa_id", empresaId)
    .eq("articulo_id", articuloId)
    .eq("estado", "vigente")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function estructuraFicha(fichaId, empresaId) {
  const { data: secciones, error: se } = await supabase
    .from("fichas_secciones")
    .select("id, nombre, orden, titulo_impresion, tipo_seccion")
    .eq("ficha_id", fichaId)
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true })
  if (se) throw se

  const seccionIds = (secciones || []).map(s => s.id)
  if (!seccionIds.length) return { secciones: [], piezas: [], materiales: [] }

  const { data: piezas, error: pe } = await supabase
    .from("fichas_piezas")
    .select("id, seccion_id, nombre, orden, tipo_pieza, sacabocado_id")
    .in("seccion_id", seccionIds)
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true })
  if (pe) throw pe

  const piezaIds = (piezas || []).map(p => p.id)
  if (!piezaIds.length) return { secciones: secciones || [], piezas: [], materiales: [] }

  const { data: materiales, error: me } = await supabase
    .from("fichas_materiales")
    .select("id, pieza_id, material, especificacion, color, unidad_medida, orden, categoria")
    .in("pieza_id", piezaIds)
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true })
  if (me) throw me

  return { secciones: secciones || [], piezas: piezas || [], materiales: materiales || [] }
}

// Patrón técnico V2: siempre parte del Artículo concreto y de su Ficha vigente.
router.get("/articulo/:articuloId", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const articuloId = Number(req.params.articuloId)
    if (!articuloId) return res.status(400).json({ ok: false, error: "articuloId inválido" })

    const articulo = await obtenerArticulo(articuloId, empresaId)
    if (!articulo) return res.status(404).json({ ok: false, error: "Artículo no encontrado" })

    const ficha = await obtenerFichaVigente(articuloId, empresaId)
    if (!ficha) {
      return res.status(409).json({
        ok: false,
        error: "El artículo no tiene una Ficha Técnica vigente. Publicá una ficha antes de crear su patrón técnico."
      })
    }

    const estructura = await estructuraFicha(ficha.id, empresaId)
    const { data: guardados, error: ge } = await supabase
      .from("patrones")
      .select("id, ficha_material_id, pieza_id, material_id, grupo_id, bloque, um, metodo_consumo, orden, activo, ficha_id, ficha_version")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", articuloId)
      .eq("ficha_id", ficha.id)
      .eq("activo", true)
    if (ge) throw ge

    const guardadoPorMaterial = new Map((guardados || []).map(p => [p.ficha_material_id, p]))
    const seccionPorId = new Map(estructura.secciones.map(s => [s.id, s]))
    const piezaPorId = new Map(estructura.piezas.map(p => [p.id, p]))
    const bloques = new Map()

    for (const material of estructura.materiales) {
      const pieza = piezaPorId.get(material.pieza_id)
      if (!pieza || piezaExcluidaPatron(pieza.nombre)) continue
      const seccion = seccionPorId.get(pieza.seccion_id)
      const guardado = guardadoPorMaterial.get(material.id)
      const bloque = guardado?.bloque || bloqueSugerido(seccion, pieza)

      if (!bloques.has(bloque)) bloques.set(bloque, [])
      bloques.get(bloque).push({
        patron_id: guardado?.id || null,
        ficha_material_id: material.id,
        material_id: guardado?.material_id || null,
        grupo_id: guardado?.grupo_id || null,
        pieza_id: pieza.id,
        pieza: pieza.nombre,
        sacabocado_id: pieza.sacabocado_id || null,
        material: material.material,
        especificacion: material.especificacion,
        color: material.color,
        unidad_ficha: material.unidad_medida,
        um: guardado?.um || material.unidad_medida || "",
        metodo_consumo: guardado?.metodo_consumo || null,
        bloque,
        orden: guardado?.orden ?? material.orden ?? pieza.orden ?? 0
      })
    }

    return res.json({
      ok: true,
      articulo,
      ficha,
      patron_guardado: (guardados || []).length > 0,
      bloques: Array.from(bloques.entries()).map(([bloque, items]) => ({
        bloque,
        items: items.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      }))
    })
  } catch (err) {
    console.error("Error cargando Patrón Técnico V2:", err)
    return res.status(500).json({ ok: false, error: "Error cargando patrón técnico" })
  }
})

// Guarda la estructura técnica. No guarda T.Tarea ni rindes: pertenecen a fases posteriores.
router.put("/articulo/:articuloId", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const articuloId = Number(req.params.articuloId)
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!articuloId) return res.status(400).json({ ok: false, error: "articuloId inválido" })
    if (!items.length) return res.status(400).json({ ok: false, error: "El patrón debe contener al menos un material" })

    const articulo = await obtenerArticulo(articuloId, empresaId)
    if (!articulo) return res.status(404).json({ ok: false, error: "Artículo no encontrado" })

    const ficha = await obtenerFichaVigente(articuloId, empresaId)
    if (!ficha) return res.status(409).json({ ok: false, error: "El artículo no tiene una Ficha Técnica vigente" })

    const estructura = await estructuraFicha(ficha.id, empresaId)
    const materialesValidos = new Map(estructura.materiales.map(m => [m.id, m]))
    const { data: materialesMaestro, error: mme } = await supabase.from("materiales_maestro").select("id").eq("empresa_id", empresaId).eq("activo", true)
    if (mme) throw mme
    const materialesMaestroValidos = new Set((materialesMaestro || []).map(m => Number(m.id)))
    const { data: grupos, error: gge } = await supabase.from("patron_grupos").select("id,nombre").eq("empresa_id",empresaId).eq("activo",true)
    if (gge) throw gge
    const gruposValidos = new Map((grupos||[]).map(g=>[Number(g.id),g]))
    const idsRecibidos = new Set()
    const preparados = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const materialId = Number(item.ficha_material_id)
      if (!materialId || !materialesValidos.has(materialId)) {
        return res.status(400).json({ ok: false, error: "El patrón contiene un material que no pertenece a la Ficha vigente" })
      }
      if (idsRecibidos.has(materialId)) {
        return res.status(400).json({ ok: false, error: "Hay materiales duplicados en el patrón" })
      }
      idsRecibidos.add(materialId)

      const material = materialesValidos.get(materialId)
      const pieza = estructura.piezas.find(p => Number(p.id) === Number(material.pieza_id))
      if (piezaExcluidaPatron(pieza?.nombre)) continue
      const materialMaestroId = Number(item.material_id)
      if (!materialMaestroId || !materialesMaestroValidos.has(materialMaestroId)) {
        return res.status(400).json({ ok: false, error: "Seleccioná un material válido del Maestro de Materiales" })
      }
      const grupoId=Number(item.grupo_id)
      if(!grupoId || !gruposValidos.has(grupoId)) return res.status(400).json({ok:false,error:"Seleccioná un grupo/sección válido para cada línea del patrón"})
      const grupo=gruposValidos.get(grupoId)
      preparados.push({
        ficha_material_id: materialId,
        pieza_id: material.pieza_id,
        material_id: materialMaestroId,
        grupo_id: grupoId,
        bloque: grupo.nombre,
        um: texto(item.um) || material.unidad_medida || "",
        orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : i + 1,
        metodo_consumo: ["rinde","directo"].includes(texto(item.metodo_consumo).toLowerCase()) ? texto(item.metodo_consumo).toLowerCase() : null
      })
    }

    const { data: existentes, error: ee } = await supabase
      .from("patrones")
      .select("id, ficha_material_id")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", articuloId)
      .eq("ficha_id", ficha.id)
    if (ee) throw ee

    const existentePorMaterial = new Map((existentes || []).map(p => [p.ficha_material_id, p]))
    const conservados = new Set()

    for (const item of preparados) {
      const anterior = existentePorMaterial.get(item.ficha_material_id)
      const payload = {
        empresa_id: empresaId,
        articulo_id: articuloId,
        ficha_id: ficha.id,
        ficha_version: ficha.version,
        ficha_material_id: item.ficha_material_id,
        pieza_id: item.pieza_id,
        material_id: item.material_id,
        grupo_id: item.grupo_id,
        bloque: item.bloque,
        um: item.um,
        orden: item.orden,
        metodo_consumo: item.metodo_consumo,
        activo: true
      }

      if (anterior) {
        const { error } = await supabase
          .from("patrones")
          .update(payload)
          .eq("id", anterior.id)
          .eq("empresa_id", empresaId)
        if (error) throw error
        conservados.add(anterior.id)
      } else {
        const { data, error } = await supabase
          .from("patrones")
          .insert(payload)
          .select("id")
          .single()
        if (error) throw error
        conservados.add(data.id)
      }
    }

    // No se borra historia: una fila omitida queda archivada.
    const idsArchivar = (existentes || []).filter(p => !conservados.has(p.id)).map(p => p.id)
    if (idsArchivar.length) {
      const { error } = await supabase
        .from("patrones")
        .update({ activo: false })
        .in("id", idsArchivar)
        .eq("empresa_id", empresaId)
      if (error) throw error
    }

    // Si se publica una nueva Ficha, el patrón anterior queda preservado pero deja de ser el actual.
    const { error: oldError } = await supabase
      .from("patrones")
      .update({ activo: false })
      .eq("empresa_id", empresaId)
      .eq("articulo_id", articuloId)
      .neq("ficha_id", ficha.id)
      .eq("activo", true)
    if (oldError) throw oldError

    return res.json({
      ok: true,
      articulo_id: articuloId,
      ficha_id: ficha.id,
      ficha_version: ficha.version,
      filas_guardadas: preparados.length
    })
  } catch (err) {
    console.error("Error guardando Patrón Técnico V2:", err)
    return res.status(500).json({ ok: false, error: "Error guardando patrón técnico" })
  }
})

module.exports = router
