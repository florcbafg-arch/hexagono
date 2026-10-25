const express = require("express")
const router = express.Router()
const { supabase, supabaseAdmin } = require("../../config/supabase")

function empresa(req, res) {
  const empresaId = req.user?.empresa_id
  if (!empresaId) {
    res.status(401).json({ ok: false, error: "Empresa no identificada" })
    return null
  }
  return empresaId
}

function clean(v) {
  return typeof v === "string" ? v.trim() : ""
}

async function evaluarAptitudItem(item, empresaId) {
  const bloqueos = []
  const advertencias = []
  const controles = []

  const addControl = (clave, nombre, estado, detalle, datos = null) => {
    controles.push({ clave, nombre, estado, detalle, datos })
    if (estado === "bloqueado" && detalle) bloqueos.push(detalle)
    if (estado === "advertencia" && detalle) advertencias.push(detalle)
  }

  // 1. Snapshot + Pedido confirmado
  const { data: snapshot, error: se } = await supabase
    .from("pedido_snapshots")
    .select("id,pedido_id,numero,version,confirmado_at")
    .eq("empresa_id", empresaId)
    .eq("id", item.snapshot_id)
    .maybeSingle()
  if (se) throw se

  if (!snapshot) {
    addControl("snapshot", "Snapshot confirmado", "bloqueado", "Falta el snapshot congelado del Pedido")
  } else {
    addControl("snapshot", "Snapshot confirmado", "ok", `Snapshot #${snapshot.id} · Pedido ${snapshot.numero} V${snapshot.version}`)
  }

  let pedido = null
  if (snapshot?.pedido_id) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id,numero,version,estado")
      .eq("empresa_id", empresaId)
      .eq("id", snapshot.pedido_id)
      .maybeSingle()
    if (error) throw error
    pedido = data || null
  }

  if (!pedido) {
    addControl("pedido", "Pedido confirmado", "bloqueado", "No se encontró el Pedido origen del snapshot")
  } else if (pedido.estado !== "confirmado") {
    addControl("pedido", "Pedido confirmado", "bloqueado", `El Pedido está ${String(pedido.estado || "").toUpperCase()}, no CONFIRMADO`)
  } else {
    addControl("pedido", "Pedido confirmado", "ok", `Pedido ${pedido.numero} · V${pedido.version} confirmado`)
  }

  // 2. Curva congelada
  const { data: curva, error: ce } = await supabase
    .from("pedido_snapshot_talles")
    .select("talle,cantidad,cantidad_pendiente,orden")
    .eq("empresa_id", empresaId)
    .eq("snapshot_item_id", item.id)
    .order("orden", { ascending: true })
  if (ce) throw ce

  const tallesConPares = (curva || []).filter(t => Number(t.cantidad || 0) > 0)
  const tallesPedido = tallesConPares.map(t => String(t.talle))
  const paresCurva = tallesConPares.reduce((acc, t) => acc + Number(t.cantidad || 0), 0)

  if (!tallesPedido.length) {
    addControl("curva", "Curva y cantidades", "bloqueado", "El artículo no tiene curva congelada con pares")
  } else if (paresCurva !== Number(item.cantidad_pares || 0)) {
    addControl(
      "curva",
      "Curva y cantidades",
      "bloqueado",
      `La curva suma ${paresCurva} pares y el artículo declara ${Number(item.cantidad_pares || 0)}`
    )
  } else {
    addControl(
      "curva",
      "Curva y cantidades",
      "ok",
      `${tallesPedido.length} talles · ${paresCurva} pares congelados`,
      { talles: tallesConPares }
    )
  }

  // 3. Patrón técnico
  const { data: patrones, error: pe } = await supabase
    .from("patrones")
    .select("id,pieza,material_id,material,um,metodo_consumo,tipo_escalado,escala_confirmada,consumo_por_par,activo,orden")
    .eq("empresa_id", empresaId)
    .eq("articulo_id", item.articulo_id)
    .eq("activo", true)
    .order("orden", { ascending: true })
  if (pe) throw pe

  if (!patrones?.length) {
    addControl("patron", "Patrón técnico", "bloqueado", "Falta Patrón Técnico")
    addControl("materiales", "Materiales identificados", "bloqueado", "No se pueden validar materiales sin Patrón Técnico")
    addControl("rindes", "Rindes por talle", "bloqueado", "No se pueden validar rindes sin Patrón Técnico")
    addControl("escalas", "Escalas confirmadas", "bloqueado", "No se pueden validar escalas sin Patrón Técnico")
    addControl("equivalencias", "Equivalencias desalineadas", "bloqueado", "No se pueden validar equivalencias sin Patrón Técnico")
    addControl("directos", "Consumos directos", "bloqueado", "No se pueden validar consumos directos sin Patrón Técnico")

    return {
      estado: "bloqueado",
      puede_generar_despiece: false,
      bloqueos,
      advertencias,
      controles,
      resumen: {
        lineas_patron: 0,
        rindes_vigentes: 0,
        talles_pedido: tallesPedido.length,
        pares_pedido: Number(item.cantidad_pares || 0),
        materiales_sin_asignar: 0,
        escalados_alineados: 0,
        escalados_desalineados: 0,
        equivalencias_requeridas: 0,
        equivalencias_faltantes: 0,
        directos_incompletos: 0
      }
    }
  }

  addControl("patron", "Patrón técnico", "ok", `${patrones.length} líneas activas`)

  // 4. Materiales
  const sinMaterial = patrones.filter(p => !p.material_id)
  if (sinMaterial.length) {
    addControl(
      "materiales",
      "Materiales identificados",
      "bloqueado",
      `${sinMaterial.length} línea(s) del Patrón no tienen material del Maestro asignado`,
      { piezas: sinMaterial.map(p => p.pieza) }
    )
  } else {
    addControl("materiales", "Materiales identificados", "ok", `${patrones.length} líneas con material identificado`)
  }

  // 5. Rindes vigentes por talle
  const lineasRinde = patrones.filter(p => (p.metodo_consumo || "rinde") === "rinde")
  let rindesVigentes = []
  let faltantesRinde = []

  if (lineasRinde.length && tallesPedido.length) {
    const { data: rindes, error: re } = await supabase
      .from("rindes")
      .select("id,patron_id,talle,consumo_por_par,estado,vigente,version")
      .eq("empresa_id", empresaId)
      .eq("vigente", true)
      .in("patron_id", lineasRinde.map(p => p.id))
      .in("talle", tallesPedido)
    if (re) throw re

    rindesVigentes = rindes || []
    const rindeSet = new Set(
      rindesVigentes
        .filter(r => Number(r.consumo_por_par || 0) > 0)
        .map(r => `${r.patron_id}::${r.talle}`)
    )

    lineasRinde.forEach(p => {
      tallesPedido.forEach(talle => {
        if (!rindeSet.has(`${p.id}::${talle}`)) {
          faltantesRinde.push({ patron_id: p.id, pieza: p.pieza, talle })
        }
      })
    })
  }

  if (faltantesRinde.length) {
    addControl(
      "rindes",
      "Rindes por talle",
      "bloqueado",
      `Faltan ${faltantesRinde.length} rinde(s) vigente(s) para los talles pedidos`,
      { faltantes: faltantesRinde }
    )
  } else {
    addControl(
      "rindes",
      "Rindes por talle",
      "ok",
      lineasRinde.length
        ? `${rindesVigentes.length} rindes vigentes cubren todas las líneas/talles requeridos`
        : "El Patrón no contiene líneas que requieran rinde por talle"
    )
  }

  // 6. Escalas
  const escalados = patrones.filter(p => p.tipo_escalado !== "no_escalado")
  const escaladosSinConfirmar = escalados.filter(p => p.escala_confirmada !== true)

  if (escaladosSinConfirmar.length) {
    addControl(
      "escalas",
      "Escalas confirmadas",
      "bloqueado",
      `${escaladosSinConfirmar.length} componente(s) escalado(s) tienen la escala pendiente de confirmar`,
      { piezas: escaladosSinConfirmar.map(p => p.pieza) }
    )
  } else {
    addControl(
      "escalas",
      "Escalas confirmadas",
      "ok",
      escalados.length ? `${escalados.length} componente(s) escalado(s) con escala confirmada` : "No hay componentes escalados en el Patrón"
    )
  }

  // 7. Equivalencias de escalados desalineados
  const desalineados = patrones.filter(p => p.tipo_escalado === "escalado_desalineado")
  let equivalenciasRequeridas = desalineados.length * tallesPedido.length
  let equivalenciasFaltantes = []

  if (desalineados.length && tallesPedido.length) {
    const ids = desalineados.map(p => p.id)
    const { data: equivalencias, error: ee } = await supabase
      .from("despiece_equivalencias_escala")
      .select("fuente_id,talle_articulo,talle_componente,factor,activo")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", item.articulo_id)
      .eq("fuente_tipo", "patron")
      .eq("activo", true)
      .in("fuente_id", ids)
    if (ee) throw ee

    const eqSet = new Set((equivalencias || []).map(e => `${e.fuente_id}::${e.talle_articulo}`))
    desalineados.forEach(p => {
      tallesPedido.forEach(talle => {
        if (!eqSet.has(`${p.id}::${talle}`)) {
          equivalenciasFaltantes.push({ patron_id: p.id, pieza: p.pieza, talle_articulo: talle })
        }
      })
    })
  }

  if (equivalenciasFaltantes.length) {
    addControl(
      "equivalencias",
      "Equivalencias desalineadas",
      "bloqueado",
      `Faltan ${equivalenciasFaltantes.length} equivalencia(s) de escala para componentes desalineados`,
      { faltantes: equivalenciasFaltantes }
    )
  } else {
    addControl(
      "equivalencias",
      "Equivalencias desalineadas",
      "ok",
      desalineados.length
        ? `${equivalenciasRequeridas} equivalencia(s) requeridas completas`
        : "No hay componentes desalineados en el Patrón"
    )
  }

  // 8. Consumos directos
  const directos = patrones.filter(p => p.metodo_consumo === "directo")
  const directosIncompletos = directos.filter(p => !(Number(p.consumo_por_par || 0) > 0))

  if (directosIncompletos.length) {
    addControl(
      "directos",
      "Consumos directos",
      "bloqueado",
      `${directosIncompletos.length} línea(s) de consumo directo no tienen consumo por par definido`,
      { piezas: directosIncompletos.map(p => p.pieza) }
    )
  } else {
    addControl(
      "directos",
      "Consumos directos",
      "ok",
      directos.length ? `${directos.length} línea(s) de consumo directo completas` : "No hay consumos directos en el Patrón"
    )
  }

  const estado = bloqueos.length ? "bloqueado" : advertencias.length ? "advertencia" : "apto"

  return {
    estado,
    puede_generar_despiece: estado === "apto",
    bloqueos,
    advertencias,
    controles,
    resumen: {
      lineas_patron: patrones.length,
      rindes_vigentes: rindesVigentes.length,
      talles_pedido: tallesPedido.length,
      pares_pedido: Number(item.cantidad_pares || 0),
      materiales_sin_asignar: sinMaterial.length,
      escalados_alineados: patrones.filter(p => p.tipo_escalado === "escalado_alineado").length,
      escalados_desalineados: desalineados.length,
      equivalencias_requeridas: equivalenciasRequeridas,
      equivalencias_faltantes: equivalenciasFaltantes.length,
      directos_incompletos: directosIncompletos.length
    }
  }
}


