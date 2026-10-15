window.initArticulos = function () {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token }
  let modelos = []
  let seleccionado = null
  let articulos = []

  const $ = id => document.getElementById(id)
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))

  async function api(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "No se pudo completar la operación")
    return data
  }

  function mensaje(texto, error = false) {
    const box = $("maestroMensaje")
    box.textContent = texto
    box.classList.toggle("error", error)
    box.hidden = false
    setTimeout(() => { box.hidden = true }, 3500)
  }

  async function cargarModelos() {
    modelos = await api("/api/maestro/modelos")
    renderModelos()
    if (seleccionado) {
      const vigente = modelos.find(m => m.id === seleccionado.id)
      if (vigente) await seleccionarModelo(vigente)
    }
  }

  function renderModelos() {
    const q = $("buscarModelo").value.trim().toLowerCase()
    const visibles = modelos.filter(m => (m.marca + " " + m.nombre).toLowerCase().includes(q))
    $("listaModelos").innerHTML = visibles.length ? visibles.map(m => `
      <button class="modelo-item ${seleccionado?.id === m.id ? "active" : ""}" data-modelo="${m.id}">
        <span>${esc(m.marca)}</span><strong>${esc(m.nombre)}</strong>
      </button>`).join("") : '<div class="empty-state compact">No hay modelos.</div>'
    document.querySelectorAll("[data-modelo]").forEach(b => b.onclick = () => {
      const m = modelos.find(x => x.id === Number(b.dataset.modelo))
      if (m) seleccionarModelo(m)
    })
  }

  async function seleccionarModelo(modelo) {
    seleccionado = modelo
    renderModelos()
    $("sinModelo").hidden = true
    $("detalleModelo").hidden = false
    $("detalleMarca").textContent = modelo.marca
    $("detalleNombre").textContent = modelo.nombre
    const data = await api("/api/articulos/modelo/" + modelo.id)
    articulos = data.articulos || []
    renderArticulos()
  }

  function renderArticulos() {
    $("tablaArticulos").innerHTML = articulos.map(a => `
      <tr>
        <td><strong>${esc(a.codigo)}</strong></td>
        <td>${esc(a.color)}</td>
        <td><span class="estado-chip ${a.activo ? "" : "archivado"}">${a.activo ? "Activo" : "Archivado"}</span></td>
        <td>
          <button class="btn-link" data-edit-art="${a.id}">Editar</button>
          <button class="btn-link" data-state-art="${a.id}">${a.activo ? "Archivar" : "Reactivar"}</button>
        </td>
      </tr>`).join("")
    $("sinArticulos").hidden = articulos.length > 0
    document.querySelectorAll("[data-edit-art]").forEach(b => b.onclick = () => abrirArticulo(articulos.find(a => a.id === Number(b.dataset.editArt))))
    document.querySelectorAll("[data-state-art]").forEach(b => b.onclick = () => cambiarEstado(articulos.find(a => a.id === Number(b.dataset.stateArt))))
  }

  function abrirModelo(modelo = null) {
    $("tituloModalModelo").textContent = modelo ? "Editar modelo" : "Nuevo modelo"
    $("modeloId").value = modelo?.id || ""
    $("modeloMarca").value = modelo?.marca || ""
    $("modeloNombre").value = modelo?.nombre || ""
    $("modalModelo").showModal()
  }

  function abrirArticulo(articulo = null) {
    if (!seleccionado) return
    $("tituloModalArticulo").textContent = articulo ? "Editar artículo" : "Nuevo artículo"
    $("articuloId").value = articulo?.id || ""
    $("articuloCodigo").value = articulo?.codigo || ""
    $("articuloColor").value = articulo?.color || ""
    $("modalArticulo").showModal()
  }

  async function cambiarEstado(a) {
    if (!a) return
    await api("/api/articulos/" + a.id + "/estado", { method: "PATCH", body: JSON.stringify({ activo: !a.activo }) })
    mensaje(a.activo ? "Artículo archivado." : "Artículo reactivado.")
    await seleccionarModelo(seleccionado)
  }

  $("btnNuevoModelo").onclick = () => abrirModelo()
  $("btnEditarModelo").onclick = () => abrirModelo(seleccionado)
  $("btnNuevoArticulo").onclick = () => abrirArticulo()
  $("buscarModelo").oninput = renderModelos
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => $(b.dataset.close).close())

  $("formModeloMaestro").onsubmit = async e => {
    e.preventDefault()
    const id = Number($("modeloId").value)
    const body = JSON.stringify({ marca: $("modeloMarca").value, nombre: $("modeloNombre").value })
    try {
      const guardado = await api(id ? "/api/maestro/modelos/" + id : "/api/maestro/modelos", { method: id ? "PUT" : "POST", body })
      $("modalModelo").close()
      seleccionado = guardado
      mensaje(id ? "Modelo actualizado." : "Modelo creado.")
      await cargarModelos()
    } catch (err) { mensaje(err.message, true) }
  }

  $("formArticuloMaestro").onsubmit = async e => {
    e.preventDefault()
    const id = Number($("articuloId").value)
    const body = JSON.stringify({ modelo_id: seleccionado.id, codigo: $("articuloCodigo").value, color: $("articuloColor").value })
    try {
      await api(id ? "/api/articulos/" + id : "/api/articulos", { method: id ? "PUT" : "POST", body })
      $("modalArticulo").close()
      mensaje(id ? "Artículo actualizado." : "Artículo creado.")
      await seleccionarModelo(seleccionado)
    } catch (err) { mensaje(err.message, true) }
  }

  cargarModelos().catch(err => mensaje(err.message, true))
}