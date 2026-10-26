const express = require("express")
const router = express.Router()
const { supabaseAdmin } = require("../../config/supabase")

function empresa(req, res) {
  const empresaId = req.user?.empresa_id
  if (!empresaId) {
    res.status(401).json({ ok:false, error:"Empresa no identificada" })
    return null
  }
  return empresaId
}

function n8(v) {
  return Number(Number(v || 0).toFixed(8))
}

async function saldosPorVariantes(empresaId, varianteIds) {
  if (!varianteIds.length) return new Map()

  const { data, error } = await supabaseAdmin
    .from("stock_movimientos")
    .select("id,variante_id,tipo,delta_fisico,delta_reservado,created_at")
    .eq("empresa_id", empresaId)
    .in("variante_id", varianteIds)

  if (error) throw error

  const map = new Map()
  ;(data || []).forEach(m => {
    const id = Number(m.variante_id)
    const actual = map.get(id) || {
      movimientos:0,
      fisico:0,
      reservado:0,
      ultimo_movimiento:null
    }

    actual.movimientos += 1
    actual.fisico = n8(actual.fisico + Number(m.delta_fisico || 0))
    actual.reservado = n8(actual.reservado + Number(m.delta_reservado || 0))

    const fecha = m.created_at ? new Date(m.created_at) : null
    if (fecha && (!actual.ultimo_movimiento || fecha > new Date(actual.ultimo_movimiento))) {
      actual.ultimo_movimiento = m.created_at
    }

    map.set(id, actual)
  })

  return map
}

router.get("/variantes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const { data: variantes, error } = await supabaseAdmin
      .from("material_variantes")
      .select("id,material_id,especificacion,color,um,activo,materiales_maestro(nombre,familia,origen)")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("id", { ascending:true })

    if (error) throw error

    const saldoMap = await saldosPorVariantes(
      empresaId,
      (variantes || []).map(v => Number(v.id))
    )

    return res.json((variantes || []).map(v => {
      const saldo = saldoMap.get(Number(v.id)) || null
      const fisico = saldo ? n8(saldo.fisico) : null
      const reservado = saldo ? n8(saldo.reservado) : null
      const disponible = saldo ? n8(fisico - reservado) : null

      return {
        id:Number(v.id),
        material_id:Number(v.material_id),
        material_nombre:v.materiales_maestro?.nombre || "MATERIAL",
        familia:v.materiales_maestro?.familia || "",
        origen:v.materiales_maestro?.origen || "",
        especificacion:v.especificacion || "",
        color:v.color || "",
        um:v.um,
        stock_registrado:!!saldo,
        stock_fisico:fisico,
        stock_reservado:reservado,
        stock_disponible:disponible,
        ultimo_movimiento:saldo?.ultimo_movimiento || null
      }
    }))
  } catch (err) {
    console.error("Error listando variantes de Stock:", err)
    return res.status(500).json({ error:err.message || "No se pudo consultar Stock" })
  }
})

router.post("/variantes/:varianteId/saldo-inicial", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const varianteId = Number(req.params.varianteId)
    const cantidad = Number(req.body?.cantidad)

    if (!varianteId || !Number.isFinite(cantidad) || cantidad < 0) {
      return res.status(400).json({ error:"Cantidad de saldo inicial inválida" })
    }

    const { data: variante, error: ve } = await supabaseAdmin
      .from("material_variantes")
      .select("id,material_id,especificacion,color,um")
      .eq("empresa_id", empresaId)
      .eq("id", varianteId)
      .maybeSingle()

    if (ve) throw ve
    if (!variante) return res.status(404).json({ error:"Variante de material no encontrada" })

    const { data: movimientoId, error: me } = await supabaseAdmin.rpc("registrar_movimiento_stock", {
      p_empresa_id:empresaId,
      p_variante_id:varianteId,
      p_tipo:"saldo_inicial",
      p_delta_fisico:n8(cantidad),
      p_delta_reservado:0,
      p_referencia_tipo:"carga_inicial",
      p_referencia_id:null,
      p_observacion:String(req.body?.observacion || "").trim() || null,
      p_usuario_id:req.user?.id || null
    })

    if (me) {
      if (/saldo inicial|primer movimiento/i.test(me.message || "")) {
        return res.status(409).json({
          error:"Este material ya tiene movimientos. Los cambios posteriores deben registrarse como ajustes para conservar trazabilidad."
        })
      }
      throw me
    }

    return res.status(201).json({ ok:true, movimiento_id:Number(movimientoId) })
  } catch (err) {
    console.error("Error registrando saldo inicial:", err)
    return res.status(500).json({ error:err.message || "No se pudo registrar el saldo inicial" })
  }
})