function n8(value) {
  const n = Number(value || 0)
  return Math.round((n + Number.EPSILON) * 100000000) / 100000000
}

async function calcularExplosionItem(item, loteItemId, empresaId) {
  const { data: snapshot, error: se } = await supabase
    .from("pedido_snapshots")
    .select("id,pedido_id,numero,version")
    .eq("empresa_id", empresaId)
    .eq("id", item.snapshot_id)
    .single()
  if (se) throw se

  const { data: curva, error: ce } = await supabase
    .from("pedido_snapshot_talles")
    .select("talle,cantidad,orden")
    .eq("empresa_id", empresaId)
    .eq("snapshot_item_id", item.id)
    .gt("cantidad", 0)
    .order("orden", { ascending: true })
  if (ce) throw ce

  const talles = curva || []
  const tallesTexto = talles.map(t => String(t.talle))

  const { data: patrones, error: pe } = await supabase
    .from("patrones")
    .select("id,ficha_material_id,pieza_id,material_id,grupo_id,bloque,um,metodo_consumo,consumo_por_par,tipo_escalado,orden,activo")
    .eq("empresa_id", empresaId)
    .eq("articulo_id", item.articulo_id)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("id", { ascending: true })
  if (pe) throw pe

  const p = patrones || []
  if (!p.length) throw new Error(`El artículo ${item.articulo_codigo} no tiene Patrón Técnico`)

  const piezaIds = [...new Set(p.map(x => x.pieza_id).filter(Boolean))]
  const fichaMaterialIds = [...new Set(p.map(x => x.ficha_material_id).filter(Boolean))]
  const materialIds = [...new Set(p.map(x => x.material_id).filter(Boolean))]
  const grupoIds = [...new Set(p.map(x => x.grupo_id).filter(Boolean))]

  const [piezasRes, fichaMatRes, materialesRes, gruposRes] = await Promise.all([
    piezaIds.length
      ? supabase.from("fichas_piezas").select("id,nombre").eq("empresa_id", empresaId).in("id", piezaIds)
      : Promise.resolve({ data: [], error: null }),
    fichaMaterialIds.length
      ? supabase.from("fichas_materiales").select("id,material,especificacion,color,unidad_medida").eq("empresa_id", empresaId).in("id", fichaMaterialIds)
      : Promise.resolve({ data: [], error: null }),
    materialIds.length
      ? supabase.from("materiales_maestro").select("id,nombre").eq("empresa_id", empresaId).in("id", materialIds)
      : Promise.resolve({ data: [], error: null }),
    grupoIds.length
      ? supabase.from("patron_grupos").select("id,nombre,orden").eq("empresa_id", empresaId).in("id", grupoIds)
      : Promise.resolve({ data: [], error: null })
  ])

  for (const r of [piezasRes,fichaMatRes,materialesRes,gruposRes]) {
    if (r.error) throw r.error
  }

  const piezaMap = new Map((piezasRes.data || []).map(x => [Number(x.id), x]))
  const fichaMatMap = new Map((fichaMatRes.data || []).map(x => [Number(x.id), x]))
  const materialMap = new Map((materialesRes.data || []).map(x => [Number(x.id), x]))
  const grupoMap = new Map((gruposRes.data || []).map(x => [Number(x.id), x]))

  const lineasRinde = p.filter(x => (x.metodo_consumo || "rinde") === "rinde")
  let rindes = []
  if (lineasRinde.length && tallesTexto.length) {
    const { data, error } = await supabase
      .from("rindes")
      .select("id,patron_id,talle,version,estado,consumo_por_par,vigente")
      .eq("empresa_id", empresaId)
      .eq("vigente", true)
      .in("patron_id", lineasRinde.map(x => x.id))
      .in("talle", tallesTexto)
    if (error) throw error
    rindes = data || []
  }
  const rindeMap = new Map(rindes.map(r => [`${r.patron_id}::${r.talle}`, r]))

  const desalineados = p.filter(x => x.tipo_escalado === "escalado_desalineado")
  let equivalencias = []
  if (desalineados.length && tallesTexto.length) {
    const { data, error } = await supabase
      .from("despiece_equivalencias_escala")
      .select("fuente_id,talle_articulo,talle_componente,factor")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", item.articulo_id)
      .eq("fuente_tipo", "patron")
      .eq("activo", true)
      .in("fuente_id", desalineados.map(x => x.id))
      .in("talle_articulo", tallesTexto)
    if (error) throw error
    equivalencias = data || []
  }
  const equivalenciaMap = new Map(equivalencias.map(e => [`${e.fuente_id}::${e.talle_articulo}`, e]))

  const lineas = p.map((patron, index) => {
    const pieza = piezaMap.get(Number(patron.pieza_id))
    const fichaMaterial = fichaMatMap.get(Number(patron.ficha_material_id))
    const material = materialMap.get(Number(patron.material_id))
    const grupo = grupoMap.get(Number(patron.grupo_id))
    const metodo = patron.metodo_consumo || "rinde"

    const tallesDetalle = talles.map(t => {
      const talleArticulo = String(t.talle)
      const pares = Number(t.cantidad || 0)
      let consumo = 0
      let rinde = null

      if (metodo === "directo") {
        consumo = Number(patron.consumo_por_par || 0)
      } else {
        rinde = rindeMap.get(`${patron.id}::${talleArticulo}`)
        if (!rinde) throw new Error(`Falta rinde vigente para ${pieza?.nombre || "pieza"} · talle ${talleArticulo}`)
        consumo = Number(rinde.consumo_por_par || 0)
      }

      let talleComponente = null
      let factor = 1

      if (patron.tipo_escalado === "escalado_alineado") {
        talleComponente = talleArticulo
      } else if (patron.tipo_escalado === "escalado_desalineado") {
        const eq = equivalenciaMap.get(`${patron.id}::${talleArticulo}`)
        if (!eq) throw new Error(`Falta equivalencia de escala para ${pieza?.nombre || "pieza"} · talle ${talleArticulo}`)
        talleComponente = String(eq.talle_componente)
        factor = Number(eq.factor || 1)
      }

      const necesidad = n8(pares * consumo * factor)

      return {
        rinde_id: rinde?.id || null,
        rinde_version: rinde?.version || null,
        rinde_estado: rinde?.estado || null,
        talle_articulo: talleArticulo,
        talle_componente: talleComponente,
        pares,
        consumo_por_par: n8(consumo),
        factor: n8(factor),
        necesidad
      }
    })

    const necesidadTotal = n8(tallesDetalle.reduce((acc, t) => acc + Number(t.necesidad || 0), 0))

    return {
      patron_id: patron.id,
      ficha_material_id: patron.ficha_material_id || null,
      pieza_id: patron.pieza_id || null,
      grupo_id: patron.grupo_id || null,
      grupo_nombre: grupo?.nombre || patron.bloque || "SIN GRUPO",
      grupo_orden: Number(grupo?.orden || 999),
      pieza_nombre: pieza?.nombre || "PIEZA SIN NOMBRE",
      material_id: patron.material_id,
      material_nombre: material?.nombre || fichaMaterial?.material || "MATERIAL",
      especificacion: fichaMaterial?.especificacion || "",
      color: fichaMaterial?.color || "",
      um: patron.um || fichaMaterial?.unidad_medida || "",
      metodo_consumo: metodo,
      tipo_escalado: patron.tipo_escalado || "no_escalado",
      orden: Number(patron.orden ?? index),
      necesidad_total: necesidadTotal,
      talles: tallesDetalle
    }
  })

  lineas.sort((a,b) =>
    (a.grupo_orden - b.grupo_orden) ||
    (a.orden - b.orden) ||
    a.pieza_nombre.localeCompare(b.pieza_nombre)
  )

  return {
    lote_item_id: loteItemId,
    snapshot_item_id: item.id,
    articulo_id: item.articulo_id,
    pedido_numero: snapshot.numero,
    pedido_version: snapshot.version,
    nro_item: item.nro_item,
    articulo_codigo: item.articulo_codigo,
    articulo_modelo: item.articulo_modelo,
    articulo_marca: item.articulo_marca || "",
    articulo_color: item.articulo_color || "",
    cantidad_pares: Number(item.cantidad_pares || 0),
    lineas
  }
}

