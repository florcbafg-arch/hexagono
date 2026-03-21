const API = "http://localhost:3000/api"

const PIEZAS = [
  "Capellada",
  "Caña",
  "Lengua",
  "Cordonería",
  "Talón",
  "Forro",
  "Plantilla",
  "Suela"
]

// INIT
document.addEventListener("DOMContentLoaded", () => {
  cargarModelos()
  agregarFila()
})

// Cargar modelos
async function cargarModelos() {
  try {
    const res = await apiFetch("/api/modelos")
    const modelos = await res.json()

    const select = document.getElementById("modeloSelect")

    modelos.forEach(m => {
      const opt = document.createElement("option")
      opt.value = m.id
      opt.textContent = m.nombre
      select.appendChild(opt)
    })

  } catch (err) {
    console.error("Error cargando modelos:", err)
  }
}

// Agregar fila
function agregarFila() {
  const tbody = document.querySelector("#tablaPatrones tbody")

  const opciones = PIEZAS.map(p => `<option value="${p}">${p}</option>`).join("")

  const tr = document.createElement("tr")

tr.innerHTML = `
  <td>
    <select>
      <option value="CORTE REFUERZO">CORTE REFUERZO</option>
      <option value="CORTE FORRO">CORTE FORRO</option>
      <option value="CORTE CAPELLADA">CORTE CAPELLADA</option>
    </select>
  </td>

  <td>
    <select>
      <option value="">Seleccionar</option>
      ${opciones}
    </select>
  </td>

  <td><input placeholder="Material"></td>

  <td><input placeholder="Color"></td>

  <td>
    <select>
      <option value="m">m</option>
      <option value="m2">m2</option>
      <option value="unidad">unidad</option>
      <option value="plancha">plancha</option>
    </select>
  </td>

  <td><input type="number" step="0.01"></td>

  <td>
    <button onclick="this.parentElement.parentElement.remove()">❌</button>
  </td>
`

  tbody.appendChild(tr)
}
// Guardar patrón
async function guardarPatron() {
  const modelo_id = document.getElementById("modeloSelect").value

  if (!modelo_id) {
    alert("Seleccioná un modelo")
    return
  }

  const filas = document.querySelectorAll("#tablaPatrones tbody tr")

  const patrones = []

  filas.forEach(f => {
    const inputs = f.querySelectorAll("input, select")

    if (!inputs[0].value) return

    patrones.push({
  bloque: inputs[0].value,
  pieza: inputs[1].value,
  material: inputs[2].value,
  color: inputs[3].value,
  unidad: inputs[4].value,
  consumo: parseFloat(inputs[5].value)
})
  })

  await await apiFetch("/api/patrones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelo_id, patrones })
  })

  alert("Patrón guardado")
}

// Calcular consumo
async function calcular() {
  const modelo_id = document.getElementById("modeloSelect").value
  const cantidad = document.getElementById("cantidad").value

  if(!modelo_id){
  alert("Seleccioná un modelo")
  return
}

if(!cantidad || cantidad <= 0){
  alert("Ingresá cantidad válida")
  return
}

  const res = await apiFetch("/api/patrones/calcular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelo_id, cantidad })
  })

  const data = await res.json()

  const div = document.getElementById("resultado")
  div.innerHTML = ""

  data.forEach(b => {

  const titulo = document.createElement("h4")
  titulo.textContent = b.bloque
  div.appendChild(titulo)

  b.items.forEach(m => {
    const p = document.createElement("p")
    p.textContent = `${m.material} (${m.color}) → ${m.total} ${m.unidad}`
    div.appendChild(p)
  })

})
}