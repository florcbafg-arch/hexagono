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

function clean(value) {
  return typeof value === "string" ? value.trim() : ""
}

function fechaValida(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(value))
}

function numeroPedido(id) {
  return String(id).padStart(6, "0")
}

async function obtenerClienteSucursal(empresaId, clienteId, sucursalId) {
  const { data, error } = await supabase
    .from("cliente_sucursales")
    .select("id, cliente_id, empresa_id, codigo, nombre, activo")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("id", sucursalId)
    .eq("activo", true)
    .maybeSingle()
  if (error) throw error
  return data
}

async function obtenerUsuarioPropio(empresaId, usuarioId) {
  if (!usuarioId) return null
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, activo")
    .eq("empresa_id", empresaId)
    .eq("id", usuarioId)
    .eq("activo", true)
    .maybeSingle()
  if (error) throw error
  return data
}

async function enriquecerPedidos(pedidos, empresaId) {
  if (!pedidos?.length) return []

  const clienteIds = [...new Set(pedidos.map(p => p.cliente_id).filter(Boolean))]
  const sucursalIds = [...new Set(pedidos.map(p => p.cliente_sucursal_id).filter(Boolean))]
  const usuarioIds = [...new Set(pedidos.map(p => p.vendedor_id).filter(Boolean))]

  const [{ data: clientes, error: ce }, { data: sucursales, error: se }, { data: usuarios, error: ue }] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id,codigo,nombre").eq("empresa_id", empresaId).in("id", clienteIds)
      : Promise.resolve({ data: [], error: null }),
    sucursalIds.length
      ? supabase.from("cliente_sucursales").select("id,codigo,nombre,cliente_id").eq("empresa_id", empresaId).in("id", sucursalIds)
      : Promise.resolve({ data: [], error: null }),
    usuarioIds.length
      ? supabase.from("usuarios").select("id,nombre").eq("empresa_id", empresaId).in("id", usuarioIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (ce) throw ce
  if (se) throw se
  if (ue) throw ue

  const cm = new Map((clientes || []).map(x => [Number(x.id), x]))
  const sm = new Map((sucursales || []).map(x => [Number(x.id), x]))
  const um = new Map((usuarios || []).map(x => [Number(x.id), x]))

  return pedidos.map(p => ({
    ...p,
    cliente: cm.get(Number(p.cliente_id)) || null,
    sucursal: sm.get(Number(p.cliente_sucursal_id)) || null,
    vendedor: um.get(Number(p.vendedor_id)) || null
  }))
}

// ==========================
// CLIENTES / SUCURSALES
// ==========================
router.get("/clientes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const [{ data: clientes, error: ce }, { data: sucursales, error: se }] = await Promise.all([
      supabase
        .from("clientes")
        .select("id,codigo,nombre,activo")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("cliente_sucursales")
        .select("id,cliente_id,codigo,nombre,activo")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("nombre", { ascending: true })
    ])
    if (ce) throw ce
    if (se) throw se

    const sucPorCliente = new Map()
    ;(sucursales || []).forEach(s => {
      const key = Number(s.cliente_id)
      if (!sucPorCliente.has(key)) sucPorCliente.set(key, [])
      sucPorCliente.get(key).push(s)
    })

    return res.json((clientes || []).map(c => ({
      ...c,
      sucursales: sucPorCliente.get(Number(c.id)) || []
    })))
  } catch (err) {
    console.error("Error listando clientes:", err)
    return res.status(500).json({ error: "Error listando clientes" })
  }
})

router.post("/clientes", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const codigo = clean(req.body.codigo)
    const nombre = clean(req.body.nombre)
    const sucursalCodigo = clean(req.body.sucursal_codigo) || "1"
    const sucursalNombre = clean(req.body.sucursal_nombre) || "CASA CENTRAL"

    if (!codigo || !nombre) {
      return res.status(400).json({ error: "Código y nombre del cliente son obligatorios" })
    }

    const { data: cliente, error: ce } = await supabase
      .from("clientes")
      .insert({
        empresa_id: empresaId,
        codigo,
        nombre,
        activo: true
      })
      .select("id,codigo,nombre,activo")
      .single()

    if (ce?.code === "23505") {
      return res.status(409).json({ error: "Ya existe un cliente con ese código" })
    }
    if (ce) throw ce

    const { data: sucursal, error: se } = await supabase
      .from("cliente_sucursales")
      .insert({
        empresa_id: empresaId,
        cliente_id: cliente.id,
        codigo: sucursalCodigo,
        nombre: sucursalNombre,
        activo: true
      })
      .select("id,cliente_id,codigo,nombre,activo")
      .single()

    if (se) {
      await supabase.from("clientes").delete().eq("id", cliente.id).eq("empresa_id", empresaId)
      throw se
    }

    return res.status(201).json({ ...cliente, sucursales: [sucursal] })
  } catch (err) {
    console.error("Error creando cliente:", err)
    return res.status(500).json({ error: "Error creando cliente" })
  }
})

router.post("/clientes/:clienteId/sucursales", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const clienteId = Number(req.params.clienteId)
    const codigo = clean(req.body.codigo)
    const nombre = clean(req.body.nombre)
    if (!clienteId || !codigo || !nombre) {
      return res.status(400).json({ error: "Cliente, código y nombre de sucursal son obligatorios" })
    }

    const { data: cliente, error: ce } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .maybeSingle()
    if (ce) throw ce
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" })

    const { data, error } = await supabase
      .from("cliente_sucursales")
      .insert({ empresa_id: empresaId, cliente_id: clienteId, codigo, nombre, activo: true })
      .select("id,cliente_id,codigo,nombre,activo")
      .single()

    if (error?.code === "23505") {
      return res.status(409).json({ error: "Ya existe una sucursal con ese código para el cliente" })
    }
    if (error) throw error

    return res.status(201).json(data)
  } catch (err) {
    console.error("Error creando sucursal:", err)
    return res.status(500).json({ error: "Error creando sucursal" })
  }
})