async function obtenerExplosionVigente(loteId, empresaId) {
  const { data: ejecucion, error: ee } = await supabase
    .from("despiece_ejecuciones")
    .select("id,lote_id,version,estado,vigente,total_articulos,total_lineas,total_pares,generado_por,generado_at")
    .eq("empresa_id", empresaId)
    .eq("lote_id", loteId)
    .eq("vigente", true)
    .maybeSingle()
  if (ee) throw ee
  if (!ejecucion) return null

  const { data: items, error: ie } = await supabase
    .from("despiece_resultados_item")
    .select("id,lote_item_id,snapshot_item_id,articulo_id,pedido_numero,pedido_version,nro_item,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,cantidad_pares")
    .eq("empresa_id", empresaId)
    .eq("ejecucion_id", ejecucion.id)
    .order("nro_item", { ascending: true })
  if (ie) throw ie

  const itemIds = (items || []).map(x => x.id)
  let lineas = []
  if (itemIds.length) {
    const { data, error } = await supabase
      .from("despiece_resultados_linea")
      .select("id,item_resultado_id,patron_id,ficha_material_id,pieza_id,grupo_id,grupo_nombre,pieza_nombre,material_id,material_nombre,especificacion,color,um,metodo_consumo,tipo_escalado,orden,necesidad_total")
      .eq("empresa_id", empresaId)
      .in("item_resultado_id", itemIds)
      .order("grupo_nombre", { ascending: true })
      .order("orden", { ascending: true })
      .order("id", { ascending: true })
    if (error) throw error
    lineas = data || []
  }

  const lineaIds = lineas.map(x => x.id)
  let detalles = []
  if (lineaIds.length) {
    const { data, error } = await supabase
      .from("despiece_resultados_talle")
      .select("id,linea_resultado_id,rinde_id,rinde_version,rinde_estado,talle_articulo,talle_componente,pares,consumo_por_par,factor,necesidad")
      .eq("empresa_id", empresaId)
      .in("linea_resultado_id", lineaIds)
      .order("id", { ascending: true })
    if (error) throw error
    detalles = data || []
  }

  const detallesPorLinea = new Map()
  detalles.forEach(d => {
    const key = Number(d.linea_resultado_id)
    if (!detallesPorLinea.has(key)) detallesPorLinea.set(key, [])
    detallesPorLinea.get(key).push(d)
  })

  const lineasPorItem = new Map()
  lineas.forEach(l => {
    const key = Number(l.item_resultado_id)
    if (!lineasPorItem.has(key)) lineasPorItem.set(key, [])
    lineasPorItem.get(key).push({ ...l, talles: detallesPorLinea.get(Number(l.id)) || [] })
  })

  const resumenClasificacion = {
    no_escalados: lineas.filter(l => l.tipo_escalado === "no_escalado").length,
    escalados_alineados: lineas.filter(l => l.tipo_escalado === "escalado_alineado").length,
    escalados_desalineados: lineas.filter(l => l.tipo_escalado === "escalado_desalineado").length,
    total: lineas.length
  }

  return {
    ejecucion,
    clasificacion: resumenClasificacion,
    items: (items || []).map(i => {
      const itemLineas = lineasPorItem.get(Number(i.id)) || []
      return {
        ...i,
        clasificacion: {
          no_escalados: itemLineas.filter(l => l.tipo_escalado === "no_escalado").length,
          escalados_alineados: itemLineas.filter(l => l.tipo_escalado === "escalado_alineado").length,
          escalados_desalineados: itemLineas.filter(l => l.tipo_escalado === "escalado_desalineado").length,
          total: itemLineas.length
        },
        lineas: itemLineas
      }
    })
  }
}

