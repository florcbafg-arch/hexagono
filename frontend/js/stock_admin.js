window.initStock = async function initStock() {
  const token = localStorage.getItem("token")
  const $ = id => document.getElementById(id)
  let variantes = []
  let varianteActual = null

  const headers = {
    "Content-Type":"application/json",
    Authorization:"Bearer " + token
  }

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

  const fechaHora = value => {
    if (!value) return "—"
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("es-AR", {
      day:"2-digit",month:"2-digit",year:"numeric",
      hour:"2-digit",minute:"2-digit"
    })
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

    if (!res.ok) {
      throw new Error(data.error || "No se pudo completar la operación")
    }

    return data
  }

  function estadoVariante(v) {
    if (!v.stock_registrado) {
      return { key:"sin_registro", label:"SIN REGISTRO" }
    }
    if (Number(v.stock_fisico || 0) <= 0) {
      return { key:"agotado", label:"AGOTADO" }
    }
    if (Number(v.stock_reservado || 0) > 0) {
      return { key:"reservado", label:"CON RESERVA" }
    }
    return { key:"disponible", label:"DISPONIBLE" }
  }

  function detalleVariante(v) {
    return [v.especificacion,v.color].filter(Boolean).join(" · ") || "—"
  }

  function actualizarResumen() {
    $("stockTotalVariantes").textContent = variantes.length
    $("stockRegistradas").textContent = variantes.filter(v => v.stock_registrado).length
    $("stockSinRegistro").textContent = variantes.filter(v => !v.stock_registrado).length
    $("stockConReserva").textContent = variantes.filter(v => Number(v.stock_reservado || 0) > 0).length
  }

  function render() {
    const buscar = ($("stockBuscar").value || "").trim().toLowerCase()
    const filtro = $("stockFiltro").value

    const filtradas = variantes.filter(v => {
      const estado = estadoVariante(v)
      const texto = [
        v.material_nombre,
        v.especificacion,
        v.color,
        v.um,
        v.familia,
        v.origen
      ].join(" ").toLowerCase()

      if (buscar && !texto.includes(buscar)) return false
      if (filtro === "registrado" && !v.stock_registrado) return false
      if (filtro === "sin_registro" && v.stock_registrado) return false
      if (filtro === "con_reserva" && Number(v.stock_reservado || 0) <= 0) return false
      if (filtro === "agotado" && estado.key !== "agotado") return false
      return true
    })

    $("stockBody").innerHTML = filtradas.length ? filtradas.map(v => {
      const estado = estadoVariante(v)
      return `
        <tr>
          <td>
            <strong>${esc(v.material_nombre)}</strong>
            ${v.familia ? `<div style="font-size:12px;color:#667085">${esc(v.familia)}</div>` : ""}
          </td>
          <td>${esc(detalleVariante(v))}</td>
          <td>${esc(v.um)}</td>
          <td class="num">${v.stock_registrado ? fmt(v.stock_fisico) : "—"}</td>
          <td class="num">${v.stock_registrado ? fmt(v.stock_reservado) : "—"}</td>
          <td class="num">${v.stock_registrado ? fmt(v.stock_disponible) : "—"}</td>
          <td><span class="stock-chip ${estado.key}">${estado.label}</span></td>
          <td>${fechaHora(v.ultimo_movimiento)}</td>
          <td>
            <div class="stock-actions">
              ${v.stock_registrado
                ? `<button type="button" class="stock-btn" data-movimiento="${v.id}">+ Movimiento</button>
                   <button type="button" class="stock-btn secondary" data-historial="${v.id}">Historial</button>`
                : `<button type="button" class="stock-btn" data-inicial="${v.id}">Cargar saldo inicial</button>`}
            </div>
          </td>
        </tr>
      `
    }).join("") : '<tr><td colspan="9" class="stock-empty">No hay materiales que coincidan con el filtro.</td></tr>'

    $("stockBody").querySelectorAll("[data-movimiento]").forEach(btn => {
      btn.onclick = () => abrirMovimiento(Number(btn.dataset.movimiento))
    })
    $("stockBody").querySelectorAll("[data-inicial]").forEach(btn => {
      btn.onclick = () => abrirSaldoInicial(Number(btn.dataset.inicial))
    })
    $("stockBody").querySelectorAll("[data-historial]").forEach(btn => {
      btn.onclick = () => abrirHistorial(Number(btn.dataset.historial))
    })
  }

  async function cargar() {
    variantes = await api("/api/stock/variantes")
    actualizarResumen()
    render()
  }

  function abrirMovimiento(id) {
    const v = variantes.find(x => Number(x.id) === Number(id))
    if (!v) return
    varianteActual = v

    $("stockMovimientoTitulo").textContent = "Registrar movimiento"
    $("stockMovimientoMaterial").innerHTML = `
      <strong>${esc(v.material_nombre)}</strong><br>
      ${esc(detalleVariante(v))} · U.M. ${esc(v.um)}
    `
    $("stockMovimientoBalance").innerHTML = `
      <div><span>Físico</span><strong>${fmt(v.stock_fisico)} ${esc(v.um)}</strong></div>
      <div><span>Reservado</span><strong>${fmt(v.stock_reservado)} ${esc(v.um)}</strong></div>
      <div><span>Disponible</span><strong>${fmt(v.stock_disponible)} ${esc(v.um)}</strong></div>
    `
    $("stockCantidadLabel").textContent = `Cantidad (${v.um})`
    $("stockMovimientoTipo").value = "ingreso"
    $("stockMovimientoCantidad").value = ""
    $("stockMovimientoReferencia").value = ""
    $("stockMovimientoObservacion").value = ""
    $("modalStockMovimiento").showModal()
    setTimeout(() => $("stockMovimientoTipo").focus(), 0)
  }

  function abrirSaldoInicial(id) {
    const v = variantes.find(x => Number(x.id) === Number(id))
    if (!v) return
    varianteActual = v

    $("stockInicialMaterial").innerHTML = `
      <strong>${esc(v.material_nombre)}</strong><br>
      ${esc(detalleVariante(v))} · U.M. ${esc(v.um)}
    `
    $("stockInicialCantidadLabel").textContent = `Cantidad inicial (${v.um})`
    $("stockInicialCantidad").value = ""
    $("stockInicialObservacion").value = ""
    $("modalStockSaldoInicial").showModal()
    setTimeout(() => $("stockInicialCantidad").focus(), 0)
  }

  async function guardarMovimiento() {
    if (!varianteActual) return
    const cantidad = Number($("stockMovimientoCantidad").value)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert("Ingresá una cantidad mayor que cero.")
      return
    }

    const btn = $("btnGuardarMovimientoStock")
    btn.disabled = true
    btn.textContent = "Guardando…"

    try {
      await api(`/api/stock/variantes/${varianteActual.id}/movimientos`, {
        method:"POST",
        body:JSON.stringify({
          tipo:$("stockMovimientoTipo").value,
          cantidad,
          referencia:$("stockMovimientoReferencia").value.trim(),
          observacion:$("stockMovimientoObservacion").value.trim()
        })
      })

      $("modalStockMovimiento").close()
      varianteActual = null
      await cargar()
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Guardar movimiento"
    }
  }

  async function guardarSaldoInicial() {
    if (!varianteActual) return
    const cantidad = Number($("stockInicialCantidad").value)
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      alert("Ingresá una cantidad inicial válida.")
      return
    }

    const btn = $("btnGuardarSaldoInicialStock")
    btn.disabled = true
    btn.textContent = "Guardando…"

    try {
      await api(`/api/stock/variantes/${varianteActual.id}/saldo-inicial`, {
        method:"POST",
        body:JSON.stringify({
          cantidad,
          observacion:$("stockInicialObservacion").value.trim()
        })
      })

      $("modalStockSaldoInicial").close()
      varianteActual = null
      await cargar()
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
      btn.textContent = "Guardar saldo inicial"
    }
  }

  function etiquetaTipo(m) {
    if (m.tipo === "saldo_inicial") return "Saldo inicial"
    if (m.tipo === "ingreso_compra") return "Ingreso"
    if (m.tipo === "egreso_produccion") return "Egreso producción"
    if (m.tipo === "ajuste") return "Ajuste"
    if (m.tipo === "reserva") return "Reserva"
    if (m.tipo === "liberacion_reserva") return "Liberación reserva"
    if (m.tipo === "devolucion") return "Devolución"
    if (m.referencia_tipo === "salida_manual") return "Salida manual"
    return "Otro"
  }

  function deltaHtml(value) {
    const n = Number(value || 0)
    const cls = n > 0 ? "mov-pos" : n < 0 ? "mov-neg" : "mov-zero"
    const prefijo = n > 0 ? "+" : ""
    return `<span class="${cls}">${prefijo}${fmt(n)}</span>`
  }

  async function abrirHistorial(id) {
    const v = variantes.find(x => Number(x.id) === Number(id))
    if (!v) return
    varianteActual = v

    $("stockHistMaterial").innerHTML = `
      <strong>${esc(v.material_nombre)}</strong><br>
      ${esc(detalleVariante(v))} · U.M. ${esc(v.um)}
    `
    $("stockHistBody").innerHTML = '<tr><td colspan="10" class="stock-empty">Cargando historial…</td></tr>'
    $("modalStockHistorial").showModal()

    try {
      const movimientos = await api(`/api/stock/variantes/${id}/movimientos`)
      $("stockHistBody").innerHTML = movimientos.length ? movimientos.map(m => `
        <tr>
          <td>${fechaHora(m.created_at)}</td>
          <td><strong>${esc(etiquetaTipo(m))}</strong></td>
          <td class="num">${deltaHtml(m.delta_fisico)}</td>
          <td class="num">${deltaHtml(m.delta_reservado)}</td>
          <td class="num">${fmt(m.saldo_fisico_resultante)}</td>
          <td class="num">${fmt(m.saldo_reservado_resultante)}</td>
          <td class="num">${fmt(m.saldo_disponible_resultante)}</td>
          <td>${esc(m.usuario_nombre || "Sistema")}</td>
          <td>${esc([m.referencia_tipo,m.referencia_id].filter(Boolean).join(" · ") || "—")}</td>
          <td>${esc(m.observacion || "—")}</td>
        </tr>
      `).join("") : '<tr><td colspan="10" class="stock-empty">Todavía no hay movimientos.</td></tr>'
    } catch (err) {
      $("stockHistBody").innerHTML = `<tr><td colspan="10" class="stock-empty">${esc(err.message)}</td></tr>`
    }
  }

  function cerrar(dialogId) {
    const dialog = $(dialogId)
    if (dialog?.open) dialog.close()
    varianteActual = null
  }

  document.querySelectorAll("[data-close-mov]").forEach(btn => {
    btn.onclick = () => cerrar("modalStockMovimiento")
  })
  document.querySelectorAll("[data-close-inicial]").forEach(btn => {
    btn.onclick = () => cerrar("modalStockSaldoInicial")
  })
  document.querySelectorAll("[data-close-hist]").forEach(btn => {
    btn.onclick = () => cerrar("modalStockHistorial")
  })

  $("stockBuscar").oninput = render
  $("stockFiltro").onchange = render
  $("btnGuardarMovimientoStock").onclick = guardarMovimiento
  $("btnGuardarSaldoInicialStock").onclick = guardarSaldoInicial

  await cargar()
}
