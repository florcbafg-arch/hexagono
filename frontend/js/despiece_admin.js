window.initDespiece = function initDespiece() {
  const $ = id => document.getElementById(id)
  const seleccionados = new Set()
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
      body.innerHTML = '<tr><td colspan="8" class="despiece-empty">No hay artículos confirmados pendientes de asignar a lote.</td></tr>'
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

    actualizarSeleccion()
  }

  function renderLotes() {
    const body = $("despieceLotesBody")
    if (!body) return

    $("despieceLotes").textContent = lotes.length

    if (!lotes.length) {
      body.innerHTML = '<tr><td colspan="6" class="despiece-empty">Todavía no hay lotes de Despiece creados.</td></tr>'
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
        </tr>
      `
    }).join("")
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
