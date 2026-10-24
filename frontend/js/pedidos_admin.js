window.initPedidos = function () {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token }
  const $ = id => document.getElementById(id)
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))
  let clientes = []
  let vendedores = []
  let pedidos = []
  let guardando = false

  async function api(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "No se pudo completar la operación")
    return data
  }

  function mensaje(texto, error = false) {
    const box = $("pedidosMensaje")
    box.textContent = texto
    box.classList.toggle("error", error)
    box.hidden = false
    clearTimeout(mensaje.timer)
    mensaje.timer = setTimeout(() => { box.hidden = true }, 4200)
  }

  function hoyLocal() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  function fechaVista(v) {
    if (!v) return "—"
    const [y,m,d] = String(v).split("-")
    return y && m && d ? `${d}/${m}/${y}` : v
  }

  function renderClientes(seleccionarId = null) {
    $("pedidoCliente").innerHTML = '<option value="">Seleccionar cliente</option>' + clientes.map(c =>
      `<option value="${c.id}">${esc(c.codigo)} · ${esc(c.nombre)}</option>`
    ).join("")
    if (seleccionarId) $("pedidoCliente").value = String(seleccionarId)
    renderSucursales()
  }

  function renderSucursales(seleccionarId = null) {
    const cliente = clientes.find(c => Number(c.id) === Number($("pedidoCliente").value))
    const sucursales = cliente?.sucursales || []
    $("pedidoSucursal").innerHTML = '<option value="">Seleccionar sucursal</option>' + sucursales.map(s =>
      `<option value="${s.id}">${esc(s.codigo)} · ${esc(s.nombre)}</option>`
    ).join("")
    if (seleccionarId) $("pedidoSucursal").value = String(seleccionarId)
    else if (sucursales.length === 1) $("pedidoSucursal").value = String(sucursales[0].id)
  }

  function renderVendedores(seleccionarId = null) {
    $("pedidoVendedor").innerHTML = vendedores.map(v =>
      `<option value="${v.id}">${esc(v.nombre)}${v.rol ? " · " + esc(v.rol) : ""}</option>`
    ).join("")
    if (seleccionarId) $("pedidoVendedor").value = String(seleccionarId)
    else {
      const user = JSON.parse(localStorage.getItem("hexagono_user") || "{}")
      if (user?.id) $("pedidoVendedor").value = String(user.id)
    }
  }

  function renderPedidos() {
    $("pedidosTotal").textContent = pedidos.length
    $("pedidosBorradores").textContent = pedidos.filter(p => p.estado === "borrador").length
    $("pedidosConfirmados").textContent = pedidos.filter(p => p.estado === "confirmado").length
    $("pedidosVacio").hidden = pedidos.length > 0

    $("pedidosTabla").innerHTML = pedidos.map(p => `
      <tr>
        <td><strong>${esc(p.numero || "—")}</strong></td>
        <td>${esc(p.cliente?.nombre || "—")}</td>
        <td>${esc(p.sucursal?.nombre || "—")}</td>
        <td>${fechaVista(p.fecha_carga)}</td>
        <td><strong>${fechaVista(p.fecha_entrega)}</strong></td>
        <td>${esc(p.vendedor?.nombre || "—")}</td>
        <td>V${esc(p.version)}</td>
        <td><span class="pedido-chip ${p.estado === "confirmado" ? "confirmado" : ""}">${esc(String(p.estado || "").toUpperCase())}</span></td>
        <td><button class="pedidos-link" data-edit-pedido="${p.id}">Abrir</button></td>
      </tr>`).join("")

    document.querySelectorAll("[data-edit-pedido]").forEach(b => {
      b.onclick = () => abrirPedido(pedidos.find(p => Number(p.id) === Number(b.dataset.editPedido)))
    })
  }

  async function cargarBase() {
    const [cs, vs, ps] = await Promise.all([
      api("/api/pedidos/clientes"),
      api("/api/pedidos/vendedores"),
      api("/api/pedidos")
    ])
    clientes = cs || []
    vendedores = vs || []
    pedidos = ps || []
    renderClientes()
    renderVendedores()
    renderPedidos()
  }

  function abrirPedido(pedido = null) {
    $("formPedido").reset()
    $("pedidoId").value = pedido?.id || ""
    $("pedidoModalTitulo").textContent = pedido ? "Editar pedido" : "Nuevo pedido"
    $("pedidoNumeroVista").textContent = pedido?.numero ? `Pedido N.º ${pedido.numero}` : "N.º automático al guardar"
    $("pedidoEstadoVista").textContent = pedido ? `${String(pedido.estado).toUpperCase()} · V${pedido.version}` : "BORRADOR · V1"
    $("pedidoFechaCarga").value = pedido?.fecha_carga || hoyLocal()
    $("pedidoFechaEntrega").value = pedido?.fecha_entrega || ""
    renderClientes(pedido?.cliente_id || null)
    if (pedido?.cliente_id) renderSucursales(pedido.cliente_sucursal_id)
    renderVendedores(pedido?.vendedor_id || null)
    $("pedidoSolicitado").value = pedido?.solicitado_por || ""
    $("pedidoReferencia").value = pedido?.referencia_cliente || ""
    $("pedidoObservaciones").value = pedido?.observaciones || ""
    $("modalPedido").showModal()
  }

  $("btnNuevoPedido").onclick = () => abrirPedido()
  $("pedidoCliente").onchange = () => renderSucursales()
  $("btnNuevoCliente").onclick = () => {
    $("formCliente").reset()
    $("clienteSucursalCodigo").value = "1"
    $("clienteSucursalNombre").value = "CASA CENTRAL"
    $("modalCliente").showModal()
  }

  $("btnNuevaSucursal").onclick = () => {
    const cliente = clientes.find(c => Number(c.id) === Number($("pedidoCliente").value))
    if (!cliente) return mensaje("Seleccioná primero un cliente.", true)
    $("formSucursal").reset()
    $("sucursalClienteNombre").textContent = cliente.nombre
    $("modalSucursal").showModal()
  }

  document.querySelectorAll("[data-close]").forEach(b => {
    b.onclick = () => $(b.dataset.close)?.close()
  })

  $("formCliente").onsubmit = async e => {
    e.preventDefault()
    try {
      const creado = await api("/api/pedidos/clientes", {
        method: "POST",
        body: JSON.stringify({
          codigo: $("clienteCodigo").value,
          nombre: $("clienteNombre").value,
          sucursal_codigo: $("clienteSucursalCodigo").value,
          sucursal_nombre: $("clienteSucursalNombre").value
        })
      })
      $("modalCliente").close()
      clientes.push(creado)
      clientes.sort((a,b) => a.nombre.localeCompare(b.nombre))
      renderClientes(creado.id)
      mensaje("Cliente creado con su sucursal.")
    } catch (err) { mensaje(err.message, true) }
  }

  $("formSucursal").onsubmit = async e => {
    e.preventDefault()
    const clienteId = Number($("pedidoCliente").value)
    try {
      const creada = await api(`/api/pedidos/clientes/${clienteId}/sucursales`, {
        method: "POST",
        body: JSON.stringify({ codigo: $("sucursalCodigo").value, nombre: $("sucursalNombre").value })
      })
      $("modalSucursal").close()
      const cliente = clientes.find(c => Number(c.id) === clienteId)
      cliente.sucursales = [...(cliente.sucursales || []), creada]
      renderSucursales(creada.id)
      mensaje("Sucursal creada.")
    } catch (err) { mensaje(err.message, true) }
  }

  $("formPedido").onsubmit = async e => {
    e.preventDefault()
    if (guardando) return

    const id = Number($("pedidoId").value)
    const btn = $("btnGuardarPedido")
    guardando = true
    btn.disabled = true
    btn.textContent = "Guardando…"

    try {
      const guardado = await api(id ? `/api/pedidos/${id}` : "/api/pedidos", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          cliente_id: Number($("pedidoCliente").value),
          cliente_sucursal_id: Number($("pedidoSucursal").value),
          fecha_entrega: $("pedidoFechaEntrega").value,
          vendedor_id: Number($("pedidoVendedor").value),
          solicitado_por: $("pedidoSolicitado").value,
          referencia_cliente: $("pedidoReferencia").value,
          observaciones: $("pedidoObservaciones").value
        })
      })
      $("modalPedido").close()
      mensaje(id ? `Pedido ${guardado.numero} actualizado.` : `Pedido ${guardado.numero} creado como borrador.`)
      pedidos = await api("/api/pedidos")
      renderPedidos()
    } catch (err) {
      mensaje(err.message, true)
    } finally {
      guardando = false
      btn.disabled = false
      btn.textContent = "💾 Guardar borrador"
    }
  }

  cargarBase().catch(err => mensaje(err.message, true))
}