router.post("/variantes/:varianteId/movimientos", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const varianteId = Number(req.params.varianteId)
    const tipoUi = String(req.body?.tipo || "").trim()
    const cantidad = Number(req.body?.cantidad)
    const observacion = String(req.body?.observacion || "").trim()
    const referencia = String(req.body?.referencia || "").trim()

    if (!varianteId) return res.status(400).json({ error:"Variante inválida" })
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error:"La cantidad debe ser mayor que cero" })
    }

    const { data: variante, error: ve } = await supabaseAdmin
      .from("material_variantes")
      .select("id,um")
      .eq("empresa_id", empresaId)
      .eq("id", varianteId)
      .eq("activo", true)
      .maybeSingle()

    if (ve) throw ve
    if (!variante) return res.status(404).json({ error:"Variante de material no encontrada" })

    let tipo
    let deltaFisico = 0
    let deltaReservado = 0
    let referenciaTipo = "movimiento_manual"

    if (tipoUi === "ingreso") {
      tipo = "ingreso_compra"
      deltaFisico = cantidad
      referenciaTipo = "ingreso_manual"
    } else if (tipoUi === "salida") {
      tipo = "otro"
      deltaFisico = -cantidad
      referenciaTipo = "salida_manual"
      if (!observacion) {
        return res.status(400).json({ error:"Indicá el motivo de la salida manual" })
      }
    } else if (tipoUi === "ajuste_positivo") {
      tipo = "ajuste"
      deltaFisico = cantidad
      referenciaTipo = "ajuste_inventario"
      if (!observacion) {
        return res.status(400).json({ error:"Indicá el motivo del ajuste" })
      }
    } else if (tipoUi === "ajuste_negativo") {
      tipo = "ajuste"
      deltaFisico = -cantidad
      referenciaTipo = "ajuste_inventario"
      if (!observacion) {
        return res.status(400).json({ error:"Indicá el motivo del ajuste" })
      }
    } else if (tipoUi === "devolucion") {
      tipo = "devolucion"
      deltaFisico = cantidad
      referenciaTipo = "devolucion_manual"
      if (!observacion) {
        return res.status(400).json({ error:"Indicá el motivo de la devolución" })
      }
    } else {
      return res.status(400).json({ error:"Tipo de movimiento no permitido en carga manual" })
    }

    const { data: movimientoId, error: me } = await supabaseAdmin.rpc("registrar_movimiento_stock", {
      p_empresa_id:empresaId,
      p_variante_id:varianteId,
      p_tipo:tipo,
      p_delta_fisico:n8(deltaFisico),
      p_delta_reservado:n8(deltaReservado),
      p_referencia_tipo:referenciaTipo,
      p_referencia_id:referencia || null,
      p_observacion:observacion || null,
      p_usuario_id:req.user?.id || null
    })

    if (me) {
      const mensaje = me.message || "No se pudo registrar el movimiento"
      if (/negativo|reservado|superar|movimiento no puede ser cero/i.test(mensaje)) {
        return res.status(409).json({ error:mensaje })
      }
      throw me
    }

    return res.status(201).json({
      ok:true,
      movimiento_id:Number(movimientoId),
      tipo,
      delta_fisico:n8(deltaFisico),
      delta_reservado:n8(deltaReservado)
    })
  } catch (err) {
    console.error("Error registrando movimiento manual de Stock:", err)
    return res.status(500).json({ error:err.message || "No se pudo registrar el movimiento" })
  }
})

router.get("/variantes/:varianteId/parametros-compra", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const varianteId = Number(req.params.varianteId)
    if (!varianteId) return res.status(400).json({ error:"Variante inválida" })

    const { data: variante, error: ve } = await supabaseAdmin
      .from("material_variantes")
      .select("id,material_id,especificacion,color,um")
      .eq("empresa_id", empresaId)
      .eq("id", varianteId)
      .maybeSingle()

    if (ve) throw ve
    if (!variante) return res.status(404).json({ error:"Variante de material no encontrada" })

    const { data: parametros, error: pe } = await supabaseAdmin
      .from("material_compra_parametros")
      .select("id,variante_id,unidad_compra,factor_conversion,compra_minima,plazo_entrega_dias,activo,created_at,updated_at")
      .eq("empresa_id", empresaId)
      .eq("variante_id", varianteId)
      .eq("activo", true)
      .maybeSingle()

    if (pe) throw pe
    return res.json({ variante, parametros: parametros || null })
  } catch (err) {
    console.error("Error consultando parámetros de compra:", err)
    return res.status(500).json({ error:err.message || "No se pudieron consultar los parámetros de compra" })
  }
})

