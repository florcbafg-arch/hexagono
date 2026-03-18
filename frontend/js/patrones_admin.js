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
    const res = await fetch(API + "/modelos")
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
        <option value="">Seleccionar</option>
        ${opciones}
      </select>
    </td>

    <td><input placeholder="Ej: PU gamuzón"></td>

    <td>
      <select>
        <option value="m">m</option>
        <option value="m2">m2</option>
        <option value="unidad">unidad</option>
      </select>
    </td>

    <td><input type="number" step="0.01" placeholder="0.25"></td>

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
      pieza: inputs[0].value,
      material: inputs[1].value,
      unidad: inputs[2].value,
      consumo: parseFloat(inputs[3].value)
    })
  })

  await fetch(API + "/patrones", {
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

  const res = await fetch(API + "/patrones/calcular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelo_id, cantidad })
  })

  const data = await res.json()

  const div = document.getElementById("resultado")
  div.innerHTML = ""

  data.forEach(m => {
    const p = document.createElement("p")
    p.textContent = `${m.material} → ${m.total} ${m.unidad}`
    div.appendChild(p)
  })
}