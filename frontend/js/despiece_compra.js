window.initDespieceCompra = function initDespieceCompra() {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type":"application/json", Authorization:"Bearer " + token }
  const $ = id => document.getElementById(id)
  let necesidadActual = null
  let parametroActual = null

  const esc = value => String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;")

  const fmt = value => {
    const n = Number(value)
    if (!Number.isFinite(n)) return "—"
    return n.toLocaleString("es-AR", { maximumFractionDigits:8 })
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers:{ ...headers, ...(options.headers || {}) }
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("hexagono_user")
      window.location.href = "login.html"
      throw new Error("Sesión expirada")
    }
    if (!res.ok) throw new Error(data.error || "No se pudo completar la operación")
    return data
  }

  function estadoCompra(estado) {
    const mapa = {
      pendiente_stock:"PENDIENTE STOCK",
      pendiente_parametros:"FALTA PARAMETRIZAR",
      no_requiere:"NO REQUIERE",
      listo:"LISTO PARA COMPRA"
    }
    return `<span class="compra-status ${esc(estado)}">${esc(mapa[estado] || String(estado || "—").toUpperCase())}</span>`
  }

  function render(data) {
    necesidadActual = data
    const resumen = data?.resumen || {}
    const ejecucion = data?.ejecucion || {}
    const filas = Array.isArray(data?.materiales) ? data.materiales : []

    $("compraTitulo").textContent = `Necesidad de compra · Despiece V${Number(ejecucion.version || 1)}`
    $("compraResumen").innerHTML = `
      <div class="compra-resumen">
        <div class="compra-card"><span>Listos para compra</span><strong>${Number(resumen.requieren_compra || 0)}</strong></div>
        <div class="compra-card"><span>Falta parametrizar</span><strong>${Number(resumen.pendientes_parametros || 0)}</strong></div>
        <div class="compra-card"><span>Pendientes de Stock</span><strong>${Number(resumen.pendientes_stock || 0)}</strong></div>
        <div class="compra-card"><span>No requieren compra</span><strong>${Number(resumen.no_requieren || 0)}</strong></div>
      </div>`

    $("compraBody").innerHTML = filas.length ? filas.map((m,index) => {
      const p = m.parametros_compra || null
      const unidadCompra = p?.unidad_compra || m.unidad_compra || ""
      return `
        <tr>
          <td><strong>${esc(m.material_nombre)}</strong></td>
          <td>${esc([m.especificacion,m.color].filter(Boolean).join(" · ") || "—")}</td>
          <td class="num">${m.faltante === null || m.faltante === undefined ? "—" : `${fmt(m.faltante)} ${esc(m.um)}`}</td>
          <td>${esc(m.um)}</td>
          <td>${esc(unidadCompra || "—")}</td>
          <td class="num">${p ? fmt(p.factor_conversion) : "—"}</td>
          <td class="num">${m.necesidad_compra === null || m.necesidad_compra === undefined ? "—" : `${fmt(m.necesidad_compra)} ${esc(unidadCompra)}`}</td>
          <td class="num">${m.compra_minima === null || m.compra_minima === undefined ? "—" : `${fmt(m.compra_minima)} ${esc(unidadCompra)}`}</td>
          <td>${m.plazo_entrega_dias === null || m.plazo_entrega_dias === undefined ? "—" : `${Number(m.plazo_entrega_dias)} días`}</td>
          <td>${estadoCompra(m.estado_compra)}</td>
          <td>${m.variante_id ? `<button type="button" class="stock-action" data-param-index="${index}">${p ? "Editar parámetros" : "Parametrizar"}</button>` : `<span class="explosion-chip">Sin variante</span>`}</td>
        </tr>`
    }).join("") : `<tr><td colspan="11" class="despiece-empty">No hay materiales para evaluar.</td></tr>`

    $("compraBody").querySelectorAll("[data-param-index]").forEach(btn => {
      btn.onclick = () => {
        const fila = filas[Number(btn.dataset.paramIndex)]
        if (fila) abrirParametros(fila)
      }
    })

    const pendientes = Number(resumen.pendientes_stock || 0) + Number(resumen.pendientes_parametros || 0)
    $("btnCerrarCompra").disabled = pendientes > 0
    $("btnCerrarCompra").title = pendientes > 0
      ? "Completá Stock y parámetros de compra antes de cerrar el Despiece."
      : "Congelar esta versión para Compras."

    $("modalNecesidadCompra").showModal()
  }

  async function abrirNecesidad(loteId) {
    const data = await api(`/api/despiece/lotes/${loteId}/necesidad-compra`)
    render(data)
  }

  function actualizarAyuda() {
    if (!parametroActual) return
    const consumo = parametroActual.um || ""
    const compra = $("paramUnidadCompra").value.trim().toUpperCase() || "UNIDAD DE COMPRA"
    const factor = Number($("paramFactorConversion").value)
    const factorTxt = Number.isFinite(factor) && factor > 0 ? fmt(factor) : "X"
    $("paramCompraAyuda").innerHTML = `Lectura: <strong>1 ${esc(compra)} = ${esc(factorTxt)} ${esc(consumo)}</strong>. Hexaflow divide el faltante en ${esc(consumo)} por ese factor para obtener la necesidad en ${esc(compra)}.`
  }

  function abrirParametros(fila) {
    parametroActual = fila
    const p = fila.parametros_compra || null
    $("paramCompraMaterialInfo").innerHTML = `<strong>${esc(fila.material_nombre)}</strong><br>${esc([fila.especificacion,fila.color].filter(Boolean).join(" · ") || "—")} · Faltante: ${fila.faltante === null || fila.faltante === undefined ? "—" : `${fmt(fila.faltante)} ${esc(fila.um)}`}`
    $("paramUnidadConsumo").value = fila.um || ""
    $("paramUnidadCompra").value = p?.unidad_compra || fila.um || ""
    $("paramFactorConversion").value = p?.factor_conversion ?? 1
    $("paramCompraMinima").value = p?.compra_minima ?? 0
    $("paramPlazoEntrega").value = p?.plazo_entrega_dias ?? ""
    actualizarAyuda()
    $("modalNecesidadCompra").close()
    $("modalParametrosCompra").showModal()
    setTimeout(() => $("paramUnidadCompra").focus(), 0)
  }

  async function guardarParametros() {
    if (!parametroActual?.variante_id) return
    const unidadCompra = $("paramUnidadCompra").value.trim().toUpperCase()
    const factor = Number($("paramFactorConversion").value)
    const compraMinima = Number($("paramCompraMinima").value || 0)
    const plazoTxt = $("paramPlazoEntrega").value.trim()
    if (!unidadCompra) return alert("Definí la unidad de compra.")
    if (!Number.isFinite(factor) || factor <= 0) return alert("El factor de conversión debe ser mayor que cero.")
    if (!Number.isFinite(compraMinima) || compraMinima < 0) return alert("La compra mínima no puede ser negativa.")
    if (plazoTxt && (!Number.isInteger(Number(plazoTxt)) || Number(plazoTxt) < 0)) return alert("El plazo debe ser un número entero de días.")

    const btn = $("btnGuardarParametrosCompra")
    btn.disabled = true
    btn.textContent = "Guardando…"
    try {
      await api(`/api/stock/variantes/${parametroActual.variante_id}/parametros-compra`, {
        method:"PUT",
        body:JSON.stringify({
          unidad_compra:unidadCompra,
          factor_conversion:factor,
          compra_minima:compraMinima,
          plazo_entrega_dias:plazoTxt ? Number(plazoTxt) : null
        })
      })
      const loteId = Number($("modalCruceStock")?.dataset?.loteId || necesidadActual?.ejecucion?.lote_id)
      $("modalParametrosCompra").close()
      parametroActual = null
      if (loteId) await abrirNecesidad(loteId)
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Guardar parámetros"
    }
  }

  function fechaHora(value) {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString("es-AR", {
      day:"2-digit", month:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    })
  }

  function construirDocumentoInforme(data) {
    const lote = data?.lote || {}
    const ejecucion = data?.ejecucion || {}
    const resumen = data?.resumen || {}
    const filas = Array.isArray(data?.materiales) ? data.materiales : []
    const cerrado = data?.documento_cerrado
    const estado = cerrado ? "CERRADO PARA COMPRAS" : data?.puede_cerrar ? "LISTO PARA CERRAR" : "BORRADOR · INCOMPLETO"

    return `
      <div class="informe-doc" id="informeCompraDocPrint">
        <h2>NECESIDAD DE COMPRA DE MATERIAS PRIMAS</h2>
        <div class="informe-doc-badge">${esc(estado)}</div>
        <div class="informe-doc-meta">
          <div><strong>Lote de Compra N.º:</strong> ${esc(String(lote.numero || "").padStart(3,"0"))}</div>
          <div><strong>Despiece:</strong> V${Number(ejecucion.version || 1)}</div>
          <div><strong>Descripción:</strong> ${esc(lote.descripcion || "—")}</div>
          <div><strong>Pares del lote:</strong> ${Number(ejecucion.total_pares || 0)}</div>
          <div><strong>Materiales consolidados:</strong> ${Number(resumen.materiales || filas.length)}</div>
          <div><strong>Generado:</strong> ${cerrado ? fechaHora(cerrado.cerrado_at) : fechaHora(new Date().toISOString())}</div>
        </div>
        <table class="informe-doc-table">
          <thead>
            <tr>
              <th>Material + color</th>
              <th>U. consumo</th>
              <th>Necesidad</th>
              <th>Stock disp.</th>
              <th>Faltante</th>
              <th>U. compra</th>
              <th>Factor</th>
              <th>Necesidad compra</th>
              <th>Mínimo</th>
              <th>Plazo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map(m => {
              const p = m.parametros_compra || null
              const uCompra = p?.unidad_compra || m.unidad_compra || ""
              return `
                <tr>
                  <td><strong>${esc(m.material_nombre)}</strong><br>${esc([m.especificacion,m.color].filter(Boolean).join(" · ") || "—")}</td>
                  <td>${esc(m.um || m.unidad_consumo || "—")}</td>
                  <td class="num">${fmt(m.necesidad_global)}</td>
                  <td class="num">${m.stock_disponible === null || m.stock_disponible === undefined ? "—" : fmt(m.stock_disponible)}</td>
                  <td class="num">${m.faltante === null || m.faltante === undefined ? "—" : fmt(m.faltante)}</td>
                  <td>${esc(uCompra || "—")}</td>
                  <td class="num">${p?.factor_conversion ?? m.factor_conversion ? fmt(p?.factor_conversion ?? m.factor_conversion) : "—"}</td>
                  <td class="num">${m.necesidad_compra === null || m.necesidad_compra === undefined ? "—" : fmt(m.necesidad_compra)}</td>
                  <td class="num">${m.compra_minima === null || m.compra_minima === undefined ? "—" : fmt(m.compra_minima)}</td>
                  <td>${m.plazo_entrega_dias === null || m.plazo_entrega_dias === undefined ? "—" : Number(m.plazo_entrega_dias) + " días"}</td>
                  <td>${esc(String(m.estado_compra || "").replaceAll("_"," ").toUpperCase())}</td>
                </tr>
              `
            }).join("")}
          </tbody>
        </table>
        <div class="informe-doc-foot">
          <span>Listos para compra: ${Number(resumen.requieren_compra || 0)}</span>
          <span>No requieren compra: ${Number(resumen.no_requieren || 0)}</span>
        </div>
      </div>
    `
  }

  async function abrirInformeCompra() {
    const loteId = Number(necesidadActual?.ejecucion?.lote_id || $("modalCruceStock")?.dataset?.loteId)
    if (!loteId) return alert("No se pudo identificar el lote activo.")

    try {
      const data = await api(`/api/despiece/lotes/${loteId}/informe-compra`)
      $("informeCompraDocumento").innerHTML = construirDocumentoInforme(data)

      if (data.documento_cerrado) {
        $("informeCompraEstado").innerHTML = '<div class="informe-alerta ok">✅ Esta versión del Despiece ya está cerrada para Compras y su documento quedó congelado.</div>'
        $("informeCompraNota").textContent = "Documento cerrado e inmutable."
      } else if (data.puede_cerrar) {
        $("informeCompraEstado").innerHTML = '<div class="informe-alerta ok">✅ Todos los materiales están resueltos. El Despiece puede cerrarse para Compras.</div>'
        $("informeCompraNota").textContent = "Vista previa lista para cierre."
      } else {
        $("informeCompraEstado").innerHTML = `<div class="informe-alerta warn"><strong>BORRADOR INCOMPLETO.</strong><br>${(data.bloqueos || []).map(esc).join("<br>")}</div>`
        $("informeCompraNota").textContent = "La impresión está permitida como borrador, pero no puede cerrarse para Compras."
      }

      $("modalNecesidadCompra").close()
      $("modalInformeCompra").showModal()
    } catch (err) {
      alert(err.message)
    }
  }

  function imprimirInformeCompra() {
    const origen = $("informeCompraDocPrint")
    if (!origen) return

    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden","true")
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
      return alert("No se pudo preparar la impresión.")
    }

    const estilos = `
      @page { size:A4 portrait; margin:10mm; }
      * { box-sizing:border-box; }
      html,body { margin:0; padding:0; background:#fff; color:#111; }
      body { font-family:Arial,Helvetica,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .informe-doc { width:190mm; max-width:190mm; margin:0 auto; padding:3mm 1mm; border:0; }
      .informe-doc h2 { text-align:center; margin:0 0 4mm; font-size:14pt; }
      .informe-doc-badge { text-align:center; font-weight:700; font-size:8pt; padding:2mm; border:.25mm solid #999; margin-bottom:3mm; }
      .informe-doc-meta { display:grid; grid-template-columns:1fr 1fr; gap:1.2mm 7mm; font-size:7.5pt; margin-bottom:3mm; }
      .informe-doc-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:6.6pt; }
      .informe-doc-table th,.informe-doc-table td { border:.2mm solid #999; padding:1.1mm 1mm; vertical-align:top; overflow-wrap:anywhere; }
      .informe-doc-table th { background:#ececec; font-weight:700; }
      .informe-doc-table th:first-child { width:35mm; }
      .informe-doc-table td.num { text-align:right; white-space:nowrap; }
      .informe-doc-foot { display:flex; justify-content:flex-end; gap:7mm; margin-top:3mm; font-size:7.5pt; font-weight:700; }
      tr { break-inside:avoid; page-break-inside:avoid; }
    `

    doc.open()
    doc.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Necesidad de compra</title><style>${estilos}</style></head><body>${origen.outerHTML}</body></html>`)
    doc.close()

    const limpiar = () => setTimeout(() => iframe.remove(), 500)
    iframe.contentWindow.addEventListener("afterprint", limpiar, { once:true })
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    }, 120)
  }

  async function cerrarParaCompras() {
    const loteId = Number(necesidadActual?.ejecucion?.lote_id)
    if (!loteId) return

    if (!confirm("Esta acción congelará esta versión del Despiece para Compras. Después no se editará directamente. ¿Continuar?")) return

    const btn = $("btnCerrarCompra")
    btn.disabled = true
    btn.textContent = "Cerrando…"
    try {
      const resultado = await api(`/api/despiece/lotes/${loteId}/cerrar-compra`, {
        method:"POST",
        body:JSON.stringify({})
      })
      alert(`Despiece cerrado para Compras. Documento #${resultado.documento.id} guardado.`)
      await abrirInformeCompra()
    } catch (err) {
      alert(err.message)
      btn.disabled = false
    } finally {
      btn.textContent = "✅ Cerrar para Compras"
    }
  }

  $("btnVerNecesidadCompra").onclick = async () => {
    const loteId = Number($("modalCruceStock")?.dataset?.loteId)
    if (!loteId) return alert("No se pudo identificar el lote activo.")
    $("modalCruceStock").close()
    try { await abrirNecesidad(loteId) } catch (err) { alert(err.message) }
  }

  document.querySelectorAll("[data-close-compra]").forEach(btn => {
    btn.onclick = () => $("modalNecesidadCompra").close()
  })

  document.querySelectorAll("[data-close-param-compra]").forEach(btn => {
    btn.onclick = () => {
      $("modalParametrosCompra").close()
      parametroActual = null
      if (necesidadActual) render(necesidadActual)
    }
  })

  document.querySelectorAll("[data-close-informe]").forEach(btn => {
    btn.onclick = () => {
      $("modalInformeCompra").close()
      if (necesidadActual) render(necesidadActual)
    }
  })

  $("paramUnidadCompra").oninput = actualizarAyuda
  $("paramFactorConversion").oninput = actualizarAyuda
  $("btnGuardarParametrosCompra").onclick = guardarParametros
  $("btnVistaPreviaCompra").onclick = abrirInformeCompra
  $("btnImprimirInformeCompra").onclick = imprimirInformeCompra
  $("btnCerrarCompra").onclick = cerrarParaCompras
}
