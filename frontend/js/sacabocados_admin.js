var sacabocados = []

async function cargarSacabocados() {
  try {
    const res = await apiFetch("/api/sacabocados")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error cargando sacabocados")
    }

    sacabocados = Array.isArray(data.sacabocados) ? data.sacabocados : []
    renderSacabocados()
  } catch (error) {
    console.error("Error cargando sacabocados:", error)
    alert(error.message || "Error cargando sacabocados")
  }
}

function renderSacabocados() {
  const tbody = document.getElementById("tablaSacabocados")
  const buscador = document.getElementById("buscadorSacabocados")
  const filtro = (buscador?.value || "").toLowerCase().trim()

  if (!tbody) return

  tbody.innerHTML = ""

  const filtrados = sacabocados.filter((s) => {
    const codigo = (s.codigo || "").toLowerCase()
    const marca = (s.marca || "").toLowerCase()
    const pieza = (s.pieza || "").toLowerCase()
    const subpieza = (s.subpieza || "").toLowerCase()
    const modelo = (s.modelo_referencia || "").toLowerCase()

    return (
      codigo.includes(filtro) ||
      marca.includes(filtro) ||
      pieza.includes(filtro) ||
      subpieza.includes(filtro) ||
      modelo.includes(filtro)
    )
  })

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">No hay sacabocados cargados</td>
      </tr>
    `
    return
  }

  filtrados.forEach((s) => {
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(s.codigo || "-")}</td>
        <td>${escapeHtml(s.marca || "-")}</td>
        <td>${escapeHtml(s.modelo_referencia || "-")}</td>
        <td>${escapeHtml(s.pieza || "-")}</td>
        <td>${escapeHtml(s.subpieza || "-")}</td>
        <td>${s.activo ? "Sí" : "No"}</td>
        <td style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" onclick="verSacabocado(${s.id})">👁 Ver</button>
          <button type="button" onclick="editarSacabocado(${s.id})">✏ Editar</button>
          <button type="button" onclick="eliminarSacabocado(${s.id})">🗑 Eliminar</button>
        </td>
      </tr>
    `
  })
}

function filtrarSacabocados() {
  renderSacabocados()
}

function nuevoSacabocado() {
  window.location.href = "sacabocados_crear_admin.html"
}

function verSacabocado(id) {
  window.location.href = `sacabocados_detalle_admin.html?id=${id}`
}

function editarSacabocado(id) {
  window.location.href = `sacabocados_crear_admin.html?id=${id}`
}

async function eliminarSacabocado(id) {
  const ok = confirm("¿Eliminar este sacabocado?")
  if (!ok) return

  try {
    const res = await apiFetch(`/api/sacabocados/${id}`, {
      method: "DELETE"
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error eliminando sacabocado")
    }

    alert("Sacabocado eliminado correctamente")
    await cargarSacabocados()
  } catch (error) {
    console.error("Error eliminando sacabocado:", error)
    alert(error.message || "Error eliminando sacabocado")
  }
}

function volver() {
  window.location.href = "admin.html"
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

