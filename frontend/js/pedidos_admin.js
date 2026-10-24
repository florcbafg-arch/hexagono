window.initPedidos = function () {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token }
  const $ = id => document.getElementById(id)
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))

  let clientes = []
  let vendedores = []
  let pedidos = []
  let articulos = []
  let pedidoAbierto = null
  let pedidoItems = []
  let curvaEditor = []
  let guardando = false
  let guardandoItem = false

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

  function etiquetaArticulo(a) {
    const marca = a?.modelos?.marca || ""
    const modelo = a?.modelos?.nombre || ""
    return [a?.codigo, marca, modelo, a?.color].filter(Boolean).join(" · ")
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
        <td>${Number(p.resumen?.articulos || 0)}</td>
        <td><strong>${Number(p.resumen?.pares || 0)}</strong></td>
        <td>V${esc(p.version)}</td>
        <td><span class="pedido-chip ${p.estado === "confirmado" ? "confirmado" : ""}">${esc(String(p.estado || "").toUpperCase())}</span></td>
        <td><button class="pedidos-link" data-edit-pedido="${p.id}">Abrir</button></td>
      </tr>`).join("")

    document.querySelectorAll("[data-edit-pedido]").forEach(b => {
      b.onclick = () => abrirPedido(pedidos.find(p => Number(p.id) === Number(b.dataset.editPedido)))
    })
  }

  function renderSelectorArticulos(seleccionarId = null) {
    const activos = articulos.filter(a => a.activo !== false)
    $("pedidoItemArticulo").innerHTML = '<option value="">Seleccionar artículo</option>' + activos.map(a =>
      `<option value="${a.id}">${esc(etiquetaArticulo(a))}</option>`
    ).join("")
    if (seleccionarId) $("pedidoItemArticulo").value = String(seleccionarId)
  }

  function renderPedidoItems() {
    const totalPares = pedidoItems.reduce((acc, i) => acc + Number(i.cantidad_pares || 0), 0)
    const totalPendiente = pedidoItems.reduce((acc, i) => acc + Number(i.cantidad_pendiente || 0), 0)

    $("pedidoItemsTotalArticulos").textContent = pedidoItems.length
    $("pedidoItemsTotalPares").textContent = totalPares
    $("pedidoItemsTotalPendiente").textContent = totalPendiente
    $("pedidoItemsVacio").hidden = pedidoItems.length > 0

    $("pedidoItemsTabla").innerHTML = pedidoItems.map(i => {
      const a = i.articulo || {}
      const curva = (i.curva || []).map(t => `${esc(t.talle)}:${Number(t.cantidad || 0)}`).join(" · ")
      return `
        <tr>
          <td><strong>${i.nro_item}</strong></td>
          <td>${esc([a.codigo,a.modelos?.marca,a.modelos?.nombre].filter(Boolean).join(" · "))}</td>
          <td>${esc(a.color || "—")}</td>
          <td>${fechaVista(i.fecha_entrega)}</td>
          <td>${curva || "—"}</td>
          <td><strong>${Number(i.cantidad_pares || 0)}</strong></td>
          <td>${Number(i.cantidad_pendiente || 0)}</td>
          <td>
            <button class="pedidos-link" type="button" data-edit-item="${i.id}">Editar</button>
            <button class="pedidos-link" type="button" data-remove-item="${i.id}">Quitar</button>
          </td>
        </tr>`
    }).join("")

    document.querySelectorAll("[data-edit-item]").forEach(b => {
      b.onclick = () => abrirPedidoItem(pedidoItems.find(i => Number(i.id) === Number(b.dataset.editItem)))
    })
    document.querySelectorAll("[data-remove-item]").forEach(b => {
      b.onclick = () => quitarPedidoItem(Number(b.dataset.removeItem))
    })
  }

  async function cargarPedidoItems() {
    const pedidoId = Number($("pedidoId").value)
    if (!pedidoId) {
      pedidoItems = []
      renderPedidoItems()
      $("btnAgregarPedidoItem").disabled = true
      $("pedidoItemsAyuda").textContent = "Guardá primero el borrador para poder cargar artículos y curvas."
      return
    }

    const data = await api(`/api/pedidos/${pedidoId}/items`)
    pedidoItems = data.items || []
    renderPedidoItems()
    $("btnAgregarPedidoItem").disabled = pedidoAbierto?.estado !== "borrador"
    $("pedidoItemsAyuda").textContent = pedidoAbierto?.estado === "borrador"
      ? "Cada artículo conserva su propia fecha de entrega, curva y cantidad."
      : "El pedido ya no está en borrador."
  }

  async function cargarBase() {
    const [cs, vs, ps, arts] = await Promise.all([
      api("/api/pedidos/clientes"),
      api("/api/pedidos/vendedores"),
      api("/api/pedidos"),
      api("/api/articulos")
    ])
    clientes = cs || []
    vendedores = vs || []
    pedidos = ps || []
    articulos = arts || []
    renderClientes()
    renderVendedores()
    renderPedidos()
    renderSelectorArticulos()
  }

  async function abrirPedido(pedido = null) {
    pedidoAbierto = pedido
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

    pedidoItems = []
    renderPedidoItems()
    $("btnAgregarPedidoItem").disabled = !pedido?.id
    $("pedidoItemsAyuda").textContent = pedido?.id
      ? "Cargando artículos…"
      : "Guardá primero el borrador para poder cargar artículos y curvas."

    $("modalPedido").showModal()
    if (pedido?.id) {
      try { await cargarPedidoItems() }
      catch (err) { mensaje(err.message, true) }
    }
  }

  function curvaInicial() {
    return [35,36,37,38,39,40].map(t => ({ talle: String(t), cantidad: "" }))
  }

  function renderCurvaEditor() {
    $("pedidoCurvaEditor").innerHTML = curvaEditor.map((c, index) => `
      <div class="curva-celda">
        <button type="button" class="curva-remove" data-curva-remove="${index}" title="Quitar talle">×</button>
        <label>Talle</label>
        <input type="text" value="${esc(c.talle)}" data-curva-index="${index}" data-curva-field="talle" inputmode="numeric">
        <label>Pares</label>
        <input type="number" min="0" step="1" value="${esc(c.cantidad)}" data-curva-index="${index}" data-curva-field="cantidad" inputmode="numeric">
      </div>
    `).join("")

    document.querySelectorAll("[data-curva-index]").forEach(input => {
      input.oninput = () => {
        const index = Number(input.dataset.curvaIndex)
        curvaEditor[index][input.dataset.curvaField] = input.value
        actualizarTotalCurva()
      }
    })
    document.querySelectorAll("[data-curva-remove]").forEach(b => {
      b.onclick = () => {
        curvaEditor.splice(Number(b.dataset.curvaRemove), 1)
        renderCurvaEditor()
        actualizarTotalCurva()
      }
    })
  }

  function actualizarTotalCurva() {
    const total = curvaEditor.reduce((acc, c) => {
      const n = Number(c.cantidad)
      return acc + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
    }, 0)
    $("pedidoItemTotal").value = total
  }

  function agregarTalles(cantidad) {
    const numericos = curvaEditor.map(c => Number(c.talle)).filter(Number.isFinite)
    let ultimo = numericos.length ? Math.max(...numericos) : 34
    for (let i = 0; i < cantidad; i++) {
      ultimo += 1
      curvaEditor.push({ talle: String(ultimo), cantidad: "" })
    }
    renderCurvaEditor()
  }

  function abrirPedidoItem(item = null) {
    if (!Number($("pedidoId").value)) return
    $("formPedidoItem").reset()
    $("pedidoItemId").value = item?.id || ""
    $("pedidoItemTitulo").textContent = item ? `Editar ítem ${item.nro_item}` : "Agregar artículo"
    renderSelectorArticulos(item?.articulo_id || null)
    $("pedidoItemFechaEntrega").value = item?.fecha_entrega || $("pedidoFechaEntrega").value
    $("pedidoItemObservaciones").value = item?.observaciones || ""
    curvaEditor = item?.curva?.length
      ? item.curva.map(t => ({ talle: String(t.talle), cantidad: String(t.cantidad) }))
      : curvaInicial()
    renderCurvaEditor()
    actualizarTotalCurva()
    $("modalPedidoItem").showModal()
  }

  async function quitarPedidoItem(itemId) {
    const item = pedidoItems.find(i => Number(i.id) === itemId)
    if (!item) return
    const nombre = etiquetaArticulo(item.articulo)
    if (!confirm(`¿Quitar ${nombre} del pedido?\nEl registro quedará preservado en la base.`)) return

    try {
      await api(`/api/pedidos/${pedidoAbierto.id}/items/${itemId}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: false })
      })
      await cargarPedidoItems()
      pedidos = await api("/api/pedidos")
      renderPedidos()
    } catch (err) { mensaje(err.message, true) }
  }

  $("btnNuevoPedido").onclick = () => abrirPedido()
  $("pedidoCliente").onchange = () => renderSucursales()
  $("btnAgregarPedidoItem").onclick = () => abrirPedidoItem()
  $("btnCurvaMas1").onclick = () => agregarTalles(1)
  $("btnCurvaMas5").onclick = () => agregarTalles(5)

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

  $("formPedidoItem").onsubmit = async e => {
    e.preventDefault()
    if (guardandoItem) return

    const pedidoId = Number($("pedidoId").value)
    const itemId = Number($("pedidoItemId").value)
    const curva = curvaEditor
      .map(c => ({ talle: String(c.talle || "").trim(), cantidad: Number(c.cantidad) }))
      .filter(c => c.talle && Number.isInteger(c.cantidad) && c.cantidad > 0)

    const btn = $("btnGuardarPedidoItem")
    guardandoItem = true
    btn.disabled = true
    btn.textContent = "Guardando…"

    try {
      await api(itemId
        ? `/api/pedidos/${pedidoId}/items/${itemId}`
        : `/api/pedidos/${pedidoId}/items`, {
        method: itemId ? "PUT" : "POST",
        body: JSON.stringify({
          articulo_id: Number($("pedidoItemArticulo").value),
          fecha_entrega: $("pedidoItemFechaEntrega").value,
          observaciones: $("pedidoItemObservaciones").value,
          curva
        })
      })
      $("modalPedidoItem").close()
      await cargarPedidoItems()
      pedidos = await api("/api/pedidos")
      renderPedidos()
    } catch (err) {
      alert(err.message)
    } finally {
      guardandoItem = false
      btn.disabled = false
      btn.textContent = "💾 Guardar artículo"
    }
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

      pedidoAbierto = guardado
      $("pedidoId").value = guardado.id
      $("pedidoModalTitulo").textContent = "Editar pedido"
      $("pedidoNumeroVista").textContent = `Pedido N.º ${guardado.numero}`
      $("pedidoEstadoVista").textContent = `${String(guardado.estado).toUpperCase()} · V${guardado.version}`
      $("btnAgregarPedidoItem").disabled = false
      $("pedidoItemsAyuda").textContent = "Cada artículo conserva su propia fecha de entrega, curva y cantidad."

      pedidos = await api("/api/pedidos")
      renderPedidos()
      await cargarPedidoItems()
    } catch (err) {
      alert(err.message)
    } finally {
      guardando = false
      btn.disabled = false
      btn.textContent = "💾 Guardar borrador"
    }
  }

  cargarBase().catch(err => mensaje(err.message, true))
}