async function cargarPendientes(empresaId) {
  const { data: pedidos, error: pe } = await supabase
    .from("pedidos")
    .select("id,numero,estado,version")
    .eq("empresa_id", empresaId)
    .eq("estado", "confirmado")
  if (pe) throw pe

  if (!pedidos?.length) return []

  const pedidosPorId = new Map(pedidos.map(p => [Number(p.id), p]))
  const { data: snapshots, error: se } = await supabase
    .from("pedido_snapshots")
    .select("id,pedido_id,numero,version,cliente_nombre,sucursal_nombre,fecha_entrega,total_pares,confirmado_at")
    .eq("empresa_id", empresaId)
    .in("pedido_id", pedidos.map(p => p.id))
    .order("confirmado_at", { ascending: false })
  if (se) throw se

  if (!snapshots?.length) return []

  const snapshotsPorId = new Map(snapshots.map(s => [Number(s.id), s]))
  const { data: items, error: ie } = await supabase
    .from("pedido_snapshot_items")
    .select("id,snapshot_id,nro_item,articulo_id,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,fecha_entrega,cantidad_pares,cantidad_pendiente,observaciones")
    .eq("empresa_id", empresaId)
    .in("snapshot_id", snapshots.map(s => s.id))
    .order("snapshot_id", { ascending: false })
    .order("nro_item", { ascending: true })
  if (ie) throw ie

  const { data: asignados, error: ae } = await supabase
    .from("despiece_lote_items")
    .select("snapshot_item_id")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
  if (ae) throw ae

  const setAsignados = new Set((asignados || []).map(x => Number(x.snapshot_item_id)))
  const disponibles = (items || []).filter(i => !setAsignados.has(Number(i.id)))

  return Promise.all(disponibles.map(async item => {
    const snapshot = snapshotsPorId.get(Number(item.snapshot_id))
    const pedido = snapshot ? pedidosPorId.get(Number(snapshot.pedido_id)) : null
    const aptitud = await evaluarAptitudItem(item, empresaId)
    return {
      ...item,
      pedido: pedido ? {
        id: pedido.id,
        numero: pedido.numero,
        version: pedido.version,
        estado: pedido.estado
      } : null,
      snapshot: snapshot || null,
      aptitud
    }
  }))
}

