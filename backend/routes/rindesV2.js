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

function usuarioId(req) {
  const id = Number(req.user?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

function texto(v) { return String(v ?? "").trim() }
function numero(v) {
  if (v === "" || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const ESTADOS = new Set(["estimado", "verificado", "revisado"])
const ORIGENES = new Set(["sacabocado", "molde_provisorio", "otro"])
const METODOS = new Set(["manual", "formula", "simulacion"])

async function patronV2(patronId, empresaId) {
  const { data, error } = await supabase
    .from("patrones")
    .select("id, empresa_id, articulo_id, ficha_id, ficha_version, ficha_material_id, pieza_id, material_id, grupo_id, bloque, um, metodo_consumo, orden, activo")
    .eq("id", patronId)
    .eq("empresa_id", empresaId)
    .not("articulo_id", "is", null)
    .maybeSingle()
  if (error) throw error
  return data
}

async function sacabocadoValido(sacabocadoId, empresaId) {
  if (!sacabocadoId) return null
  const { data, error } = await supabase
    .from("sacabocados")
    .select("id, codigo, pieza, subpieza, ancho, alto, area_base, unidad_medida, activo")
    .eq("id", sacabocadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle()
  if (error) throw error
  return data
}

function payloadBase(body, empresaId, patronId, creador) {
  const estado = texto(body.estado || "estimado").toLowerCase()
  const origen = texto(body.origen_medicion || "sacabocado").toLowerCase()
  const metodo = texto(body.metodo_calculo || "manual").toLowerCase()
  if (!ESTADOS.has(estado)) throw new Error("Estado de rinde inválido")
  if (!ORIGENES.has(origen)) throw new Error("Origen de medición inválido")
  if (!METODOS.has(metodo)) throw new Error("Método de cálculo inválido")

  const talle = texto(body.talle)
  if (!talle) throw new Error("El talle es obligatorio")

  return {
    empresa_id: empresaId,
    patron_id: patronId,
    talle,
    estado,
    origen_medicion: origen,
    sacabocado_id: numero(body.sacabocado_id),
    material_id: numero(body.material_id),
    piezas_por_par: numero(body.piezas_por_par),
    material_unidad: texto(body.material_unidad) || null,
    material_ancho: numero(body.material_ancho),
    material_largo: numero(body.material_largo),
    material_area: numero(body.material_area),
    pieza_ancho: numero(body.pieza_ancho),
    pieza_largo: numero(body.pieza_largo),
    pieza_area: numero(body.pieza_area),
    capacidad_ancho: numero(body.capacidad_ancho),
    capacidad_largo: numero(body.capacidad_largo),
    cantidad_piezas_simuladas: numero(body.cantidad_piezas_simuladas),
    pares_obtenidos: numero(body.pares_obtenidos),
    consumo_por_par: numero(body.consumo_por_par),
    metodo_calculo: metodo,
    formula_codigo: texto(body.formula_codigo) || null,
    formula_version: numero(body.formula_version),
    parametros_calculo: body.parametros_calculo && typeof body.parametros_calculo === "object" ? body.parametros_calculo : {},
    resultado_calculo: body.resultado_calculo && typeof body.resultado_calculo === "object" ? body.resultado_calculo : {},
    observaciones: texto(body.observaciones) || null,
    creado_por: creador
  }
}

// Vista de trabajo: líneas del Patrón Técnico + rindes vigentes por talle.
router.get("/articulo/:articuloId", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const articuloId = Number(req.params.articuloId)
    if (!articuloId) return res.status(400).json({ ok:false, error:"articuloId inválido" })

    const { data: patrones, error: pe } = await supabase
      .from("patrones")
      .select("id, articulo_id, ficha_id, ficha_version, ficha_material_id, pieza_id, material_id, bloque, um, metodo_consumo, orden, activo")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", articuloId)
      .eq("activo", true)
      .order("orden", { ascending:true })
    if (pe) throw pe
    if (!patrones?.length) return res.status(404).json({ ok:false, error:"El artículo no tiene Patrón Técnico V2 guardado" })

    const patronesRinde = patrones.filter(p => p.metodo_consumo !== "directo")
    const patronIds = patronesRinde.map(p => p.id)
    const materialIds = patronesRinde.map(p => p.ficha_material_id).filter(Boolean)
    const maestroIds = patronesRinde.map(p => p.material_id).filter(Boolean)

    const [{ data: mats, error: me }, { data: maestros, error: mae }, { data: rindes, error: re }] = await Promise.all([
      materialIds.length
        ? supabase.from("fichas_materiales").select("id, pieza_id, material, especificacion, color, unidad_medida").in("id", materialIds).eq("empresa_id", empresaId)
        : Promise.resolve({data:[],error:null}),
      maestroIds.length ? supabase.from("materiales_maestro").select("id,nombre,familia,origen,unidad_sugerida").in("id",maestroIds).eq("empresa_id",empresaId) : Promise.resolve({data:[],error:null}),
      supabase.from("rindes").select("*").in("patron_id", patronIds).eq("empresa_id", empresaId).eq("vigente", true).order("talle", { ascending:true })
    ])
    if (me) throw me
    if (mae) throw mae
    if (re) throw re

    const piezaIds = (mats || []).map(m => m.pieza_id).filter(Boolean)
    let piezas = []
    if (piezaIds.length) {
      const { data, error } = await supabase.from("fichas_piezas").select("id, nombre, sacabocado_id").in("id", piezaIds).eq("empresa_id", empresaId)
      if (error) throw error
      piezas = data || []
    }

    const matMap = new Map((mats || []).map(m => [m.id,m]))
    const maestroMap = new Map((maestros || []).map(m => [Number(m.id),m]))
    const piezaMap = new Map(piezas.map(p => [p.id,p]))
    const rindesMap = new Map()
    for (const r of rindes || []) {
      if (!rindesMap.has(r.patron_id)) rindesMap.set(r.patron_id, [])
      rindesMap.get(r.patron_id).push(r)
    }

    const lineas = patronesRinde.map(p => {
      const m = matMap.get(p.ficha_material_id) || {}
      const pieza = piezaMap.get(m.pieza_id) || {}
      return {
        ...p,
        pieza_id: pieza.id || null,
        pieza: pieza.nombre || null,
        sacabocado_ficha_id: pieza.sacabocado_id || null,
        material_id: p.material_id || null,
        material: maestroMap.get(Number(p.material_id))?.nombre || m.material || null,
        material_familia: maestroMap.get(Number(p.material_id))?.familia || null,
        especificacion: m.especificacion || null,
        color: m.color || null,
        unidad_ficha: m.unidad_medida || null,
        rindes: rindesMap.get(p.id) || []
      }
    })
    res.json({ ok:true, articulo_id:articuloId, ficha_id:patrones[0].ficha_id, ficha_version:patrones[0].ficha_version, lineas, directos: patrones.filter(p => p.metodo_consumo === "directo").length })
  } catch (err) {
    console.error("Error cargando Rindes V2:", err)
    res.status(500).json({ ok:false, error:"Error cargando rindes" })
  }
})

// Simulación técnica de Patrón de Tarea. No persiste curva ni resultado.
router.post("/articulo/:articuloId/calcular-tarea", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const articuloId = Number(req.params.articuloId)
    const curva = Array.isArray(req.body?.curva) ? req.body.curva : []
    const curvaLimpia = curva.map(x => ({ talle:texto(x.talle), pares:numero(x.pares) }))
      .filter(x => x.talle && x.pares > 0)
    if (!articuloId || !curvaLimpia.length) return res.status(400).json({ok:false,error:"Ingresá una curva con al menos un talle y cantidad de pares."})

    const { data: patrones, error: pe } = await supabase.from("patrones")
      .select("id, articulo_id, ficha_id, ficha_version, ficha_material_id, pieza_id, material_id, bloque, um, metodo_consumo, orden")
      .eq("empresa_id",empresaId).eq("articulo_id",articuloId).eq("activo",true).order("orden")
    if (pe) throw pe
    if (!patrones?.length) return res.status(404).json({ok:false,error:"El artículo no tiene Patrón Técnico V2 guardado."})

    const noClasificados = patrones.filter(p => !p.metodo_consumo)
    if (noClasificados.length) return res.status(409).json({ok:false,error:`Hay ${noClasificados.length} línea(s) del patrón sin método de consumo. Clasificalas antes de calcular.`})

    const rindeLines = patrones.filter(p => p.metodo_consumo === "rinde")
    const ids = rindeLines.map(p=>p.id)
    let rindes=[]
    if(ids.length){
      const {data,error}=await supabase.from("rindes").select("id,patron_id,talle,version,estado,consumo_por_par,material_unidad")
        .eq("empresa_id",empresaId).in("patron_id",ids).eq("vigente",true)
      if(error) throw error
      rindes=data||[]
    }
    const mids=patrones.map(p=>p.ficha_material_id).filter(Boolean)
    let mats=[]
    if(mids.length){
      const {data,error}=await supabase.from("fichas_materiales").select("id,pieza_id,material,especificacion,color,unidad_medida").eq("empresa_id",empresaId).in("id",mids)
      if(error) throw error
      mats=data||[]
    }
    const pids=mats.map(m=>m.pieza_id).filter(Boolean)
    let piezas=[]
    if(pids.length){
      const {data,error}=await supabase.from("fichas_piezas").select("id,nombre").eq("empresa_id",empresaId).in("id",pids)
      if(error) throw error
      piezas=data||[]
    }
    const maestroIdsTarea=patrones.map(p=>p.material_id).filter(Boolean)
    let maestrosTarea=[]
    if(maestroIdsTarea.length){const {data,error}=await supabase.from("materiales_maestro").select("id,nombre").eq("empresa_id",empresaId).in("id",maestroIdsTarea);if(error)throw error;maestrosTarea=data||[]}
    const mm=new Map(mats.map(m=>[m.id,m])), pm=new Map(piezas.map(p=>[p.id,p])), mam=new Map(maestrosTarea.map(m=>[Number(m.id),m]))
    const faltantes=[], lineas=[]
    for(const p of patrones){
      const m=mm.get(p.ficha_material_id)||{}, pieza=pm.get(m.pieza_id)||{}
      if(p.metodo_consumo==="directo"){
        lineas.push({patron_id:p.id,bloque:p.bloque,pieza:pieza.nombre||null,material:mam.get(Number(p.material_id))?.nombre||m.material||null,color:m.color||m.especificacion||null,um:p.um||m.unidad_medida||null,metodo_consumo:"directo",t_tarea:null,detalle:[],pendiente_directo:true})
        continue
      }
      let total=0; const detalle=[]
      for(const c of curvaLimpia){
        const r=rindes.find(x=>x.patron_id===p.id && String(x.talle)===String(c.talle))
        if(!r || !(Number(r.consumo_por_par)>0)){
          faltantes.push({patron_id:p.id,pieza:pieza.nombre||null,material:mam.get(Number(p.material_id))?.nombre||m.material||null,talle:c.talle})
          continue
        }
        const subtotal=Number(c.pares)*Number(r.consumo_por_par); total+=subtotal
        detalle.push({talle:c.talle,pares:c.pares,rinde_id:r.id,rinde_version:r.version,estado:r.estado,consumo_por_par:Number(r.consumo_por_par),subtotal})
      }
      lineas.push({patron_id:p.id,bloque:p.bloque,pieza:pieza.nombre||null,material:mam.get(Number(p.material_id))?.nombre||m.material||null,color:m.color||m.especificacion||null,um:p.um||m.unidad_medida||null,metodo_consumo:"rinde",t_tarea:faltantes.some(x=>x.patron_id===p.id)?null:total,detalle})
    }
    res.json({ok:true,simulacion:true,persistido:false,articulo_id:articuloId,ficha_id:patrones[0].ficha_id,ficha_version:patrones[0].ficha_version,total_pares:curvaLimpia.reduce((s,x)=>s+x.pares,0),curva:curvaLimpia,completo:faltantes.length===0,faltantes,lineas})
  } catch(err){console.error("Error calculando patrón de tarea:",err);res.status(500).json({ok:false,error:"Error calculando patrón de tarea"})}
})

// Catálogo reutilizable: un mismo código de sacabocado puede usarse en muchos artículos/patrones.
router.get("/sacabocados", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const { data, error } = await supabase.from("sacabocados")
      .select("id, codigo, pieza, subpieza, marca, modelo_referencia, ancho, alto, area_base, unidad_medida, activo")
      .eq("empresa_id", empresaId).eq("activo", true).order("codigo")
    if (error) throw error
    res.json({ ok:true, sacabocados:data || [] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok:false, error:"Error cargando sacabocados" })
  }
})

