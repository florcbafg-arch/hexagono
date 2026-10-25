window.initDespiece = function initDespiece() {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token }
  const $ = id => document.getElementById(id)
  const seleccionados = new Set()

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    })
    const data = await res.json().catch(() => ({}))

    if (res.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("hexagono_user")
      window.location.href = "login.html"
      throw new Error("Sesión expirada")
    }

    if (!res.ok) {
      throw new Error(data.error || "No se pudo completar la operación")
    }

    return data
  }
  let pendientes = []
  let lotes = []

  const esc = value => String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;")

  const fechaVista = value => {
    if (!value) return "—"
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value)
  }

  function mensaje(texto, error=false) {
    const box = $("despieceMensaje")
    if (!box) return
    box.className = "despiece-status " + (error ? "error" : "ok")
    box.textContent = texto
    clearTimeout(mensaje._t)
    mensaje._t = setTimeout(() => {
      if (box) {
        box.className = "despiece-status"
        box.textContent = ""
      }
    }, 4500)
  }

  function etiquetaAptitud(aptitud) {
    const estado = aptitud?.estado || "bloqueado"
    const mapa = {
      apto: ["🟢","APTO"],
      advertencia: ["🟡","ADVERTENCIA"],
      bloqueado: ["🔴","BLOQUEADO"]
    }
    const [icono, texto] = mapa[estado] || mapa.bloqueado
    return `<span class="semaforo ${estado}">${icono} ${texto}</span>`
  }

  function detalleAptitud(aptitud) {
    const lineas = []
    ;(aptitud?.bloqueos || []).forEach(x => lineas.push(`<div>• ${esc(x)}</div>`))
    ;(aptitud?.advertencias || []).forEach(x => lineas.push(`<div>• ${esc(x)}</div>`))
    if (!lineas.length && aptitud?.resumen) {
      lineas.push(
        `<div>${Number(aptitud.resumen.lineas_patron || 0)} líneas de patrón · ${Number(aptitud.resumen.rindes_vigentes || 0)} rindes vigentes · ${Number(aptitud.resumen.talles_pedido || 0)} talles</div>`
      )
    }
    return lineas.join("")
  }

  function iconoControl(estado) {
    if (estado === "ok") return "✅"
    if (estado === "advertencia") return "⚠️"
    return "⛔"
  }

  function renderChecklist(aptitud) {
    const controles = Array.isArray(aptitud?.controles) ? aptitud.controles : []
    if (!controles.length) {
      return '<div class="despiece-empty">No hay controles técnicos disponibles.</div>'
    }

    return controles.map(control => `
      <div class="aptitud-check ${esc(control.estado || "bloqueado")}">
        <div class="aptitud-check-icon">${iconoControl(control.estado)}</div>
        <div class="aptitud-check-name">${esc(control.nombre)}</div>
        <div class="aptitud-check-detail">${esc(control.detalle || "Sin detalle")}</div>
      </div>
    `).join("")
  }

  function renderAptitudItem(item) {
    const aptitud = item.aptitud || {}
    return `
      <article class="aptitud-item">
        <div class="aptitud-item-head">
          <div>
            <strong>${esc(item.articulo_codigo)} · ${esc(item.articulo_modelo)}</strong>
            <div class="aptitud-item-meta">${esc(item.articulo_marca)} · ${esc(item.articulo_color)} · ${Number(item.cantidad_pares || 0)} pares</div>
          </div>
          ${etiquetaAptitud(aptitud)}
        </div>
        <div class="aptitud-checklist">
          ${renderChecklist(aptitud)}
        </div>
      </article>
    `
  }

  function abrirModalAptitud(titulo, items, resumen = null, puedeGenerar = false, estado = null) {
    $("aptitudTitulo").textContent = titulo

    if (resumen) {
      $("aptitudResumenWrap").innerHTML = `
        <div class="aptitud-summary">
          <div class="aptitud-summary-card"><span>Artículos</span><strong>${Number(resumen.total || 0)}</strong></div>
          <div class="aptitud-summary-card"><span>Aptos</span><strong>${Number(resumen.aptos || 0)}</strong></div>
          <div class="aptitud-summary-card"><span>Advertencias</span><strong>${Number(resumen.advertencias || 0)}</strong></div>
          <div class="aptitud-summary-card"><span>Bloqueados</span><strong>${Number(resumen.bloqueados || 0)}</strong></div>
        </div>
        <div class="aptitud-lote-estado">
          <p>Estado técnico general del lote</p>
          ${etiquetaAptitud({ estado: estado || (puedeGenerar ? "apto" : "bloqueado") })}
        </div>
      `
    } else {
      $("aptitudResumenWrap").innerHTML = ""
    }

    $("aptitudItemsWrap").innerHTML = items.map(renderAptitudItem).join("")
    $("aptitudEstadoFinal").innerHTML = puedeGenerar
      ? '<span class="aptitud-ready">✅ Técnicamente listo para generar Despiece.</span>'
      : '<span class="aptitud-not-ready">⛔ Todavía no está listo para generar Despiece.</span>'

    $("modalAptitudDespiece").showModal()
  }

  async function verAptitudItem(snapshotItemId) {
    try {
      const data = await api(`/api/despiece/items/${snapshotItemId}/aptitud`)
      abrirModalAptitud(
        `Aptitud técnica · ${data.item.articulo_codigo}`,
        [{ ...data.item, aptitud: data.aptitud }],
        null,
        data.aptitud?.puede_generar_despiece === true,
        data.aptitud?.estado
      )
    } catch (err) {
      alert(err.message)
    }
  }

  async function verAptitudLote(loteId) {
    try {
      const data = await api(`/api/despiece/lotes/${loteId}/aptitud`)
      abrirModalAptitud(
        `Lote ${String(data.lote.numero).padStart(3,"0")} · Aptitud técnica`,
        data.items || [],
        data.resumen || null,
        data.puede_generar_despiece === true,
        data.estado
      )
    } catch (err) {
      alert(err.message)
    }
  }

  function actualizarSeleccion() {
    const seleccion = pendientes.filter(i => seleccionados.has(Number(i.id)))
    const pares = seleccion.reduce((acc,i) => acc + Number(i.cantidad_pares || 0), 0)

    $("btnNuevoLoteDespiece").disabled = seleccion.length === 0

    if ($("despieceSeleccionResumen")) {
      $("despieceSeleccionResumen").innerHTML = seleccion.length
        ? `Seleccionaste <strong>${seleccion.length}</strong> artículo(s) · <strong>${pares}</strong> pares.`
        : "No hay artículos seleccionados."
    }
  }

  function renderPendientes() {
    const body = $("despiecePendientesBody")
    if (!body) return

    $("despiecePendientes").textContent = pendientes.length
    $("despieceAptos").textContent = pendientes.filter(i => i.aptitud?.estado === "apto").length
    $("despieceBloqueados").textContent = pendientes.filter(i => i.aptitud?.estado === "bloqueado").length

    if (!pendientes.length) {
      body.innerHTML = '<tr><td colspan="9" class="despiece-empty">No hay artículos confirmados pendientes de asignar a lote.</td></tr>'
      actualizarSeleccion()
      return
    }

    body.innerHTML = pendientes.map(item => {
      const pedido = item.pedido || {}
      const snapshot = item.snapshot || {}
      return `
        <tr>
          <td><input class="despiece-check" type="checkbox" data-item-id="${item.id}" ${seleccionados.has(Number(item.id)) ? "checked" : ""}></td>
          <td><strong>${esc(pedido.numero || snapshot.numero || "—")}</strong><br><small>V${esc(pedido.version || snapshot.version || "—")}</small></td>
          <td><strong>${esc(item.articulo_codigo)}</strong><br>${esc(item.articulo_modelo)}</td>
          <td>${esc(item.articulo_marca)}</td>
          <td>${esc(item.articulo_color)}</td>
          <td><strong>${Number(item.cantidad_pares || 0)}</strong></td>
          <td>${fechaVista(item.fecha_entrega)}</td>
          <td>
            ${etiquetaAptitud(item.aptitud)}
            <div class="aptitud-detalle">${detalleAptitud(item.aptitud)}</div>
          </td>
          <td><button type="button" class="despiece-btn secondary aptitud-action" data-ver-aptitud-item="${item.id}">Ver control</button></td>
        </tr>
      `
    }).join("")

    body.querySelectorAll("[data-item-id]").forEach(chk => {
      chk.onchange = () => {
        const id = Number(chk.dataset.itemId)
        if (chk.checked) seleccionados.add(id)
        else seleccionados.delete(id)
        actualizarSeleccion()
      }
    })

    body.querySelectorAll("[data-ver-aptitud-item]").forEach(btn => {
      btn.onclick = () => verAptitudItem(Number(btn.dataset.verAptitudItem))
    })

    actualizarSeleccion()
  }

  function renderLotes() {
    const body = $("despieceLotesBody")
    if (!body) return

    $("despieceLotes").textContent = lotes.length

    if (!lotes.length) {
      body.innerHTML = '<tr><td colspan="7" class="despiece-empty">Todavía no hay lotes de Despiece creados.</td></tr>'
      return
    }

    body.innerHTML = lotes.map(lote => {
      const contenido = (lote.items || []).map(i =>
        `${esc(i.articulo_codigo)} · ${esc(i.articulo_modelo)} (${Number(i.cantidad_pares || 0)} pares)`
      ).join("<br>")

      return `
        <tr>
          <td><strong>Lote ${String(lote.numero).padStart(3,"0")}</strong></td>
          <td><span class="lote-chip">${esc(String(lote.estado || "").toUpperCase())}</span></td>
          <td>${esc(lote.descripcion || "—")}</td>
          <td><strong>${Number(lote.total_articulos || 0)}</strong></td>
          <td><strong>${Number(lote.total_pares || 0)}</strong></td>
          <td class="lote-items">${contenido || "—"}</td>
          <td><button type="button" class="despiece-btn secondary aptitud-action" data-ver-aptitud-lote="${lote.id}">Revisar aptitud</button></td>
        </tr>
      `
    }).join("")

    body.querySelectorAll("[data-ver-aptitud-lote]").forEach(btn => {
      btn.onclick = () => verAptitudLote(Number(btn.dataset.verAptitudLote))
    })
  }

  async function cargar() {
    try {
      const [p,l] = await Promise.all([
        api("/api/despiece/pendientes"),
        api("/api/despiece/lotes")
      ])
      pendientes = Array.isArray(p) ? p : []
      lotes = Array.isArray(l) ? l : []

      for (const id of [...seleccionados]) {
        if (!pendientes.some(i => Number(i.id) === Number(id))) seleccionados.delete(id)
      }

      renderPendientes()
      renderLotes()
    } catch (err) {
      console.error(err)
      mensaje(err.message || "No se pudo cargar Despiece", true)
    }
  }

  function abrirNuevoLote() {
    const seleccion = pendientes.filter(i => seleccionados.has(Number(i.id)))
    if (!seleccion.length) return

    $("despieceDescripcion").value = ""
    $("despieceObservaciones").value = ""
    actualizarSeleccion()
    $("modalNuevoLoteDespiece").showModal()
  }

  $("btnNuevoLoteDespiece").onclick = abrirNuevoLote

  document.querySelectorAll("[data-close-despiece]").forEach(btn => {
    btn.onclick = () => $("modalNuevoLoteDespiece").close()
  })

  document.querySelectorAll("[data-close-aptitud]").forEach(btn => {
    btn.onclick = () => $("modalAptitudDespiece").close()
  })

  $("formNuevoLoteDespiece").onsubmit = async e => {
    e.preventDefault()

    const ids = [...seleccionados]
    if (!ids.length) return

    const btn = $("btnConfirmarLoteDespiece")
    btn.disabled = true
    btn.textContent = "Creando…"

    try {
      const lote = await api("/api/despiece/lotes", {
        method: "POST",
        body: JSON.stringify({
          snapshot_item_ids: ids,
          descripcion: $("despieceDescripcion").value.trim(),
          observaciones: $("despieceObservaciones").value.trim()
        })
      })

      $("modalNuevoLoteDespiece").close()
      seleccionados.clear()
      mensaje(`Lote ${String(lote.numero).padStart(3,"0")} creado correctamente.`)
      await cargar()
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Crear lote"
    }
  }

  cargar()
}