router.get("/pendientes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const items = await cargarPendientes(empresaId)
    return res.json(items)
  } catch (err) {
    console.error("Error obteniendo artículos pendientes de Despiece:", err)
    return res.status(500).json({ error: "Error obteniendo artículos pendientes de Despiece" })
  }
})

router.get("/lotes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const { data: lotes, error: le } = await supabase
      .from("despiece_lotes")
      .select("id,numero,estado,descripcion,observaciones,created_at,updated_at")
      .eq("empresa_id", empresaId)
      .order("numero", { ascending: false })
    if (le) throw le

    if (!lotes?.length) return res.json([])

    const { data: links, error: ie } = await supabase
      .from("despiece_lote_items")
      .select("id,lote_id,snapshot_item_id,activo,created_at")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("lote_id", lotes.map(l => l.id))
    if (ie) throw ie

    const itemIds = [...new Set((links || []).map(l => l.snapshot_item_id))]
    let items = []
    if (itemIds.length) {
      const { data, error } = await supabase
        .from("pedido_snapshot_items")
        .select("id,snapshot_id,nro_item,articulo_id,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,fecha_entrega,cantidad_pares")
        .eq("empresa_id", empresaId)
        .in("id", itemIds)
      if (error) throw error
      items = data || []
    }

    const porId = new Map(items.map(i => [Number(i.id), i]))
    const porLote = new Map()
    ;(links || []).forEach(link => {
      const key = Number(link.lote_id)
      if (!porLote.has(key)) porLote.set(key, [])
      const item = porId.get(Number(link.snapshot_item_id))
      if (item) porLote.get(key).push(item)
    })

    const { data: ejecuciones, error: exe } = await supabase
      .from("despiece_ejecuciones")
      .select("id,lote_id,version,estado,vigente,generado_at")
      .eq("empresa_id", empresaId)
      .eq("vigente", true)
      .in("lote_id", lotes.map(l => l.id))
    if (exe) throw exe
    const ejecucionPorLote = new Map((ejecuciones || []).map(e => [Number(e.lote_id), e]))

    return res.json(lotes.map(lote => {
      const loteItems = porLote.get(Number(lote.id)) || []
      return {
        ...lote,
        items: loteItems,
        total_articulos: loteItems.length,
        total_pares: loteItems.reduce((acc, i) => acc + Number(i.cantidad_pares || 0), 0),
        explosion: ejecucionPorLote.get(Number(lote.id)) || null
      }
    }))
  } catch (err) {
    console.error("Error obteniendo lotes de Despiece:", err)
    return res.status(500).json({ error: "Error obteniendo lotes de Despiece" })
  }
})