router.put("/variantes/:varianteId/parametros-compra", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const varianteId = Number(req.params.varianteId)
    const unidadCompra = String(req.body?.unidad_compra || "").trim().toUpperCase()
    const factorConversion = Number(req.body?.factor_conversion)
    const compraMinima = Number(req.body?.compra_minima ?? 0)
    const plazoRaw = req.body?.plazo_entrega_dias
    const plazoEntregaDias = plazoRaw === "" || plazoRaw === null || plazoRaw === undefined
      ? null
      : Number(plazoRaw)

    if (!varianteId) return res.status(400).json({ error:"Variante inválida" })
    if (!unidadCompra) return res.status(400).json({ error:"Definí la unidad de compra" })
    if (!Number.isFinite(factorConversion) || factorConversion <= 0) {
      return res.status(400).json({ error:"El factor de conversión debe ser mayor que cero" })
    }
    if (!Number.isFinite(compraMinima) || compraMinima < 0) {
      return res.status(400).json({ error:"La compra mínima no puede ser negativa" })
    }
    if (plazoEntregaDias !== null && (!Number.isInteger(plazoEntregaDias) || plazoEntregaDias < 0)) {
      return res.status(400).json({ error:"El plazo de entrega debe ser un número entero de días" })
    }

    const { data: variante, error: ve } = await supabaseAdmin
      .from("material_variantes")
      .select("id,um")
      .eq("empresa_id", empresaId)
      .eq("id", varianteId)
      .maybeSingle()

    if (ve) throw ve
    if (!variante) return res.status(404).json({ error:"Variante de material no encontrada" })

    const payload = {
      empresa_id:empresaId,
      variante_id:varianteId,
      unidad_compra:unidadCompra,
      factor_conversion:n8(factorConversion),
      compra_minima:n8(compraMinima),
      plazo_entrega_dias:plazoEntregaDias,
      activo:true,
      updated_at:new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from("material_compra_parametros")
      .upsert(payload, { onConflict:"empresa_id,variante_id" })
      .select("id,variante_id,unidad_compra,factor_conversion,compra_minima,plazo_entrega_dias,activo,created_at,updated_at")
      .single()

    if (error) throw error
    return res.json({ ok:true, parametros:data })
  } catch (err) {
    console.error("Error guardando parámetros de compra:", err)
    return res.status(500).json({ error:err.message || "No se pudieron guardar los parámetros de compra" })
  }
})

router.get("/variantes/:varianteId/movimientos", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const varianteId = Number(req.params.varianteId)
    if (!varianteId) return res.status(400).json({ error:"Variante inválida" })

    const { data, error } = await supabaseAdmin
      .from("stock_movimientos")
      .select("id,tipo,delta_fisico,delta_reservado,referencia_tipo,referencia_id,observacion,usuario_id,created_at")
      .eq("empresa_id", empresaId)
      .eq("variante_id", varianteId)
      .order("created_at", { ascending:false })
      .order("id", { ascending:false })

    if (error) throw error

    const usuarioIds = [...new Set((data || []).map(m => Number(m.usuario_id)).filter(Boolean))]
    let usuariosMap = new Map()

    if (usuarioIds.length) {
      const { data: usuarios, error: ue } = await supabaseAdmin
        .from("usuarios")
        .select("id,nombre,email")
        .eq("empresa_id", empresaId)
        .in("id", usuarioIds)

      if (ue) throw ue
      usuariosMap = new Map((usuarios || []).map(u => [Number(u.id), u.nombre || u.email || `Usuario ${u.id}`]))
    }

    let saldoFisico = 0
    let saldoReservado = 0
    const cronologico = [...(data || [])].reverse().map(m => {
      saldoFisico = n8(saldoFisico + Number(m.delta_fisico || 0))
      saldoReservado = n8(saldoReservado + Number(m.delta_reservado || 0))
      return {
        ...m,
        usuario_nombre:m.usuario_id ? (usuariosMap.get(Number(m.usuario_id)) || `Usuario ${m.usuario_id}`) : "Sistema",
        saldo_fisico_resultante:saldoFisico,
        saldo_reservado_resultante:saldoReservado,
        saldo_disponible_resultante:n8(saldoFisico - saldoReservado)
      }
    })

    return res.json(cronologico.reverse())
  } catch (err) {
    console.error("Error consultando movimientos de Stock:", err)
    return res.status(500).json({ error:"No se pudieron consultar los movimientos" })
  }
})

module.exports = router
