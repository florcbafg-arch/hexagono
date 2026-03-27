// dashboard_admin.js

function actualizarTiempo(){
  const ahora = new Date()
  const fecha = ahora.toLocaleDateString()
  const hora = ahora.toLocaleTimeString()

  const el = document.getElementById("infoTiempo")
  if(el){
    el.innerHTML = "Fecha: " + fecha + " | Hora actual: " + hora
  }
}

function mostrarAlertas(data, faltantes) {
  const panel = document.getElementById("panelAlertas")
  if (!panel) return

  panel.innerHTML = ""

  if (!Array.isArray(data)) return

  data.forEach(sector => {
    const prod = sector.produccion || 0
    const obj = sector.objetivo || 100

    if (prod === 0 && obj > 0) {
      panel.innerHTML += `<li>⚠ ${sector.nombre} sin producción</li>`
    }

    if (prod > 0 && prod < obj * 0.2) {
      panel.innerHTML += `<li>⚠ ${sector.nombre} producción baja</li>`
    }
  })
}
async function actualizarDashboard() {
  let total = 0
  let peorPorcentaje = 100
  let sectorLento = "-"

  try {
    const res = await apiFetch("/api/dashboard")
    const data = await res.json()

    if (!res.ok) {
      console.error("Error dashboard:", data)
      mostrarAlertas([], [])
      return
    }

    if (!Array.isArray(data)) {
      console.error("Dashboard inválido:", data)
      mostrarAlertas([], [])
      return
    }

    const faltantes = []

    for (let i = 0; i < data.length; i++) {
      const sector = data[i]

      const produccion = sector.produccion || 0
      const objetivo = sector.objetivo || 100

      total += produccion

      const porcentaje = objetivo > 0
        ? Math.round((produccion / objetivo) * 100)
        : 0

      if (objetivo > 0 && porcentaje < peorPorcentaje) {
        peorPorcentaje = porcentaje
        sectorLento = String(sector.nombre)
      }
    }

    mostrarAlertas(data, faltantes)

  } catch (err) {
    console.error("Error dashboard", err)
  }

  const ahora = new Date()
  const inicio = new Date()
  inicio.setHours(7, 15, 0, 0)

  let horas = (ahora - inicio) / 3600000
  if (horas < 1) horas = 1

  const ritmo = Math.round(total / horas)

  const ritmoEl = document.getElementById("ritmoProduccion")
  const totalEl = document.getElementById("totalProduccion")
  const sectorEl = document.getElementById("sectorLento")

  if (ritmoEl) ritmoEl.innerText = ritmo
  if (totalEl) totalEl.innerText = total
  if (sectorEl) sectorEl.textContent = String(sectorLento)
}

async function cargarObjetivos(){
  try{
    const res = await apiFetch("/api/objetivos")
    const data = await res.json()

    data.forEach(o=>{
      const input = document.querySelector(
        `input[data-sector="${o.nombre || o.sector || o.sector_nombre}"]`
      )
      if(input){
        input.value = o.objetivo
        input.disabled = true
      }
    })

  }catch(err){
    console.error("Error cargando objetivos",err)
  }
}

async function guardarObjetivos(){

  const inputs = document.querySelectorAll(".objetivo-input")

  for(let input of inputs){

    apiFetch("/api/sector/objetivo", {
  method: "POST",
  body: JSON.stringify({
    sector: input.dataset.sector,
    objetivo: input.value
  })
})

    input.disabled = true
  }

  alert("Objetivos guardados")
}

function editarObjetivos(){
  document.querySelectorAll(".objetivo-input")
    .forEach(i=> i.disabled=false)
}


// 🚀 INIT CORRECTO
function initDashboard(){

  actualizarTiempo()
  setInterval(actualizarTiempo,1000)

  cargarObjetivos()
  actualizarDashboard()
  setInterval(actualizarDashboard,3000)

  document.querySelectorAll(".objetivo-input").forEach((input,index,arr)=>{
    input.addEventListener("keydown",(e)=>{
      if(e.key==="Enter"){
        e.preventDefault()
        if(arr[index+1]){
          arr[index+1].focus()
        }
      }
    })
  })

}