// Crear primer rinde de un talle para una línea del patrón.
router.post("/patron/:patronId", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const patronId = Number(req.params.patronId)
    const patron = await patronV2(patronId, empresaId)
    if (!patron) return res.status(404).json({ ok:false, error:"Línea de Patrón Técnico V2 no encontrada" })

    const payload = payloadBase(req.body || {}, empresaId, patronId, usuarioId(req))
    if (!payload.material_id) payload.material_id = patron.material_id
    const { data: materialValido, error: mve } = await supabase.from("materiales_maestro").select("id").eq("id",payload.material_id).eq("empresa_id",empresaId).eq("activo",true).maybeSingle()
    if (mve) throw mve
    if (!materialValido) return res.status(400).json({ok:false,error:"Seleccioná un material activo del Maestro de Materiales"})
    if (payload.origen_medicion === "sacabocado") {
      const s = await sacabocadoValido(payload.sacabocado_id, empresaId)
      if (!s || !s.activo) return res.status(400).json({ ok:false, error:"Seleccioná un sacabocado activo de la empresa" })
    }

    const { data: actual, error: ae } = await supabase.from("rindes")
      .select("id").eq("empresa_id", empresaId).eq("patron_id", patronId)
      .eq("talle", payload.talle).eq("vigente", true).maybeSingle()
    if (ae) throw ae
    if (actual) return res.status(409).json({ ok:false, error:"Ese talle ya tiene un rinde vigente. Creá una revisión." })

    const estado = payload.estado
    const { data, error } = await supabase.from("rindes").insert({
      ...payload,
      version:1,
      vigente:true,
      fecha_verificacion: estado === "verificado" ? new Date().toISOString() : null,
      verificado_por: estado === "verificado" ? usuarioId(req) : null
    }).select("*").single()
    if (error) throw error
    res.status(201).json({ ok:true, rinde:data })
  } catch (err) {
    console.error("Error creando rinde:", err)
    res.status(400).json({ ok:false, error:err.message || "Error creando rinde" })
  }
})

