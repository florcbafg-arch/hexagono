let fichas = []

async function cargarFichas() {
  const res = await fetch("/api/fichas")
  const data = await res.json()

  fichas = data
  renderFichas()
}

function renderFichas() {
  const tbody = document.getElementById("tablaFichas")
  const filtro = document.getElementById("buscador").value.toLowerCase()

  tbody.innerHTML = ""

  fichas
    .filter(f => 
      f.nombre.toLowerCase().includes(filtro) ||
      f.codigo.toLowerCase().includes(filtro)
    )
    .forEach(f => {

      tbody.innerHTML += `
        <tr>
          <td>${f.modelo_nombre || "-"}</td>
          <td>${f.codigo}</td>
          <td>${f.nombre}</td>
          <td>
            <button onclick="verFicha(${f.modelo_id})">👁</button>
            <button onclick="editarFicha(${f.id})">✏️</button>
            <button onclick="eliminarFicha(${f.id})">🗑</button>
          </td>
        </tr>
      `
    })
}

function crearFicha() {
    window.location.href = "fichas_crear_admin.html"
}

function verFicha(modelo_id) {
  window.location.href = `fichas_detalle_admin.html?modelo_id=${modelo_id}`
}

function editarFicha(id) {
  window.location.href = `fichas_crear_admin.html?id=${id}`
}

async function eliminarFicha(id) {
  if (!confirm("¿Eliminar ficha?")) return

  try {
    const res = await fetch(`/api/fichas/${id}`, {
      method: "DELETE"
    })

    if (!res.ok) {
      alert("Error eliminando ficha")
      return
    }

    alert("Ficha eliminada")
    cargarFichas()

  } catch (error) {
    console.error(error)
    alert("Error de conexión")
  }
}