router.get("/items/:snapshotItemId/aptitud", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const snapshotItemId = Number(req.params.snapshotItemId)
    if (!snapshotItemId) return res.status(400).json({ error: "Artículo de snapshot inválido" })

    const { data: item, error } = await supabase
      .from("pedido_snapshot_items")
      .select("id,snapshot_id,nro_item,articulo_id,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,fecha_entrega,cantidad_pares,cantidad_pendiente,observaciones")
      .eq("empresa_id", empresaId)
      .eq("id", snapshotItemId)
      .maybeSingle()
    if (error) throw error
    if (!item) return res.status(404).json({ error: "Artículo no encontrado" })

    const aptitud = await evaluarAptitudItem(item, empresaId)
    return res.json({ item, aptitud })
  } catch (err) {
    console.error("Error evaluando aptitud técnica:", err)
    return res.status(500).json({ error: "Error evaluando aptitud técnica" })
  }
})

router.get("/lotes/:loteId/aptitud", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const loteId = Number(req.params.loteId)
    if (!loteId) return res.status(400).json({ error: "Lote inválido" })

    const { data: lote, error: le } = await supabase
      .from("despiece_lotes")
      .select("id,numero,estado,descripcion,observaciones,created_at,updated_at")
      .eq("empresa_id", empresaId)
      .eq("id", loteId)
      .maybeSingle()
    if (le) throw le
    if (!lote) return res.status(404).json({ error: "Lote no encontrado" })

    const { data: links, error: ie } = await supabase
      .from("despiece_lote_items")
      .select("snapshot_item_id")
      .eq("empresa_id", empresaId)
      .eq("lote_id", loteId)
      .eq("activo", true)
    if (ie) throw ie

    const itemIds = (links || []).map(x => Number(x.snapshot_item_id))
    if (!itemIds.length) {
      return res.json({
        lote,
        items: [],
        resumen: { total: 0, aptos: 0, advertencias: 0, bloqueados: 0, pares: 0 },
        estado: "bloqueado",
        puede_generar_despiece: false
      })
    }

    const { data: items, error: pe } = await supabase
      .from("pedido_snapshot_items")
      .select("id,snapshot_id,nro_item,articulo_id,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,fecha_entrega,cantidad_pares,cantidad_pendiente,observaciones")
      .eq("empresa_id", empresaId)
      .in("id", itemIds)
      .order("nro_item", { ascending: true })
    if (pe) throw pe

    const evaluados = await Promise.all((items || []).map(async item => ({
      ...item,
      aptitud: await evaluarAptitudItem(item, empresaId)
    })))

    const resumen = {
      total: evaluados.length,
      aptos: evaluados.filter(x => x.aptitud.estado === "apto").length,
      advertencias: evaluados.filter(x => x.aptitud.estado === "advertencia").length,
      bloqueados: evaluados.filter(x => x.aptitud.estado === "bloqueado").length,
      pares: evaluados.reduce((acc, x) => acc + Number(x.cantidad_pares || 0), 0)
    }

    const estado = resumen.bloqueados
      ? "bloqueado"
      : resumen.advertencias
        ? "advertencia"
        : resumen.total
          ? "apto"
          : "bloqueado"

    return res.json({
      lote,
      items: evaluados,
      resumen,
      estado,
      puede_generar_despiece: estado === "apto"
    })
  } catch (err) {
    console.error("Error evaluando aptitud del lote:", err)
    return res.status(500).json({ error: "Error evaluando aptitud del lote" })
  }
})

