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

function renderMaterialesFicha(ficha) {
  const body = document.getElementById("tablaMaterialesBody")
  body.innerHTML = ""

  if (!ficha?.secciones?.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay materiales cargados en la ficha técnica</td>
      </tr>
    `
    return
  }

  const materiales = []

  ficha.secciones.forEach(seccion => {
    ;(seccion.piezas || []).forEach(pieza => {
      ;(pieza.materiales || []).forEach(material => {
        materiales.push(material)
      })
    })
  })

  if (!materiales.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay materiales cargados en la ficha técnica</td>
      </tr>
    `
    return
  }

  materiales.forEach(m => {
    body.innerHTML += `
      <tr>
        <td>${m.material || "-"}</td>
        <td>${m.color || "-"}</td>
        <td>${m.unidad_medida || "-"}</td>
        <td>${m.consumo ?? "-"}</td>
      </tr>
    `
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
document.getElementById("modeloNombre").textContent = orden.modelo || orden.modelos?.nombre || "-"
document.getElementById("codigoInterno").textContent = orden.codigo || orden.modelos?.codigo || "-"
document.getElementById("marcaNombre").textContent = orden.marca || orden.modelos?.marca || "-"
document.getElementById("pares").textContent = orden.pares_plan || orden.pares || 0
document.getElementById("totalPares").textContent = orden.pares_plan || orden.pares || 0

document.getElementById("fechaEmision").textContent = formatearFecha(orden.fecha)
document.getElementById("fechaEntrega").textContent = formatearFecha(orden.fecha_entrega)

document.getElementById("pedido").textContent = "-"
document.getElementById("nroSeg").textContent = "0"
document.getElementById("articuloNombre").textContent = ficha?.nombre || orden.modelo || orden.modelos?.nombre || "-"
    
    renderTalles(orden.talles, orden.pares_plan)

    // estado inicial mientras buscamos ficha
    document.getElementById("temporada").textContent = "-"
    document.getElementById("horma").textContent = "-"
    document.getElementById("detalleTecnico").textContent = "Sin ficha técnica asociada"

    // segundo fetch: ficha por modelo_id
    if (orden.modelo_id) {
      try {
        const resFicha = await apiFetch(`/api/fichas/${orden.modelo_id}`)
        const dataFicha = await resFicha.json()

        console.log("FICHA:", dataFicha)

        if (resFicha.ok && dataFicha.ok && dataFicha.ficha) {
          const ficha = dataFicha.ficha

          document.getElementById("temporada").textContent = ficha.temporada || "-"
          document.getElementById("horma").textContent = ficha.horma || "-"
          document.getElementById("articuloNombre").textContent = ficha.nombre || orden.modelos?.nombre || "-"
          document.getElementById("detalleTecnico").textContent = ficha.detalle_general || "Sin detalle técnico"

          renderMaterialesFicha(ficha)
        } else {
          renderMaterialesFicha(null)
        }
      } catch (errorFicha) {
        console.error("Error cargando ficha técnica:", errorFicha)
        renderMaterialesFicha(null)
      }
    } else {
      renderMaterialesFicha(null)
    }

  } catch (err) {
    console.error("Error en orden_ver:", err)
    alert("Error inesperado al cargar la orden")
  }
}

cargarOrden()