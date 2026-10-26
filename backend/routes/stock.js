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

    const { data: existente, error: ee } = await supabaseAdmin
      .from("stock_movimientos")
      .select("id,delta_fisico,created_at")
      .eq("empresa_id", empresaId)
      .eq("variante_id", varianteId)
      .eq("tipo", "saldo_inicial")
      .maybeSingle()

    if (ee) throw ee
    if (existente) {
      return res.status(409).json({
        error:"Este material ya tiene saldo inicial. Los cambios posteriores deben registrarse como ajustes para conservar trazabilidad."
      })
    }

    const { data: movimiento, error: me } = await supabaseAdmin
      .from("stock_movimientos")
      .insert({
        empresa_id:empresaId,
        variante_id:varianteId,
        tipo:"saldo_inicial",
        delta_fisico:n8(cantidad),
        delta_reservado:0,
        referencia_tipo:"carga_inicial",
        observacion:String(req.body?.observacion || "").trim() || null,
        usuario_id:req.user?.id || null
      })
      .select("id,variante_id,tipo,delta_fisico,delta_reservado,created_at")
      .single()

    if (me) throw me

    return res.status(201).json({ ok:true, movimiento })
  } catch (err) {
    console.error("Error registrando saldo inicial:", err)
    return res.status(500).json({ error:err.message || "No se pudo registrar el saldo inicial" })
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
    return res.json(data || [])
  } catch (err) {
    console.error("Error consultando movimientos de Stock:", err)
    return res.status(500).json({ error:"No se pudieron consultar los movimientos" })
  }
})

module.exports = router