router.post("/lotes/:loteId/explotar", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const loteId = Number(req.params.loteId)
    if (!loteId) return res.status(400).json({ error: "Lote inválido" })

    const { data: lote, error: le } = await supabase
      .from("despiece_lotes")
      .select("id,numero,estado,descripcion")
      .eq("empresa_id", empresaId)
      .eq("id", loteId)
      .maybeSingle()
    if (le) throw le
    if (!lote) return res.status(404).json({ error: "Lote no encontrado" })

    const { data: links, error: lie } = await supabase
      .from("despiece_lote_items")
      .select("id,snapshot_item_id")
      .eq("empresa_id", empresaId)
      .eq("lote_id", loteId)
      .eq("activo", true)
      .order("id", { ascending: true })
    if (lie) throw lie
    if (!links?.length) return res.status(409).json({ error: "El lote no tiene artículos activos" })

    const snapshotIds = links.map(x => x.snapshot_item_id)
    const { data: items, error: ie } = await supabase
      .from("pedido_snapshot_items")
      .select("id,snapshot_id,nro_item,articulo_id,articulo_codigo,articulo_modelo,articulo_marca,articulo_color,fecha_entrega,cantidad_pares,cantidad_pendiente,observaciones")
      .eq("empresa_id", empresaId)
      .in("id", snapshotIds)
    if (ie) throw ie

    const itemMap = new Map((items || []).map(i => [Number(i.id), i]))
    const ordenados = links.map(link => ({
      link,
      item: itemMap.get(Number(link.snapshot_item_id))
    }))

    if (ordenados.some(x => !x.item)) {
      return res.status(409).json({ error: "El lote contiene un artículo sin snapshot válido" })
    }

    const evaluados = await Promise.all(ordenados.map(async x => ({
      ...x,
      aptitud: await evaluarAptitudItem(x.item, empresaId)
    })))

    const bloqueados = evaluados.filter(x => x.aptitud.estado !== "apto")
    if (bloqueados.length) {
      return res.status(409).json({
        error: "El lote no está técnicamente apto para generar Despiece",
        bloqueados: bloqueados.map(x => ({
          articulo_codigo: x.item.articulo_codigo,
          articulo_modelo: x.item.articulo_modelo,
          estado: x.aptitud.estado,
          bloqueos: x.aptitud.bloqueos,
          advertencias: x.aptitud.advertencias
        }))
      })
    }

    const resultados = []
    for (const x of evaluados) {
      resultados.push(await calcularExplosionItem(x.item, x.link.id, empresaId))
    }

    const payload = {
      total_pares: resultados.reduce((acc, i) => acc + Number(i.cantidad_pares || 0), 0),
      total_lineas: resultados.reduce((acc, i) => acc + i.lineas.length, 0),
      items: resultados
    }

    const { data: ejecucionId, error: ge } = await supabaseAdmin.rpc("guardar_explosion_despiece", {
      p_empresa_id: empresaId,
      p_lote_id: loteId,
      p_usuario_id: req.user.id,
      p_payload: payload
    })
    if (ge) throw ge

    const explosion = await obtenerExplosionVigente(loteId, empresaId)
    return res.status(201).json({ ok: true, ejecucion_id: Number(ejecucionId), explosion })
  } catch (err) {
    console.error("Error generando explosión de Despiece:", err)
    return res.status(500).json({ error: err.message || "No se pudo generar el Despiece" })
  }
})