router.get("/vendedores", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id,nombre,rol")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("nombre", { ascending: true })
    if (error) throw error
    return res.json(data || [])
  } catch (err) {
    console.error("Error listando vendedores:", err)
    return res.status(500).json({ error: "Error listando usuarios" })
  }
})

// ==========================
// PEDIDOS — FASE 1.4.1
// ==========================
router.get("/", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id,numero,cliente_id,cliente_sucursal_id,fecha_carga,fecha_entrega,vendedor_id,solicitado_por,referencia_cliente,observaciones,estado,version,codigo_legacy,created_at,updated_at")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false })
    if (error) throw error

    return res.json(await enriquecerPedidos(data || [], empresaId))
  } catch (err) {
    console.error("Error listando pedidos:", err)
    return res.status(500).json({ error: "Error listando pedidos" })
  }
})

router.get("/:id", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: "Pedido inválido" })

    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: "Pedido no encontrado" })

    const [pedido] = await enriquecerPedidos([data], empresaId)
    return res.json(pedido)
  } catch (err) {
    console.error("Error obteniendo pedido:", err)
    return res.status(500).json({ error: "Error obteniendo pedido" })
  }
})

router.post("/", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const clienteId = Number(req.body.cliente_id)
    const sucursalId = Number(req.body.cliente_sucursal_id)
    const fechaEntrega = clean(req.body.fecha_entrega)
    const vendedorId = Number(req.body.vendedor_id) || req.user.id

    if (!clienteId || !sucursalId || !fechaValida(fechaEntrega)) {
      return res.status(400).json({ error: "Cliente, sucursal y fecha de entrega son obligatorios" })
    }

    const sucursal = await obtenerClienteSucursal(empresaId, clienteId, sucursalId)
    if (!sucursal) return res.status(400).json({ error: "La sucursal no pertenece al cliente seleccionado" })

    const vendedor = await obtenerUsuarioPropio(empresaId, vendedorId)
    if (!vendedor) return res.status(400).json({ error: "Vendedor inválido" })

    const { data: creado, error: ie } = await supabase
      .from("pedidos")
      .insert({
        empresa_id: empresaId,
        numero: null,
        cliente_id: clienteId,
        cliente_sucursal_id: sucursalId,
        fecha_entrega: fechaEntrega,
        vendedor_id: vendedorId,
        solicitado_por: clean(req.body.solicitado_por) || null,
        referencia_cliente: clean(req.body.referencia_cliente) || null,
        observaciones: clean(req.body.observaciones) || null,
        estado: "borrador",
        version: 1,
        codigo_legacy: "F",
        creado_por: req.user.id,
        actualizado_por: req.user.id
      })
      .select("*")
      .single()
    if (ie) throw ie

    const numero = numeroPedido(creado.id)
    const { data: pedido, error: ue } = await supabase
      .from("pedidos")
      .update({
        numero,
        pedido_raiz_id: creado.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", creado.id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single()
    if (ue) throw ue

    const [enriquecido] = await enriquecerPedidos([pedido], empresaId)
    return res.status(201).json(enriquecido)
  } catch (err) {
    console.error("Error creando pedido:", err)
    return res.status(500).json({ error: "Error creando pedido" })
  }
})

router.put("/:id", async (req, res) => {
  const empresaId = empresa(req, res)
  if (!empresaId) return

  try {
    const id = Number(req.params.id)
    const clienteId = Number(req.body.cliente_id)
    const sucursalId = Number(req.body.cliente_sucursal_id)
    const fechaEntrega = clean(req.body.fecha_entrega)
    const vendedorId = Number(req.body.vendedor_id) || req.user.id

    if (!id || !clienteId || !sucursalId || !fechaValida(fechaEntrega)) {
      return res.status(400).json({ error: "Pedido, cliente, sucursal y fecha de entrega son obligatorios" })
    }

    const { data: actual, error: ae } = await supabase
      .from("pedidos")
      .select("id,estado")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle()
    if (ae) throw ae
    if (!actual) return res.status(404).json({ error: "Pedido no encontrado" })
    if (actual.estado !== "borrador") {
      return res.status(409).json({ error: "Solo los pedidos en borrador pueden editarse directamente" })
    }

    const sucursal = await obtenerClienteSucursal(empresaId, clienteId, sucursalId)
    if (!sucursal) return res.status(400).json({ error: "La sucursal no pertenece al cliente seleccionado" })

    const vendedor = await obtenerUsuarioPropio(empresaId, vendedorId)
    if (!vendedor) return res.status(400).json({ error: "Vendedor inválido" })

    const { data, error } = await supabase
      .from("pedidos")
      .update({
        cliente_id: clienteId,
        cliente_sucursal_id: sucursalId,
        fecha_entrega: fechaEntrega,
        vendedor_id: vendedorId,
        solicitado_por: clean(req.body.solicitado_por) || null,
        referencia_cliente: clean(req.body.referencia_cliente) || null,
        observaciones: clean(req.body.observaciones) || null,
        actualizado_por: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single()
    if (error) throw error

    const [enriquecido] = await enriquecerPedidos([data], empresaId)
    return res.json(enriquecido)
  } catch (err) {
    console.error("Error editando pedido:", err)
    return res.status(500).json({ error: "Error editando pedido" })
  }
})

module.exports = router
