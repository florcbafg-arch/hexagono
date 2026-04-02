(() => {
let fichas = []

async function cargarFichas() {
  try {
    const res = await apiFetch("/api/fichas")
    const data = await res.json()

    fichas = Array.isArray(data) ? data : []
    renderFichas()
  } catch (error) {
    console.error("Error cargando fichas:", error)
    alert("Error cargando fichas")
  }
}

function renderFichas() {
  const tbody = document.getElementById("tablaFichas")
  const buscador = document.getElementById("buscador")
  const filtro = (buscador?.value || "").toLowerCase().trim()

  tbody.innerHTML = ""

  const filtradas = fichas.filter(f =>
    (f.nombre || "").toLowerCase().includes(filtro) ||
    (f.codigo || "").toLowerCase().includes(filtro) ||
    (f.modelo_nombre || "").toLowerCase().includes(filtro)
  )

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">No hay fichas técnicas cargadas</td>
      </tr>
    `
    return
  }

  filtradas.forEach(f => {
    const tienePDF = !!f.pdf_url
    const fuente = f.fuente || "-"
    const pdfBoton = tienePDF
      ? `<button onclick="verPDF('${f.pdf_url}')">📄 PDF</button>`
      : `<span style="color:#888;">Sin PDF</span>`

    tbody.innerHTML += `
      <tr>
        <td>${f.modelo_nombre || "-"}</td>
        <td>${f.codigo || "-"}</td>
        <td>${f.nombre || "-"}</td>
        <td>${fuente}</td>
        <td>${tienePDF ? "Sí" : "No"}</td>
        <td>
  <button onclick="verFicha(${f.modelo_id})">👁 Ver</button>
  <button onclick="editarFicha(${f.modelo_id})">✏ Editar</button>
  ${pdfBoton}
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

function editarFicha(modelo_id) {
  window.location.href = `fichas_crear_admin.html?modelo_id=${modelo_id}`
}

function verPDF(pdf_url) {
  if (!pdf_url) return

  let ruta = pdf_url.trim()

  if (!ruta.startsWith("http") && !ruta.startsWith("/")) {
    ruta = "/" + ruta
  }

  const url = ruta.startsWith("http")
    ? ruta
    : window.location.origin + ruta

  window.location.href = url
}

function filtrarFichas() {
  renderFichas()
}
 
function initFichas() {
  cargarFichas()
}

window.initFichas = initFichas
window.crearFicha = crearFicha
window.verFicha = verFicha
window.editarFicha = editarFicha
window.verPDF = verPDF
window.filtrarFichas = filtrarFichas
})()