router.get("/lotes/:loteId/explosion", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const loteId = Number(req.params.loteId)
    if (!loteId) return res.status(400).json({ error: "Lote inválido" })

    const explosion = await obtenerExplosionVigente(loteId, empresaId)
    if (!explosion) return res.status(404).json({ error: "Este lote todavía no tiene un Despiece calculado" })

    return res.json(explosion)
  } catch (err) {
    console.error("Error consultando explosión de Despiece:", err)
    return res.status(500).json({ error: "No se pudo consultar el Despiece" })
  }
})

router.post("/lotes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const ids = Array.isArray(req.body.snapshot_item_ids)
      ? [...new Set(req.body.snapshot_item_ids.map(Number).filter(Boolean))]
      : []

    if (!ids.length) {
      return res.status(400).json({ error: "Seleccioná al menos un artículo" })
    }

    const { data: loteId, error } = await supabase.rpc("crear_lote_despiece", {
      p_empresa_id: empresaId,
      p_usuario_id: req.user.id,
      p_descripcion: clean(req.body.descripcion),
      p_observaciones: clean(req.body.observaciones),
      p_snapshot_item_ids: ids
    })
    if (error) throw error

    const { data: lote, error: le } = await supabase
      .from("despiece_lotes")
      .select("id,numero,estado,descripcion,observaciones,created_at,updated_at")
      .eq("empresa_id", empresaId)
      .eq("id", Number(loteId))
      .single()
    if (le) throw le

    return res.status(201).json(lote)
  } catch (err) {
    console.error("Error creando lote de Despiece:", err)
    return res.status(409).json({ error: err.message || "No se pudo crear el lote" })
  }
})

router.delete("/lotes/:loteId/items/:snapshotItemId", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const loteId = Number(req.params.loteId)
    const snapshotItemId = Number(req.params.snapshotItemId)
    if (!loteId || !snapshotItemId) return res.status(400).json({ error: "Datos inválidos" })

    const { error } = await supabase.rpc("quitar_item_lote_despiece", {
      p_lote_id: loteId,
      p_snapshot_item_id: snapshotItemId,
      p_empresa_id: empresaId,
      p_usuario_id: req.user.id
    })
    if (error) throw error

    return res.json({ ok: true })
  } catch (err) {
    console.error("Error quitando artículo del lote:", err)
    return res.status(409).json({ error: err.message || "No se pudo quitar el artículo" })
  }
})

module.exports = router
