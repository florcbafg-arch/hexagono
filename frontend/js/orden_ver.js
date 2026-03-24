function formatearFecha(valor) {
  if (!valor) return "-"

  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return valor

  const dia = String(fecha.getDate()).padStart(2, "0")
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const anio = fecha.getFullYear()

  return `${dia}/${mes}/${anio}`
}

function renderTalles(talles, totalPares) {
  const head = document.getElementById("tallesHead")
  const row = document.getElementById("tallesRow")

  head.innerHTML = "<th>Total</th>"
  row.innerHTML = `<td>${totalPares || 0}</td>`

  if (!Array.isArray(talles) || !talles.length) return

  talles.forEach(t => {
    const th = document.createElement("th")
    th.textContent = t.talle
    head.appendChild(th)

    const td = document.createElement("td")
    td.textContent = t.cantidad
    row.appendChild(td)
  })
}

async function cargarOrden() {
  try {
    const params = new URLSearchParams(window.location.search)
    const id = params.get("id")

    if (!id) {
      alert("Falta id de orden")
      return
    }

    const res = await apiFetch(`/api/ordenes/${id}`)
    const orden = await res.json()

    console.log("ORDEN:", orden)

    if (!res.ok) {
      alert(orden.error || "Error cargando orden")
      return
    }

    document.getElementById("numeroTarea").textContent = orden.numero_tarea || "-"
    document.getElementById("modeloNombre").textContent = orden.modelos?.nombre || "-"
    document.getElementById("codigoInterno").textContent = orden.modelos?.codigo || "-"
    document.getElementById("marcaNombre").textContent = orden.modelos?.marca || "-"
    document.getElementById("pares").textContent = orden.pares_plan || 0
    document.getElementById("totalPares").textContent = orden.pares_plan || 0

    document.getElementById("fechaEmision").textContent = formatearFecha(orden.fecha)
    document.getElementById("fechaEntrega").textContent = formatearFecha(orden.fecha_entrega)

    // placeholders por ahora
    document.getElementById("temporada").textContent = "-"
    document.getElementById("horma").textContent = "-"
    document.getElementById("pedido").textContent = "-"
    document.getElementById("nroSeg").textContent = "0"
    document.getElementById("articuloNombre").textContent = orden.modelos?.nombre || "-"
    document.getElementById("detalleTecnico").textContent = "Pendiente de conectar con ficha técnica."

    renderTalles(orden.talles, orden.pares_plan)

  } catch (err) {
    console.error("Error en orden_ver:", err)
    alert("Error inesperado al cargar la orden")
  }
}

cargarOrden()