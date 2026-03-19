let secciones = []

// 🔥 CARGAR MODELOS
async function cargarModelos() {
  const res = await fetch("/api/modelos")
  const data = await res.json()

  const select = document.getElementById("modelo")

  data.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`
  })
}

// ➕ AGREGAR SECCIÓN
function agregarSeccion() {
  secciones.push({
    nombre: "",
    piezas: []
  })

  renderSecciones()
}

// 🎨 RENDER SECCIONES
function renderSecciones() {
  const cont = document.getElementById("secciones")
  cont.innerHTML = ""

  secciones.forEach((sec, i) => {
    cont.innerHTML += `
      <div style="border:1px solid #ccc; margin:10px; padding:10px;">
        
        <input 
          placeholder="Nombre sección"
          value="${sec.nombre}"
          onchange="editarSeccion(${i}, this.value)"
        >

        <button onclick="agregarPieza(${i})">➕ Pieza</button>

        <div id="piezas_${i}"></div>

      </div>
    `

    renderPiezas(i)
  })
}

// ✏️ EDITAR SECCIÓN
function editarSeccion(i, valor) {
  secciones[i].nombre = valor
}

// ➕ AGREGAR PIEZA
function agregarPieza(i) {
  secciones[i].piezas.push({
    nombre: "",
    materiales: [],
    operaciones: []
  })

  renderSecciones()
}

// 🎨 RENDER PIEZAS
function renderPiezas(i) {
  const cont = document.getElementById(`piezas_${i}`)
  const piezas = secciones[i].piezas

  cont.innerHTML = ""

  piezas.forEach((p, j) => {
    cont.innerHTML += `
      <div style="margin-left:20px;">

        <input 
          placeholder="Nombre pieza"
          value="${p.nombre}"
          onchange="editarPieza(${i}, ${j}, this.value)"
        >

      </div>
    `
  })
}

// ✏️ EDITAR PIEZA
function editarPieza(i, j, valor) {
  secciones[i].piezas[j].nombre = valor
}

// 💾 GUARDAR
async function guardarFicha() {

  const modelo_id = document.getElementById("modelo").value
  const codigo = document.getElementById("codigo").value
  const nombre = document.getElementById("nombre").value

  const res = await fetch("/api/fichas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      modelo_id,
      codigo,
      nombre,
      secciones
    })
  })

  const data = await res.json()

  if (data.ok) {
    alert("Ficha creada")
    window.location.href = "fichas_admin.html"
  } else {
    alert("Error creando ficha")
  }
}

// 🔙 VOLVER
function volver() {
  window.location.href = "fichas_admin.html"
}

// 🚀 INIT
cargarModelos()