// Revisión inmutable: desactiva la versión anterior y crea una nueva.
router.post("/:rindeId/revisar", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const rindeId = Number(req.params.rindeId)
    const { data: anterior, error: oldErr } = await supabase.from("rindes")
      .select("*").eq("id", rindeId).eq("empresa_id", empresaId).maybeSingle()
    if (oldErr) throw oldErr
    if (!anterior) return res.status(404).json({ ok:false, error:"Rinde no encontrado" })
    if (!anterior.vigente) return res.status(409).json({ ok:false, error:"Solo se puede revisar la versión vigente" })

    const patron = await patronV2(anterior.patron_id, empresaId)
    if (!patron) return res.status(409).json({ ok:false, error:"El rinde no pertenece a un Patrón Técnico V2 válido" })

    const merged = { ...anterior, ...(req.body || {}), talle: anterior.talle }
    const payload = payloadBase(merged, empresaId, anterior.patron_id, usuarioId(req))
    if (!payload.material_id) payload.material_id = patron.material_id
    const { data: materialValido, error: mve } = await supabase.from("materiales_maestro").select("id").eq("id",payload.material_id).eq("empresa_id",empresaId).eq("activo",true).maybeSingle()
    if (mve) throw mve
    if (!materialValido) return res.status(400).json({ok:false,error:"Seleccioná un material activo del Maestro de Materiales"})
    if (payload.origen_medicion === "sacabocado") {
      const s = await sacabocadoValido(payload.sacabocado_id, empresaId)
      if (!s || !s.activo) return res.status(400).json({ ok:false, error:"Seleccioná un sacabocado activo de la empresa" })
    }

    const nuevoEstado = payload.estado === "estimado" ? "revisado" : payload.estado

    // Se hace secuencialmente y la unicidad de vigente protege duplicados.
    const { error: de } = await supabase.from("rindes").update({ vigente:false }).eq("id", anterior.id).eq("empresa_id", empresaId)
    if (de) throw de

    const { data: nuevo, error: ne } = await supabase.from("rindes").insert({
      ...payload,
      version:Number(anterior.version) + 1,
      estado:nuevoEstado,
      vigente:true,
      fecha_verificacion: nuevoEstado === "verificado" ? new Date().toISOString() : anterior.fecha_verificacion,
      verificado_por: nuevoEstado === "verificado" ? usuarioId(req) : anterior.verificado_por
    }).select("*").single()

    if (ne) {
      await supabase.from("rindes").update({ vigente:true }).eq("id", anterior.id).eq("empresa_id", empresaId)
      throw ne
    }
    res.status(201).json({ ok:true, anterior_id:anterior.id, rinde:nuevo })
  } catch (err) {
    console.error("Error revisando rinde:", err)
    res.status(400).json({ ok:false, error:err.message || "Error revisando rinde" })
  }
})

router.get("/patron/:patronId/historial", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return
  try {
    const patronId = Number(req.params.patronId)
    const patron = await patronV2(patronId, empresaId)
    if (!patron) return res.status(404).json({ ok:false, error:"Línea de Patrón Técnico V2 no encontrada" })
    const { data, error } = await supabase.from("rindes").select("*")
      .eq("empresa_id", empresaId).eq("patron_id", patronId)
      .order("talle", {ascending:true}).order("version", {ascending:false})
    if (error) throw error
    res.json({ ok:true, rindes:data || [] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok:false, error:"Error cargando historial de rindes" })
  }
})

module.exports = router
