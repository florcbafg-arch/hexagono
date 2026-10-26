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

  let explosionActual = null
  let necesidadGlobalActual = null
  let stockCruceActual = null
  let saldoInicialActual = null
  let filtroClasificacionExplosion = "todos"

  function etiquetaTipoEscalado(tipo) {
    const mapa = {
      no_escalado: "No escalado",
      escalado_alineado: "Escalado alineado",
      escalado_desalineado: "Escalado desalineado"
    }
    return mapa[tipo] || "Sin clasificar"
  }

  function descripcionTipoEscalado(tipo) {
    const mapa = {
      no_escalado: "Insumo o material sin talle propio. Puede tener consumo distinto por talle del calzado, pero la materia prima se consolida globalmente.",
      escalado_alineado: "Componente con talle propio que usa la misma escala del artículo: talle de artículo y talle de componente avanzan alineados.",
      escalado_desalineado: "Componente con talle propio cuya escala no coincide con la del artículo y necesita una equivalencia explícita entre talles."
    }
    return mapa[tipo] || ""
  }

  function resumenClasificacionDesdeItems(items) {
    const lineas = (items || []).flatMap(i => i.lineas || [])
    return {
      total: lineas.length,
      no_escalados: lineas.filter(l => l.tipo_escalado === "no_escalado").length,
      escalados_alineados: lineas.filter(l => l.tipo_escalado === "escalado_alineado").length,
      escalados_desalineados: lineas.filter(l => l.tipo_escalado === "escalado_desalineado").length
    }
  }

  function renderClasificacionExplosion(clasificacion) {
    const r = clasificacion || { total:0, no_escalados:0, escalados_alineados:0, escalados_desalineados:0 }
    $("explosionClasificacion").innerHTML = `
      <section class="clasificacion-wrap">
        <div class="clasificacion-head">
          <div>
            <h3>Clasificación del Despiece</h3>
            <p>Hexaflow separa las líneas según cómo se relacionan con la escala de talles del artículo.</p>
          </div>
          <span class="explosion-chip">${Number(r.total || 0)} líneas</span>
        </div>

        <div class="clasificacion-resumen">
          <div class="clasificacion-card">
            <strong>${Number(r.no_escalados || 0)}</strong>
            <span>No escalados</span>
          </div>
          <div class="clasificacion-card">
            <strong>${Number(r.escalados_alineados || 0)}</strong>
            <span>Escalados alineados</span>
          </div>
          <div class="clasificacion-card">
            <strong>${Number(r.escalados_desalineados || 0)}</strong>
            <span>Escalados desalineados</span>
          </div>
        </div>

        <div class="clasificacion-filtros">
          <button type="button" class="clasificacion-btn active" data-filtro-clasificacion="todos">Todos (${Number(r.total || 0)})</button>
          <button type="button" class="clasificacion-btn" data-filtro-clasificacion="no_escalado">No escalados (${Number(r.no_escalados || 0)})</button>
          <button type="button" class="clasificacion-btn" data-filtro-clasificacion="escalado_alineado">Alineados (${Number(r.escalados_alineados || 0)})</button>
          <button type="button" class="clasificacion-btn" data-filtro-clasificacion="escalado_desalineado">Desalineados (${Number(r.escalados_desalineados || 0)})</button>
        </div>

        <div class="clasificacion-ayuda">
          <div><strong>No escalados</strong>${esc(descripcionTipoEscalado("no_escalado"))}</div>
          <div><strong>Escalados alineados</strong>${esc(descripcionTipoEscalado("escalado_alineado"))}</div>
          <div><strong>Escalados desalineados</strong>${esc(descripcionTipoEscalado("escalado_desalineado"))}</div>
        </div>
      </section>
    `

    $("explosionClasificacion").querySelectorAll("[data-filtro-clasificacion]").forEach(btn => {
      btn.onclick = () => {
        filtroClasificacionExplosion = btn.dataset.filtroClasificacion || "todos"
        $("explosionClasificacion").querySelectorAll("[data-filtro-clasificacion]").forEach(b => {
          b.classList.toggle("active", b === btn)
        })
        renderExplosionItemsFiltrados()
      }
    })
  }

  function renderExplosionItemsFiltrados() {
    const items = Array.isArray(explosionActual?.items) ? explosionActual.items : []
    $("explosionItems").innerHTML = items.map(item => renderExplosionItem(item, filtroClasificacionExplosion)).join("")

    if (!$("explosionItems").textContent.trim()) {
      $("explosionItems").innerHTML = '<div class="despiece-empty">No hay líneas en esta clasificación.</div>'
    }
  }

  function renderExplosionItem(item, filtro = "todos") {
    const grupos = new Map()
    const lineasVisibles = (item.lineas || []).filter(linea =>
      filtro === "todos" || linea.tipo_escalado === filtro
    )
    ;lineasVisibles.forEach(linea => {
      const nombre = linea.grupo_nombre || "SIN GRUPO"
      if (!grupos.has(nombre)) grupos.set(nombre, [])
      grupos.get(nombre).push(linea)
    })

    const gruposOrdenados = [...grupos.entries()].sort((a,b) =>
      ordenGrupo(a[0]) - ordenGrupo(b[0]) || a[0].localeCompare(b[0])
    )

    if (!lineasVisibles.length) return ""

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
                    <td><span class="explosion-chip ${esc(linea.tipo_escalado || "no_escalado")}">${esc(etiquetaTipoEscalado(linea.tipo_escalado || "no_escalado"))}</span></td>
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

    explosionActual = { ...data, items }
    filtroClasificacionExplosion = "todos"

    $("explosionTitulo").textContent = `Lote ${String(numero).padStart(3,"0")} · Explosión individual`
    $("explosionResumen").innerHTML = `
      <div class="explosion-summary">
        <div class="explosion-summary-card"><span>Versión cálculo</span><strong>V${Number(ejecucion.version || 1)}</strong></div>
        <div class="explosion-summary-card"><span>Artículos</span><strong>${Number(ejecucion.total_articulos || items.length)}</strong></div>
        <div class="explosion-summary-card"><span>Pares</span><strong>${Number(ejecucion.total_pares || 0)}</strong></div>
        <div class="explosion-summary-card"><span>Líneas calculadas</span><strong>${Number(ejecucion.total_lineas || 0)}</strong></div>
      </div>
    `

    const clasificacion = data?.clasificacion || resumenClasificacionDesdeItems(items)
    renderClasificacionExplosion(clasificacion)
    renderExplosionItemsFiltrados()
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

  function renderOrigenGlobal(material) {
    const aportes = Array.isArray(material.contribuciones) ? material.contribuciones : []
    if (!aportes.length) return ""

    return `
      <details class="global-origin">
        <summary>Ver origen · ${aportes.length} línea(s)</summary>
        <div class="global-origin-list">
          <div class="global-origin-row head">
            <span>Pedido</span><span>Artículo / pieza</span><span>Grupo</span><span>Aporte</span>
          </div>
          ${aportes.map(a => `
            <div class="global-origin-row">
              <span>${esc(a.pedido_numero)} · V${esc(a.pedido_version)}</span>
              <span><strong>${esc(a.articulo_codigo)}</strong> · ${esc(a.pieza_nombre)}</span>
              <span>${esc(a.grupo_nombre || "—")}</span>
              <strong>${fmtCantidad(a.necesidad)} ${esc(a.um)}</strong>
            </div>
          `).join("")}
        </div>
      </details>
    `
  }

  function renderTallesGlobal(material) {
    const talles = Array.isArray(material.por_talle) ? material.por_talle : []
    if (!talles.length) return ""

    return `
      <div class="global-talles">
        ${talles.map(t => `
          <span class="global-talle">Talle ${esc(t.talle)} · ${fmtCantidad(t.necesidad)} ${esc(material.um)}</span>
        `).join("")}
      </div>
    `
  }

  function renderSeccionGlobal(titulo, tipo, materiales) {
    const filas = Array.isArray(materiales) ? materiales : []
    if (!filas.length) return ""

    return `
      <section class="global-section">
        <div class="global-section-title">
          <span>${esc(titulo)}</span>
          <span>${filas.length} material(es)</span>
        </div>
        <table class="global-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Detalle / color</th>
              <th>U.M.</th>
              <th>Origen</th>
              <th style="text-align:right">Necesidad global</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map(m => `
              <tr>
                <td>
                  <strong>${esc(m.material_nombre)}</strong>
                  ${tipo !== "no_escalado" ? renderTallesGlobal(m) : ""}
                </td>
                <td>${esc([m.especificacion,m.color].filter(Boolean).join(" · ") || "—")}</td>
                <td>${esc(m.um)}</td>
                <td>${renderOrigenGlobal(m)}</td>
                <td class="num">${fmtCantidad(m.necesidad_global)} ${esc(m.um)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `
  }

  function abrirNecesidadGlobal(data) {
    necesidadGlobalActual = data
    const ejecucion = data?.ejecucion || {}
    const resumen = data?.resumen || {}
    const grupos = data?.grupos || {}
    const numero = lotes.find(l => Number(l.id) === Number(ejecucion.lote_id))?.numero || "—"

    $("globalTitulo").textContent = `Lote ${String(numero).padStart(3,"0")} · Necesidad global`
    $("globalResumen").innerHTML = `
      <div class="explosion-summary">
        <div class="explosion-summary-card"><span>Versión Despiece</span><strong>V${Number(ejecucion.version || 1)}</strong></div>
        <div class="explosion-summary-card"><span>Materiales globales</span><strong>${Number(resumen.materiales_globales || 0)}</strong></div>
        <div class="explosion-summary-card"><span>Líneas de origen</span><strong>${Number(resumen.lineas_origen || 0)}</strong></div>
        <div class="explosion-summary-card"><span>Pares del lote</span><strong>${Number(resumen.pares || 0)}</strong></div>
      </div>
    `

    const contenido = [
      renderSeccionGlobal("MATERIALES NO ESCALADOS", "no_escalado", grupos.no_escalado),
      renderSeccionGlobal("MATERIALES ESCALADOS · USO ALINEADO", "escalado_alineado", grupos.escalado_alineado),
      renderSeccionGlobal("MATERIALES ESCALADOS · USO DESALINEADO", "escalado_desalineado", grupos.escalado_desalineado)
    ].join("")

    $("globalContenido").innerHTML = contenido ||
      '<div class="despiece-empty">No hay materiales consolidados para esta versión del Despiece.</div>'

    $("modalNecesidadGlobal").showModal()
  }

  async function verNecesidadGlobalLote(loteId) {
    try {
      const data = await api(`/api/despiece/lotes/${loteId}/necesidad-global`)
      abrirNecesidadGlobal(data)
    } catch (err) {
      alert(err.message)
    }
  }

  function etiquetaEstadoStock(estado) {
    const mapa = {
      sin_registro:["SIN REGISTRO","⚪"],
      cubierto:["CUBIERTO","🟢"],
      parcial:["PARCIAL","🟡"],
      faltante:["FALTANTE","🔴"]
    }
    const [texto,punto] = mapa[estado] || [String(estado || "—").toUpperCase(),"⚪"]
    return `<span class="stock-status ${esc(estado)}">${punto} ${esc(texto)}</span>`
  }

  function valorStock(v, um) {
    if (v === null || v === undefined) return "—"
    return `${fmtCantidad(v)} ${esc(um)}`
  }

  function renderCruceStock(data) {
    stockCruceActual = data
    const resumen = data?.resumen || {}
    const ejecucion = data?.ejecucion || {}
    const filas = Array.isArray(data?.materiales) ? data.materiales : []
    const numero = lotes.find(l => Number(l.id) === Number(ejecucion.lote_id))?.numero || "—"

    $("stockCruceTitulo").textContent = `Lote ${String(numero).padStart(3,"0")} · Necesidad vs Stock`
    $("stockCruceResumen").innerHTML = `
      <div class="stock-resumen">
        <div class="stock-card"><span>Materiales</span><strong>${Number(resumen.materiales || 0)}</strong></div>
        <div class="stock-card"><span>Cubiertos</span><strong>${Number(resumen.cubiertos || 0)}</strong></div>
        <div class="stock-card"><span>Con faltante</span><strong>${Number(resumen.parciales || 0) + Number(resumen.faltantes || 0)}</strong></div>
        <div class="stock-card"><span>Sin stock registrado</span><strong>${Number(resumen.sin_registro || 0)}</strong></div>
      </div>
    `

    $("stockCruceBody").innerHTML = filas.length ? filas.map((m,index) => `
      <tr>
        <td><strong>${esc(m.material_nombre)}</strong></td>
        <td>${esc([m.especificacion,m.color].filter(Boolean).join(" · ") || "—")}</td>
        <td>${esc(m.um)}</td>
        <td class="num">${fmtCantidad(m.necesidad_global)} ${esc(m.um)}</td>
        <td class="num">${valorStock(m.stock_fisico,m.um)}</td>
        <td class="num">${valorStock(m.stock_reservado,m.um)}</td>
        <td class="num">${valorStock(m.stock_disponible,m.um)}</td>
        <td class="num">${valorStock(m.faltante,m.um)}</td>
        <td>${etiquetaEstadoStock(m.estado_stock)}</td>
        <td>
          ${!m.stock_registrado && m.variante_id
            ? `<button type="button" class="stock-action" data-saldo-index="${index}">Cargar saldo inicial</button>`
            : m.stock_registrado
              ? '<span class="explosion-chip">Registrado</span>'
              : '<span class="explosion-chip">Sin variante</span>'}
        </td>
      </tr>
    `).join("") : '<tr><td colspan="10" class="despiece-empty">No hay materiales para cruzar con Stock.</td></tr>'

    $("stockCruceBody").querySelectorAll("[data-saldo-index]").forEach(btn => {
      btn.onclick = () => {
        const fila = filas[Number(btn.dataset.saldoIndex)]
        if (fila) abrirSaldoInicial(fila)
      }
    })

    $("modalCruceStock").showModal()
  }

  async function verCruceStockLote(loteId) {
    try {
      const data = await api(`/api/despiece/lotes/${loteId}/cruce-stock`)
      renderCruceStock(data)
    } catch (err) {
      alert(err.message)
    }
  }

  function abrirSaldoInicial(fila) {
    saldoInicialActual = fila
    $("saldoMaterialInfo").innerHTML = `
      <strong>${esc(fila.material_nombre)}</strong><br>
      ${esc([fila.especificacion,fila.color].filter(Boolean).join(" · ") || "—")}
      · ${esc(fila.um)}
    `
    $("saldoCantidadLabel").textContent = `Cantidad inicial (${fila.um})`
    $("saldoCantidad").value = ""
    $("saldoObservacion").value = ""
    $("modalSaldoInicial").showModal()
    setTimeout(() => $("saldoCantidad").focus(), 0)
  }

  async function guardarSaldoInicial() {
    if (!saldoInicialActual?.variante_id) return

    const cantidad = Number($("saldoCantidad").value)
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      alert("Ingresá una cantidad válida. Puede ser 0 si confirmaste que no hay stock.")
      return
    }

    const btn = $("btnGuardarSaldoInicial")
    btn.disabled = true
    btn.textContent = "Guardando…"

    try {
      await api(`/api/stock/variantes/${saldoInicialActual.variante_id}/saldo-inicial`, {
        method:"POST",
        body:JSON.stringify({
          cantidad,
          observacion:$("saldoObservacion").value.trim()
        })
      })

      const loteId = Number(stockCruceActual?.ejecucion?.lote_id)
      $("modalSaldoInicial").close()
      saldoInicialActual = null
      if (loteId) {
        const actualizado = await api(`/api/despiece/lotes/${loteId}/cruce-stock`)
        renderCruceStock(actualizado)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Guardar saldo inicial"
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
              ${explosion ? `
                <button type="button" class="despiece-btn aptitud-action" data-ver-explosion-lote="${lote.id}">Ver Despiece</button>
                <button type="button" class="despiece-btn secondary aptitud-action" data-ver-global-lote="${lote.id}">Necesidad global</button>
                <button type="button" class="despiece-btn secondary aptitud-action" data-ver-stock-lote="${lote.id}">Cruce Stock</button>
              ` : ""}
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

    body.querySelectorAll("[data-ver-global-lote]").forEach(btn => {
      btn.onclick = () => verNecesidadGlobalLote(Number(btn.dataset.verGlobalLote))
    })

    body.querySelectorAll("[data-ver-stock-lote]").forEach(btn => {
      btn.onclick = () => verCruceStockLote(Number(btn.dataset.verStockLote))
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

  document.querySelectorAll("[data-close-global]").forEach(btn => {
    btn.onclick = () => $("modalNecesidadGlobal").close()
  })

  document.querySelectorAll("[data-close-stock]").forEach(btn => {
    btn.onclick = () => $("modalCruceStock").close()
  })

  document.querySelectorAll("[data-close-saldo]").forEach(btn => {
    btn.onclick = () => $("modalSaldoInicial").close()
  })

  $("btnCruzarStock").onclick = () => {
    const loteId = Number(necesidadGlobalActual?.ejecucion?.lote_id)
    if (!loteId) return
    $("modalNecesidadGlobal").close()
    verCruceStockLote(loteId)
  }

  $("btnGuardarSaldoInicial").onclick = guardarSaldoInicial

  $("btnVerNecesidadGlobal").onclick = () => {
    const loteId = Number(explosionActual?.ejecucion?.lote_id)
    if (!loteId) return
    $("modalExplosionDespiece").close()
    verNecesidadGlobalLote(loteId)
  }

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
