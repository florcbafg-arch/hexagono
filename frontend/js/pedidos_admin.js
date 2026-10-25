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
  let consultaPedidoActual = null

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

  function normalizarTexto(v) {
    return String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }

  function pedidosFiltrados() {
    const q = normalizarTexto($("pedidoBuscar")?.value)
    const estado = $("pedidoFiltroEstado")?.value || ""
    const desde = $("pedidoFiltroDesde")?.value || ""
    const hasta = $("pedidoFiltroHasta")?.value || ""

    return pedidos.filter(p => {
      if (estado && p.estado !== estado) return false
      if (desde && String(p.fecha_carga || "") < desde) return false
      if (hasta && String(p.fecha_carga || "") > hasta) return false

      if (!q) return true

      const texto = normalizarTexto([
        p.numero,
        p.cliente?.codigo,
        p.cliente?.nombre,
        p.sucursal?.codigo,
        p.sucursal?.nombre,
        p.referencia_cliente,
        p.observaciones,
        p.estado,
        p.fecha_carga,
        p.fecha_entrega,
        ...(p.resumen?.terminos_articulos || [])
      ].filter(Boolean).join(" "))

      return texto.includes(q)
    })
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
    const filtrados = pedidosFiltrados()

    $("pedidosTotal").textContent = pedidos.length
    $("pedidosBorradores").textContent = pedidos.filter(p => p.estado === "borrador").length
    $("pedidosConfirmados").textContent = pedidos.filter(p => p.estado === "confirmado").length
    $("pedidosVacio").hidden = filtrados.length > 0
    $("pedidosVacio").textContent = pedidos.length && !filtrados.length
      ? "No hay pedidos que coincidan con los filtros."
      : "Todavía no hay pedidos cargados."

    $("pedidosTabla").innerHTML = filtrados.map(p => `
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
        <td>
          <button class="pedidos-link" data-consulta-pedido="${p.id}">Consultar</button>
          <button class="pedidos-link" data-edit-pedido="${p.id}">Abrir</button>
        </td>
      </tr>`).join("")

    document.querySelectorAll("[data-edit-pedido]").forEach(b => {
      b.onclick = () => abrirPedido(pedidos.find(p => Number(p.id) === Number(b.dataset.editPedido)))
    })

    document.querySelectorAll("[data-consulta-pedido]").forEach(b => {
      b.onclick = () => abrirConsultaPedido(Number(b.dataset.consultaPedido))
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

  function curvaConsulta(item) {
    const talles = item.curva || []
    if (!talles.length) return ""

    return `
      <table class="consulta-curva">
        <thead>
          <tr>
            <th>Curva</th>
            ${talles.map(t => `<th>${esc(t.talle)}</th>`).join("")}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cantidad</td>
            ${talles.map(t => `<td>${Number(t.cantidad || 0)}</td>`).join("")}
            <td><strong>${Number(item.cantidad_pares || 0)}</strong></td>
          </tr>
          <tr>
            <td>Cantidad pendiente</td>
            ${talles.map(t => `<td>${Number(t.cantidad_pendiente || 0)}</td>`).join("")}
            <td><strong>${Number(item.cantidad_pendiente || 0)}</strong></td>
          </tr>
        </tbody>
      </table>`
  }

  function documentoConsultaPedido(pedido, items) {
    const totalPares = items.reduce((acc, i) => acc + Number(i.cantidad_pares || 0), 0)
    const totalPendiente = items.reduce((acc, i) => acc + Number(i.cantidad_pendiente || 0), 0)

    return `
      <h1 class="consulta-doc-title">CONSULTA DEL PEDIDO</h1>

      <div class="consulta-doc-head">
        <div><strong>Fecha:</strong> ${fechaVista(pedido.fecha_carga)}</div>
        <div><strong>Nro. Pedido:</strong> ${esc(pedido.numero || "—")}</div>
        <div><strong>Cliente:</strong> ${esc(pedido.cliente?.nombre || "—")}</div>
        <div><strong>Cód. Cliente:</strong> ${esc(pedido.cliente?.codigo || "—")}</div>
        <div><strong>Nro. Sucursal:</strong> ${esc(pedido.sucursal?.codigo || "—")}</div>
        <div><strong>Sucursal:</strong> ${esc(pedido.sucursal?.nombre || "—")}</div>
        <div><strong>Entrega general:</strong> ${fechaVista(pedido.fecha_entrega)}</div>
        <div><strong>Versión / Estado:</strong> V${esc(pedido.version)} · ${esc(String(pedido.estado || "").toUpperCase())}</div>
        <div><strong>Vendedor:</strong> ${esc(pedido.vendedor?.nombre || "—")}</div>
        <div><strong>Solicitado por:</strong> ${esc(pedido.solicitado_por || "—")}</div>
        <div><strong>Referencia cliente:</strong> ${esc(pedido.referencia_cliente || "—")}</div>
      </div>

      <div class="consulta-doc-observaciones">
        <strong>Observaciones:</strong> ${esc(pedido.observaciones || "—")}
        ${pedido.motivo_correccion ? `<br><strong>Motivo de corrección:</strong> ${esc(pedido.motivo_correccion)}` : ""}
        ${pedido.motivo_anulacion ? `<br><strong>Motivo de anulación:</strong> ${esc(pedido.motivo_anulacion)}` : ""}
      </div>

      <section>
        ${items.length ? items.map(item => {
          const a = item.articulo || {}
          return `
            <article class="consulta-doc-item">
              <div class="consulta-item-top">
                <div><span>Nro. Ítem</span><strong>${Number(item.nro_item || 0)}</strong></div>
                <div><span>Artículo</span><strong>${esc(a.codigo || "—")} · ${esc(a.modelos?.nombre || "—")}</strong></div>
                <div><span>Color</span><strong>${esc(a.color || "—")}</strong></div>
                <div><span>Marca</span><strong>${esc(a.modelos?.marca || "—")}</strong></div>
              </div>

              <div class="consulta-item-foot">
                <span><strong>Fecha entrega:</strong> ${fechaVista(item.fecha_entrega)}</span>
                <span><strong>Cantidad:</strong> ${Number(item.cantidad_pares || 0)}</span>
                <span><strong>Cantidad pendiente:</strong> ${Number(item.cantidad_pendiente || 0)}</span>
              </div>

              ${curvaConsulta(item)}

              ${item.observaciones ? `<div class="consulta-item-foot"><span><strong>Observación:</strong> ${esc(item.observaciones)}</span></div>` : ""}
            </article>`
        }).join("") : '<p>El pedido todavía no contiene artículos.</p>'}
      </section>

      <div class="consulta-doc-total">
        <span>Total artículos <strong>${items.length}</strong></span>
        <span>Total pedido <strong>${totalPares}</strong></span>
        <span>Total pendiente <strong>${totalPendiente}</strong></span>
      </div>
    `
  }

  async function abrirConsultaPedido(pedidoId) {
    try {
      const [pedido, detalle] = await Promise.all([
        api(`/api/pedidos/${pedidoId}`),
        api(`/api/pedidos/${pedidoId}/items`)
      ])

      consultaPedidoActual = {
        pedido,
        items: detalle.items || []
      }

      $("consultaPedidoDocumento").innerHTML = documentoConsultaPedido(pedido, consultaPedidoActual.items)
      $("btnEditarDesdeConsulta").disabled = pedido.estado !== "borrador"
      $("btnCorregirPedido").disabled = pedido.estado === "borrador" || pedido.estado === "anulado" || pedido.estado === "reemplazado"
      $("btnAnularPedido").disabled = pedido.estado === "anulado" || pedido.estado === "reemplazado"
      $("btnCorregirPedido").title = pedido.estado === "borrador"
        ? "Un borrador se edita directamente; la nueva versión se crea cuando el pedido ya está cerrado."
        : ""
      $("modalConsultaPedido").showModal()
    } catch (err) {
      mensaje(err.message, true)
    }
  }

  function fechaHoraVista(v) {
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  async function abrirHistorialPedido() {
    const pedido = consultaPedidoActual?.pedido
    if (!pedido) return

    try {
      const data = await api(`/api/pedidos/${pedido.id}/versiones`)
      const versiones = data.versiones || []
      const eventos = data.eventos || []

      $("historialPedidoContenido").innerHTML = `
        <div class="pedido-version-meta" style="margin-bottom:12px">
          Pedido N.º <strong>${esc(pedido.numero)}</strong> · ${versiones.length} versión${versiones.length === 1 ? "" : "es"}
        </div>

        ${versiones.map(v => `
          <article class="pedido-version-card">
            <div class="pedido-version-top">
              <div>
                <strong>V${v.version} · ${esc(String(v.estado || "").toUpperCase())}</strong>
                <div class="pedido-version-meta">
                  Carga ${fechaVista(v.fecha_carga)} · Entrega ${fechaVista(v.fecha_entrega)} ·
                  ${Number(v.resumen?.articulos || 0)} artículos · ${Number(v.resumen?.pares || 0)} pares
                </div>
              </div>
              <button type="button" class="pedidos-link" data-ver-version="${v.id}">Consultar</button>
            </div>
            ${v.motivo_correccion ? `<div class="pedido-version-reason"><strong>Motivo de corrección:</strong> ${esc(v.motivo_correccion)}</div>` : ""}
            ${v.motivo_anulacion ? `<div class="pedido-version-reason"><strong>Motivo de anulación:</strong> ${esc(v.motivo_anulacion)}</div>` : ""}
            ${v.reemplaza_pedido_id ? `<div class="pedido-version-meta">Reemplaza la versión asociada al registro #${v.reemplaza_pedido_id}.</div>` : ""}
          </article>
        `).join("")}

        <div class="pedido-eventos">
          <h3>Eventos</h3>
          ${eventos.length ? eventos.map(e => `
            <div class="pedido-evento">
              <strong>${fechaHoraVista(e.created_at)}</strong>
              <span>${esc(String(e.tipo || "").replaceAll("_"," ").toUpperCase())}${e.motivo ? " · " + esc(e.motivo) : ""}</span>
            </div>
          `).join("") : '<div class="pedidos-vacio compact">Sin eventos registrados.</div>'}
        </div>
      `

      $("modalHistorialPedido").showModal()

      document.querySelectorAll("[data-ver-version]").forEach(btn => {
        btn.onclick = () => {
          $("modalHistorialPedido").close()
          $("modalConsultaPedido").close()
          abrirConsultaPedido(Number(btn.dataset.verVersion))
        }
      })
    } catch (err) {
      mensaje(err.message, true)
    }
  }

  function abrirCorreccionPedido() {
    const pedido = consultaPedidoActual?.pedido
    if (!pedido) return

    if (pedido.estado === "borrador") {
      return alert("Este pedido todavía es borrador. Editalo directamente; no hace falta crear una nueva versión.")
    }
    if (["anulado","reemplazado"].includes(pedido.estado)) {
      return alert("Ese pedido ya no admite correcciones.")
    }

    $("formCorregirPedido").reset()
    $("corregirPedidoTexto").textContent =
      `Se creará el Pedido ${pedido.numero} · V${Number(pedido.version) + 1} copiando encabezado, artículos y curvas de V${pedido.version}.`
    $("modalCorregirPedido").showModal()
  }

  function abrirAnulacionPedido() {
    const pedido = consultaPedidoActual?.pedido
    if (!pedido) return
    if (["anulado","reemplazado"].includes(pedido.estado)) return

    $("formAnularPedido").reset()
    $("anularPedidoTexto").textContent =
      `Vas a anular el Pedido ${pedido.numero} · V${pedido.version}. No se borrará ningún dato y el motivo quedará en el historial.`
    $("modalAnularPedido").showModal()
  }

  function imprimirConsultaPedido() {
    if (!consultaPedidoActual) return

    const origen = $("consultaPedidoDocumento")
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      iframe.remove()
      return mensaje("No se pudo preparar la impresión.", true)
    }

    const estilos = `
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      html,body { margin:0; padding:0; background:#fff; color:#111; }
      body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .consulta-pedido-doc {
        width:190mm;
        max-width:190mm;
        margin:0 auto;
        padding:6mm 3mm 4mm;
        border:0;
        background:#fff;
        color:#111;
      }
      .consulta-doc-title { text-align:center; font-size:15pt; margin:0 0 4mm; letter-spacing:.2px; }
      .consulta-doc-head { display:grid; grid-template-columns:1fr 1fr; gap:1.2mm 6mm; font-size:8pt; margin-bottom:3mm; }
      .consulta-doc-observaciones { font-size:8pt; border-top:.25mm solid #777; border-bottom:.25mm solid #777; padding:1.5mm 0; margin-bottom:2.5mm; }
      .consulta-doc-item { border-bottom:.4mm solid #555; padding:1.8mm 0 2.2mm; break-inside:avoid; page-break-inside:avoid; }
      .consulta-item-top { display:grid; grid-template-columns:15mm minmax(62mm,2fr) minmax(28mm,.8fr) minmax(30mm,.9fr); gap:2mm 4mm; align-items:end; font-size:7.1pt; }
      .consulta-item-top span { color:#555; }
      .consulta-item-top strong { display:block; font-size:7.6pt; }
      .consulta-item-foot { display:flex; justify-content:flex-end; gap:5mm; margin-top:1.4mm; font-size:7.1pt; flex-wrap:wrap; }
      .consulta-curva { width:100%; border-collapse:collapse; margin-top:1.5mm; font-size:6.8pt; table-layout:fixed; }
      .consulta-curva th,.consulta-curva td { border:.2mm solid #999; padding:.9mm .8mm; text-align:center; }
      .consulta-curva th:first-child,.consulta-curva td:first-child { text-align:left; font-weight:700; width:29mm; }
      .consulta-doc-total { display:flex; justify-content:flex-end; gap:6mm; border-top:.5mm solid #222; margin-top:2.5mm; padding-top:2mm; font-size:8pt; flex-wrap:wrap; }
      .consulta-doc-total strong { font-size:9.5pt; margin-left:1.2mm; }
    `

    doc.open()
    doc.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Consulta Pedido ${esc(consultaPedidoActual.pedido.numero || "")}</title><style>${estilos}</style></head><body>${origen.outerHTML}</body></html>`)
    doc.close()

    const limpiar = () => setTimeout(() => iframe.remove(), 500)
    iframe.contentWindow.addEventListener("afterprint", limpiar, { once: true })
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    }, 120)
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

  $("pedidoBuscar").oninput = renderPedidos
  $("pedidoFiltroEstado").onchange = renderPedidos
  $("pedidoFiltroDesde").onchange = renderPedidos
  $("pedidoFiltroHasta").onchange = renderPedidos
  $("btnLimpiarFiltros").onclick = () => {
    $("pedidoBuscar").value = ""
    $("pedidoFiltroEstado").value = ""
    $("pedidoFiltroDesde").value = ""
    $("pedidoFiltroHasta").value = ""
    renderPedidos()
  }

  $("btnImprimirConsulta").onclick = imprimirConsultaPedido
  $("btnHistorialPedido").onclick = abrirHistorialPedido
  $("btnCorregirPedido").onclick = abrirCorreccionPedido
  $("btnAnularPedido").onclick = abrirAnulacionPedido

  $("formCorregirPedido").onsubmit = async e => {
    e.preventDefault()
    const pedido = consultaPedidoActual?.pedido
    const motivo = $("pedidoMotivoCorreccion").value.trim()
    if (!pedido || !motivo) return

    const btn = $("btnConfirmarCorreccion")
    btn.disabled = true
    btn.textContent = "Creando versión…"

    try {
      const nueva = await api(`/api/pedidos/${pedido.id}/corregir`, {
        method: "POST",
        body: JSON.stringify({ motivo })
      })

      $("modalCorregirPedido").close()
      $("modalConsultaPedido").close()
      pedidos = await api("/api/pedidos")
      renderPedidos()
      mensaje(`Pedido ${nueva.numero} · V${nueva.version} creado como borrador de corrección.`)
      await abrirPedido(nueva)
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Crear nueva versión"
    }
  }

  $("formAnularPedido").onsubmit = async e => {
    e.preventDefault()
    const pedido = consultaPedidoActual?.pedido
    const motivo = $("pedidoMotivoAnulacion").value.trim()
    if (!pedido || !motivo) return

    const btn = $("btnConfirmarAnulacion")
    btn.disabled = true
    btn.textContent = "Anulando…"

    try {
      await api(`/api/pedidos/${pedido.id}/anular`, {
        method: "POST",
        body: JSON.stringify({ motivo })
      })

      $("modalAnularPedido").close()
      $("modalConsultaPedido").close()
      pedidos = await api("/api/pedidos")
      renderPedidos()
      mensaje(`Pedido ${pedido.numero} · V${pedido.version} anulado. El registro quedó preservado.`)
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Anular pedido"
    }
  }

  $("btnEditarDesdeConsulta").onclick = () => {
    const pedido = consultaPedidoActual?.pedido
    if (!pedido || pedido.estado !== "borrador") return
    $("modalConsultaPedido").close()
    abrirPedido(pedido)
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