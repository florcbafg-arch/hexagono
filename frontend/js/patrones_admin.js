(() => {
  let patronActual = null
  let articuloActualId = null

  const esc = (v = "") => String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  async function leerJson(res) {
    let data = {}
    try { data = await res.json() } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || "No se pudo completar la operación")
      err.status = res.status
      throw err
    }
    return data
  }

  async function initPatrones() {
    await cargarArticulos()
    const select = document.getElementById("articuloSelect")
    select?.addEventListener("change", () => {
      if (select.value) cargarPatron(select.value)
      else limpiar()
    })
  }

  async function cargarArticulos() {
    const select = document.getElementById("articuloSelect")
    if (!select) return
    try {
      const data = await leerJson(await apiFetch("/api/articulos"))
      select.innerHTML = '<option value="">Seleccionar artículo</option>'
      ;(data || []).filter(a => a.activo !== false).forEach(a => {
        const opt = document.createElement("option")
        opt.value = a.id
        const marca = a.modelos?.marca || "Sin marca"
        const modelo = a.modelos?.nombre || "Sin modelo"
        opt.textContent = `${a.codigo} · ${marca} · ${modelo} · ${a.color}`
        select.appendChild(opt)
      })
    } catch (err) {
      console.error(err)
      mostrarMensaje("No se pudieron cargar los artículos.")
    }
  }

  function limpiar() {
    patronActual = null
    articuloActualId = null
    document.getElementById("patronBloques").innerHTML = ""
    document.getElementById("patronMeta").classList.remove("visible")
    document.getElementById("patronMeta").innerHTML = ""
    document.getElementById("patronActions").classList.remove("visible")
    mostrarMensaje("Seleccioná un artículo para cargar su patrón técnico.")
  }

  function mostrarMensaje(texto, ocultar = false) {
    const el = document.getElementById("patronMensaje")
    if (!el) return
    el.textContent = texto
    el.style.display = ocultar ? "none" : "block"
  }

  async function cargarPatron(articuloId) {
    articuloActualId = String(articuloId)
    patronActual = null
    document.getElementById("patronBloques").innerHTML = ""
    document.getElementById("patronActions").classList.remove("visible")
    mostrarMensaje("Cargando Ficha Técnica vigente…")

    try {
      const data = await leerJson(await apiFetch(`/api/patrones/v2/articulo/${articuloId}`))
      patronActual = data
      renderMeta(data)
      renderBloques(data)
      mostrarMensaje("", true)
      document.getElementById("patronActions").classList.add("visible")
    } catch (err) {
      console.error(err)
      document.getElementById("patronMeta").classList.remove("visible")
      const msg = err.status === 409
        ? err.message
        : "No se pudo cargar el patrón técnico."
      mostrarMensaje(msg)
    }
  }

  function renderMeta(data) {
    const a = data.articulo || {}
    const m = a.modelos || {}
    const f = data.ficha || {}
    const meta = document.getElementById("patronMeta")
    meta.innerHTML = `
      <div class="patron-meta-card"><small>Código</small><strong>${esc(a.codigo || "-")}</strong></div>
      <div class="patron-meta-card"><small>Artículo</small><strong>${esc(m.nombre || "-")} · ${esc(a.color || "-")}</strong></div>
      <div class="patron-meta-card"><small>Marca</small><strong>${esc(m.marca || "-")}</strong></div>
      <div class="patron-meta-card"><small>Ficha origen</small><strong>V${esc(f.version || "-")} · ${esc(f.estado || "-")}</strong></div>
      <div class="patron-meta-card"><small>Estado del patrón</small><strong class="patron-status">${data.patron_guardado ? "Guardado" : "Propuesta desde ficha"}</strong></div>
    `
    meta.classList.add("visible")
  }

  function opcionesUM(valor) {
    const valores = ["ML", "M2", "PLANCHA", "UNIDAD", "PAR"]
    const actual = String(valor || "").toUpperCase()
    if (actual && !valores.includes(actual)) valores.push(actual)
    return valores.map(v => `<option value="${esc(v)}" ${v === actual ? "selected" : ""}>${esc(v)}</option>`).join("")
  }

  function renderBloques(data) {
    const cont = document.getElementById("patronBloques")
    const bloques = Array.isArray(data.bloques) ? data.bloques : []
    if (!bloques.length) {
      cont.innerHTML = '<div class="patron-aviso">La Ficha vigente no tiene materiales para formar el patrón técnico.</div>'
      return
    }

    cont.innerHTML = bloques.map((bloque, bi) => `
      <div class="patron-bloque" data-bloque-index="${bi}">
        <div class="patron-bloque-head">
          <h3>Bloque técnico</h3>
          <input class="patron-bloque-input" value="${esc(bloque.bloque || "")}" aria-label="Nombre del bloque">
        </div>
        <table class="patron-tabla-v2">
          <thead><tr><th>Pieza</th><th>Material</th><th>Especificación / color</th><th>U.M.</th><th>Método de consumo</th></tr></thead>
          <tbody>
            ${(bloque.items || []).map((item, ii) => `
              <tr data-material-id="${item.ficha_material_id}" data-orden="${item.orden ?? ii + 1}">
                <td><strong>${esc(item.pieza || "-")}</strong>${item.sacabocado_id ? `<div class="patron-muted">Sacabocado #${esc(item.sacabocado_id)}</div>` : ""}</td>
                <td>${esc(item.material || "-")}</td>
                <td>${esc(item.color || item.especificacion || "-")}</td>
                <td><select class="patron-um">${opcionesUM(item.um || item.unidad_ficha)}</select></td>
                <td><select class="patron-metodo"><option value="" ${!item.metodo_consumo ? "selected" : ""}>Clasificar…</option><option value="rinde" ${item.metodo_consumo === "rinde" ? "selected" : ""}>Rinde por talle</option><option value="directo" ${item.metodo_consumo === "directo" ? "selected" : ""}>Consumo directo</option></select></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("")
  }

  function recolectarItems() {
    const items = []
    document.querySelectorAll(".patron-bloque").forEach(bloque => {
      const nombreBloque = bloque.querySelector(".patron-bloque-input")?.value?.trim() || "CORTE CAPELLADA"
      bloque.querySelectorAll("tbody tr[data-material-id]").forEach((fila, index) => {
        items.push({
          ficha_material_id: Number(fila.dataset.materialId),
          bloque: nombreBloque,
          um: fila.querySelector(".patron-um")?.value || "",
          metodo_consumo: fila.querySelector(".patron-metodo")?.value || null,
          orden: Number(fila.dataset.orden || index + 1)
        })
      })
    })
    return items
  }

  async function guardarPatron() {
    if (!articuloActualId) return alert("Seleccioná un artículo")
    const items = recolectarItems()
    if (!items.length) return alert("No hay materiales para guardar")

    try {
      const data = await leerJson(await apiFetch(`/api/patrones/v2/articulo/${articuloActualId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      }))
      alert(`Patrón técnico guardado · ${data.filas_guardadas} filas`)
      await cargarPatron(articuloActualId)
    } catch (err) {
      console.error(err)
      alert(err.message || "No se pudo guardar el patrón técnico")
    }
  }

  async function recargarPatron() {
    if (!articuloActualId) return
    await cargarPatron(articuloActualId)
  }

  window.initPatrones = initPatrones
  window.guardarPatron = guardarPatron
  window.recargarPatron = recargarPatron
})()