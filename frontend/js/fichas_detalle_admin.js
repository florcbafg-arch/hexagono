const params = new URLSearchParams(window.location.search)
const modelo_id = params.get("modelo_id")

async function cargarDetalleFicha() {
  if (!modelo_id) {
    alert("Falta modelo_id en la URL")
    return
  }

  try {
    const res = await apiFetch(`/api/fichas/${modelo_id}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No se pudo cargar la ficha")
    }

    const ficha = data.ficha
    renderCabecera(ficha)
    renderPDF(ficha)
    renderEstructura(ficha)

  } catch (error) {
    console.error("Error cargando detalle ficha:", error)
    document.getElementById("contenido").innerHTML += `
      <p style="color:red;">Error cargando ficha: ${error.message}</p>
    `
  }
}

function renderCabecera(ficha) {
  const cont = document.getElementById("cabeceraFicha")

  cont.innerHTML = `
    <div style="border:1px solid #999; padding:12px;">
      <p><strong>Modelo ID:</strong> ${ficha.modelo_id || "-"}</p>
      <p><strong>Código:</strong> ${ficha.codigo || "-"}</p>
      <p><strong>Nombre:</strong> ${ficha.nombre || "-"}</p>
      <p><strong>Marca:</strong> ${ficha.marca || "-"}</p>
      <p><strong>Horma:</strong> ${ficha.horma || "-"}</p>
      <p><strong>Temporada:</strong> ${ficha.temporada || "-"}</p>
      <p><strong>Detalle general:</strong> ${ficha.detalle_general || "-"}</p>
      <p><strong>Fuente:</strong> ${ficha.fuente || "-"}</p>
    </div>
  `
}

function renderPDF(ficha) {
  const cont = document.getElementById("pdfFicha")

  console.log("pdf_url guardado:", ficha.pdf_url)

  if (!ficha.pdf_url) {
    cont.innerHTML = ""
    return
  }

  let ruta = ficha.pdf_url.trim()

  if (!ruta.startsWith("http") && !ruta.startsWith("/")) {
    ruta = "/" + ruta
  }

  const url = ruta.startsWith("http")
    ? ruta
    : window.location.origin + ruta

  console.log("url final pdf:", url)

  cont.innerHTML = `
    <button onclick="window.open('${url}', '_blank')">📄 Ver PDF</button>
  `
}


function renderEstructura(ficha) {
  const cont = document.getElementById("estructuraFicha")

  if (!ficha.secciones || ficha.secciones.length === 0) {
    cont.innerHTML = `<p>No hay estructura técnica cargada para esta ficha.</p>`
    return
  }

  cont.innerHTML = ""

  ficha.secciones.forEach((seccion, sIndex) => {
    let htmlPiezas = ""

    if (!seccion.piezas || seccion.piezas.length === 0) {
      htmlPiezas = `<p>Sin piezas en esta sección.</p>`
    } else {
      htmlPiezas = seccion.piezas.map((pieza, pIndex) => {
        const materialesHtml = (pieza.materiales && pieza.materiales.length > 0)
          ? pieza.materiales.map(m => `
              <li>
                <strong>${m.material || "-"}</strong>
                | Esp: ${m.especificacion || "-"}
                | Color: ${m.color || "-"}
                | UM: ${m.unidad_medida || "-"}
                | Consumo: ${m.consumo ?? "-"}
              </li>
            `).join("")
          : `<li>Sin materiales</li>`

        const operacionesHtml = (pieza.operaciones && pieza.operaciones.length > 0)
          ? pieza.operaciones.map(o => `
              <li>
                <strong>${o.tipo || "-"}</strong>
                | ${o.detalle || "-"}
              </li>
            `).join("")
          : `<li>Sin operaciones</li>`

        return `
          <div style="border:1px dashed #666; padding:10px; margin:10px 0 10px 20px;">
            <h4>Pieza ${pIndex + 1}: ${pieza.nombre || "-"}</h4>
            <p><strong>Observación:</strong> ${pieza.observacion || "-"}</p>

            <p><strong>Materiales:</strong></p>
            <ul>${materialesHtml}</ul>

            <p><strong>Operaciones:</strong></p>
            <ul>${operacionesHtml}</ul>
          </div>
        `
      }).join("")
    }

    cont.innerHTML += `
      <div style="border:1px solid #999; padding:12px; margin-bottom:16px;">
        <h3>Sección ${sIndex + 1}: ${seccion.nombre || "-"}</h3>
        <p><strong>Sector:</strong> ${seccion.sector || "-"}</p>
        <p><strong>Título impresión:</strong> ${seccion.titulo_impresion || "-"}</p>
        <p><strong>Observaciones:</strong> ${seccion.observaciones || "-"}</p>
        ${htmlPiezas}
      </div>
    `
  })
}

function volver() {
  window.location.href = "fichas_admin.html"
}

cargarDetalleFicha()