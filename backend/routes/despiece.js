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

function clean(v) {
  return typeof v === "string" ? v.trim() : ""
}

async function evaluarAptitudItem(item, empresaId) {
  const bloqueos = []
  const advertencias = []

  const { data: curva, error: ce } = await supabase
    .from("pedido_snapshot_talles")
    .select("talle,cantidad,cantidad_pendiente,orden")
    .eq("empresa_id", empresaId)
    .eq("snapshot_item_id", item.id)
    .order("orden", { ascending: true })
  if (ce) throw ce

  const tallesPedido = (curva || [])
    .filter(t => Number(t.cantidad || 0) > 0)
    .map(t => String(t.talle))

  if (!tallesPedido.length) {
    bloqueos.push("El artículo no tiene curva congelada en el snapshot")
  }

  const { data: patrones, error: pe } = await supabase
    .from("patrones")
    .select("id,pieza,material_id,material,um,metodo_consumo,tipo_escalado,escala_confirmada,consumo_por_par,activo")
    .eq("empresa_id", empresaId)
    .eq("articulo_id", item.articulo_id)
    .eq("activo", true)
    .order("orden", { ascending: true })
  if (pe) throw pe

  if (!patrones?.length) {
    bloqueos.push("Falta Patrón Técnico")
    return {
      estado: "bloqueado",
      bloqueos,
      advertencias,
      resumen: { lineas_patron: 0, rindes_vigentes: 0, talles_pedido: tallesPedido.length }
    }
  }

  const sinMaterial = patrones.filter(p => !p.material_id)
  if (sinMaterial.length) {
    bloqueos.push(`${sinMaterial.length} línea(s) del patrón no tienen material del Maestro asignado`)
  }

  const escaladosSinConfirmar = patrones.filter(
    p => p.tipo_escalado !== "no_escalado" && p.escala_confirmada !== true
  )
  if (escaladosSinConfirmar.length) {
    bloqueos.push(`${escaladosSinConfirmar.length} componente(s) escalado(s) tienen la escala pendiente de confirmar`)
  }

  const desalineados = patrones.filter(p => p.tipo_escalado === "escalado_desalineado")
  if (desalineados.length && tallesPedido.length) {
    const ids = desalineados.map(p => p.id)
    const { data: equivalencias, error: ee } = await supabase
      .from("despiece_equivalencias_escala")
      .select("fuente_id,talle_articulo,talle_componente,activo")
      .eq("empresa_id", empresaId)
      .eq("articulo_id", item.articulo_id)
      .eq("fuente_tipo", "patron")
      .eq("activo", true)
      .in("fuente_id", ids)
    if (ee) throw ee

    const eqSet = new Set((equivalencias || []).map(e => `${e.fuente_id}::${e.talle_articulo}`))
    let faltantes = 0
    desalineados.forEach(p => {
      tallesPedido.forEach(t => {
        if (!eqSet.has(`${p.id}::${t}`)) faltantes += 1
      })
    })
    if (faltantes) {
      bloqueos.push(`Faltan ${faltantes} equivalencia(s) de escala para componentes desalineados`)
    }
  }

  const lineasRinde = patrones.filter(p => (p.metodo_consumo || "rinde") === "rinde")
  let rindesVigentes = []

  if (lineasRinde.length && tallesPedido.length) {
    const { data: rindes, error: re } = await supabase
      .from("rindes")
      .select("id,patron_id,talle,consumo_por_par,estado,vigente")
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

    let faltantes = 0
    lineasRinde.forEach(p => {
      tallesPedido.forEach(t => {
        if (!rindeSet.has(`${p.id}::${t}`)) faltantes += 1
      })
    })

    if (faltantes) {
      bloqueos.push(`Faltan ${faltantes} rinde(s) vigente(s) para los talles pedidos`)
    }
  }

  const directosIncompletos = patrones.filter(
    p => p.metodo_consumo === "directo" && !(Number(p.consumo_por_par || 0) > 0)
  )
  if (directosIncompletos.length) {
    bloqueos.push(`${directosIncompletos.length} línea(s) de consumo directo no tienen consumo por par definido`)
  }

  return {
    estado: bloqueos.length ? "bloqueado" : advertencias.length ? "advertencia" : "apto",
    bloqueos,
    advertencias,
    resumen: {
      lineas_patron: patrones.length,
      rindes_vigentes: rindesVigentes.length,
      talles_pedido: tallesPedido.length,
      escalados_alineados: patrones.filter(p => p.tipo_escalado === "escalado_alineado").length,
      escalados_desalineados: desalineados.length
    }
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

    return res.json(lotes.map(lote => {
      const loteItems = porLote.get(Number(lote.id)) || []
      return {
        ...lote,
        items: loteItems,
        total_articulos: loteItems.length,
        total_pares: loteItems.reduce((acc, i) => acc + Number(i.cantidad_pares || 0), 0)
      }
    }))
  } catch (err) {
    console.error("Error obteniendo lotes de Despiece:", err)
    return res.status(500).json({ error: "Error obteniendo lotes de Despiece" })
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
