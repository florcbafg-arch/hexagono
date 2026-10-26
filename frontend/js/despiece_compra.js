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

  $("paramUnidadCompra").oninput = actualizarAyuda
  $("paramFactorConversion").oninput = actualizarAyuda
  $("btnGuardarParametrosCompra").onclick = guardarParametros
}
