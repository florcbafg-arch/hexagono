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

  let loteAptitudActual = null

  function fmtCantidad(value, max = 8) {
    const n = Number(value || 0)
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: max
    }).format(n)
  }

  function abrirModalAptitud(titulo, items, resumen = null, puedeGenerar = false, estado = null, loteId = null) {
    $("aptitudTitulo").textContent = titulo
    loteAptitudActual = loteId ? Number(loteId) : null

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

    const btnGenerar = $("btnGenerarDespiece")
    if (btnGenerar) {
      btnGenerar.hidden = !(puedeGenerar && loteAptitudActual)
      btnGenerar.disabled = false
      btnGenerar.textContent = "⚙ Generar Despiece"
    }

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
        data.aptitud?.estado,
        null
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
        data.estado,
        loteId
      )
    } catch (err) {
      alert(err.message)
    }
  }

  function ordenGrupo(nombre) {
    const n = String(nombre || "").toUpperCase()
    if (n === "CORTE REFUERZO") return 10
    if (n === "CORTE FORRO") return 20
    if (n === "CORTE CAPELLADA") return 30
    return 100
  }

  function renderDetalleTalles(linea) {
    const talles = Array.isArray(linea.talles) ? linea.talles : []
    if (!talles.length) return ""

    return `
      <details class="explosion-line-detail">
        <summary>Ver cálculo por talle</summary>
        <div class="explosion-talles">
          <div class="explosion-talle-row head">
            <span>Talle</span><span>Pares</span><span>Fórmula</span><span>Resultado</span>
          </div>
          ${talles.map(t => {
            const componente = t.talle_componente ? ` → comp. ${esc(t.talle_componente)}` : ""
            const factor = Number(t.factor || 1)
            const factorTxt = factor !== 1 ? ` × ${fmtCantidad(factor)}` : ""
            return `
              <div class="explosion-talle-row">
                <span>${esc(t.talle_articulo)}${componente}</span>
                <span>${Number(t.pares || 0)}</span>
                <span>${Number(t.pares || 0)} × ${fmtCantidad(t.consumo_por_par)}${factorTxt}</span>
                <strong>${fmtCantidad(t.necesidad)}</strong>
              </div>
            `
          }).join("")}
        </div>
      </details>
    `
  }

  function renderExplosionItem(item) {
    const grupos = new Map()
    ;(item.lineas || []).forEach(linea => {
      const nombre = linea.grupo_nombre || "SIN GRUPO"
      if (!grupos.has(nombre)) grupos.set(nombre, [])
      grupos.get(nombre).push(linea)
    })

    const gruposOrdenados = [...grupos.entries()].sort((a,b) =>
      ordenGrupo(a[0]) - ordenGrupo(b[0]) || a[0].localeCompare(b[0])
    )

    return `
      <article class="explosion-item">
        <div class="explosion-item-head">
          <div>
            <strong>${esc(item.articulo_codigo)} · ${esc(item.articulo_modelo)}</strong>
            <div class="explosion-item-meta">
              Pedido ${esc(item.pedido_numero)} · V${esc(item.pedido_version)} ·
              ${esc(item.articulo_marca || "—")} · ${esc(item.articulo_color || "—")}
            </div>
          </div>
          <span class="explosion-chip">${Number(item.cantidad_pares || 0)} pares</span>
        </div>

        ${gruposOrdenados.map(([grupo,lineas]) => `
          <section class="explosion-grupo">
            <div class="explosion-grupo-title">${esc(grupo)}</div>
            <table class="explosion-table">
              <thead>
                <tr>
                  <th>Pieza</th>
                  <th>Material</th>
                  <th>Detalle / color</th>
                  <th>U.M.</th>
                  <th>Tipo</th>
                  <th style="text-align:right">Necesidad</th>
                </tr>
              </thead>
              <tbody>
                ${lineas.map(linea => `
                  <tr>
                    <td>
                      <strong>${esc(linea.pieza_nombre)}</strong>
                      ${renderDetalleTalles(linea)}
                    </td>
                    <td>${esc(linea.material_nombre)}</td>
                    <td>${esc([linea.especificacion,linea.color].filter(Boolean).join(" · ") || "—")}</td>
                    <td>${esc(linea.um)}</td>
                    <td><span class="explosion-chip">${esc(String(linea.tipo_escalado || "no_escalado").replaceAll("_"," "))}</span></td>
                    <td class="num">${fmtCantidad(linea.necesidad_total)} ${esc(linea.um)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </section>
        `).join("")}
      </article>
    `
  }

  function abrirExplosion(data, loteNumero = null) {
    const ejecucion = data?.ejecucion || {}
    const items = Array.isArray(data?.items) ? data.items : []
    const numero = loteNumero || lotes.find(l => Number(l.id) === Number(ejecucion.lote_id))?.numero || "—"

    $("explosionTitulo").textContent = `Lote ${String(numero).padStart(3,"0")} · Explosión individual`
    $("explosionResumen").innerHTML = `
      <div class="explosion-summary">
        <div class="explosion-summary-card"><span>Versión cálculo</span><strong>V${Number(ejecucion.version || 1)}</strong></div>
        <div class="explosion-summary-card"><span>Artículos</span><strong>${Number(ejecucion.total_articulos || items.length)}</strong></div>
        <div class="explosion-summary-card"><span>Pares</span><strong>${Number(ejecucion.total_pares || 0)}</strong></div>
        <div class="explosion-summary-card"><span>Líneas calculadas</span><strong>${Number(ejecucion.total_lineas || 0)}</strong></div>
      </div>
    `
    $("explosionItems").innerHTML = items.map(renderExplosionItem).join("")
    $("modalExplosionDespiece").showModal()
  }

  async function verExplosionLote(loteId) {
    try {
      const data = await api(`/api/despiece/lotes/${loteId}/explosion`)
      abrirExplosion(data)
    } catch (err) {
      alert(err.message)
    }
  }

  async function generarDespieceLote(loteId) {
    const lote = lotes.find(l => Number(l.id) === Number(loteId))
    if (!lote) return

    const confirma = confirm(
      `Se calculará y guardará la explosión del Lote ${String(lote.numero).padStart(3,"0")}.\n\n` +
      "El resultado será necesidad técnica bruta; todavía no modificará Stock ni Compras. ¿Continuar?"
    )
    if (!confirma) return

    const btn = $("btnGenerarDespiece")
    if (btn) {
      btn.disabled = true
      btn.textContent = "Calculando…"
    }

    try {
      const result = await api(`/api/despiece/lotes/${loteId}/explotar`, { method: "POST" })
      $("modalAptitudDespiece").close()
      await cargar()
      mensaje(`Despiece del Lote ${String(lote.numero).padStart(3,"0")} calculado y guardado.`)
      abrirExplosion(result.explosion, lote.numero)
    } catch (err) {
      alert(err.message)
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = "⚙ Generar Despiece"
      }
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

      const explosion = lote.explosion
      const estado = explosion ? `CALCULADO · V${Number(explosion.version || 1)}` : String(lote.estado || "").toUpperCase()

      return `
        <tr>
          <td><strong>Lote ${String(lote.numero).padStart(3,"0")}</strong></td>
          <td><span class="lote-chip">${esc(estado)}</span></td>
          <td>${esc(lote.descripcion || "—")}</td>
          <td><strong>${Number(lote.total_articulos || 0)}</strong></td>
          <td><strong>${Number(lote.total_pares || 0)}</strong></td>
          <td class="lote-items">${contenido || "—"}</td>
          <td>
            <div class="lote-actions">
              <button type="button" class="despiece-btn secondary aptitud-action" data-ver-aptitud-lote="${lote.id}">Revisar aptitud</button>
              ${explosion ? `<button type="button" class="despiece-btn aptitud-action" data-ver-explosion-lote="${lote.id}">Ver Despiece</button>` : ""}
            </div>
          </td>
        </tr>
      `
    }).join("")

    body.querySelectorAll("[data-ver-aptitud-lote]").forEach(btn => {
      btn.onclick = () => verAptitudLote(Number(btn.dataset.verAptitudLote))
    })

    body.querySelectorAll("[data-ver-explosion-lote]").forEach(btn => {
      btn.onclick = () => verExplosionLote(Number(btn.dataset.verExplosionLote))
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

  document.querySelectorAll("[data-close-explosion]").forEach(btn => {
    btn.onclick = () => $("modalExplosionDespiece").close()
  })

  $("btnGenerarDespiece").onclick = () => {
    if (loteAptitudActual) generarDespieceLote(loteAptitudActual)
  }

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
