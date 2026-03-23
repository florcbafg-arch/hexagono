const API = "http://localhost:3000/api"

// ==========================
// CARGAR ÓRDENES
// ==========================

async function cargarOrdenes(){

  try{

    const res = await apiFetch("/ordenes")
    const data = await res.json()

    const tbody = document.getElementById("tablaOrdenes")
    tbody.innerHTML = ""

    const filtro = document.getElementById("filtroEstado")?.value || ""
    const buscar = document.getElementById("buscar")?.value.toLowerCase() || ""

    data.forEach(o => {

      // 🧠 NORMALIZAR CAMPOS (BACKEND REAL)
      const numero = o.numero_tarea || o.numero || "-"
      const modelo = o.modelo_nombre || o.modelo || "-"
      const pares = o.pares_plan || o.pares || 0
      const estado = o.estado || "pendiente"
      const prioridad = o.prioridad || "-"
      const fechaRaw = o.fecha || null

      const fecha = fechaRaw
        ? new Date(fechaRaw).toLocaleDateString()
        : "-"

      // 🔍 FILTROS
      if(filtro && estado !== filtro) return
      if(buscar && !numero.toLowerCase().includes(buscar)) return

      const tr = document.createElement("tr")

      tr.innerHTML = `
        <td>${numero}</td>
        <td>${modelo}</td>
        <td>${pares}</td>
        <td>${fecha}</td>
        <td>${estado}</td>
        <td>${prioridad}</td>
        <td>
          <button onclick="verOrden(${o.id})">👁️</button>
        </td>
      `

      tbody.appendChild(tr)

    })

  }catch(err){

    console.error("Error cargando órdenes:", err)

  }

}


// ==========================
// VER ORDEN (placeholder PRO)
// ==========================

function verOrden(id){

  alert("Ver orden ID: " + id)

  // 🔥 después acá vamos a:
  // cargar detalle real
  // o abrir modal
}


// ==========================
// FILTROS DINÁMICOS
// ==========================

document.getElementById("buscar")?.addEventListener("input", cargarOrdenes)
document.getElementById("filtroEstado")?.addEventListener("change", cargarOrdenes)


// ==========================
// INICIO
// ==========================

document.addEventListener("DOMContentLoaded", cargarOrdenes)