let pdfUrl = ""

async function cargarModelos() {
  try {
    const res = await apiFetch("/api/modelos")
    const data = await res.json()

    const select = document.getElementById("modelo")
    select.innerHTML = `<option value="">Seleccionar modelo</option>`

    data.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`
    })
  } catch (error) {
    console.error("Error cargando modelos:", error)
    alert("Error cargando modelos")
  }
}

async function subirPDF() {
  const input = document.getElementById("pdf_file")
  const estado = document.getElementById("estado_pdf")

  if (!input.files || input.files.length === 0) {
    return ""
  }

  const file = input.files[0]

  if (file.type !== "application/pdf") {
    alert("Solo se permite subir archivos PDF")
    return ""
  }

  estado.textContent = "Subiendo PDF..."

  try {
    const formData = new FormData()
    formData.append("pdf", file)

    const token = localStorage.getItem("token")

    const res = await fetch("/api/fichas/upload-pdf", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      },
      body: formData
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error subiendo PDF")
    }

    pdfUrl = data.url
    estado.textContent = "PDF subido correctamente"
    return pdfUrl

  } catch (error) {
    console.error("Error subiendo PDF:", error)
    estado.textContent = "Error al subir PDF"
    alert(error.message || "Error subiendo PDF")
    return ""
  }
}

async function guardarFichaPDF() {
  const modelo_id = document.getElementById("modelo").value
  const codigo = document.getElementById("codigo").value.trim()
  const nombre = document.getElementById("nombre").value.trim()
  const marca = document.getElementById("marca").value.trim()
  const horma = document.getElementById("horma").value.trim()
  const temporada = document.getElementById("temporada").value.trim()
  const detalle_general = document.getElementById("detalle_general").value.trim()

  if (!modelo_id) return alert("Seleccionar modelo")
  if (!codigo) return alert("Ingresar código")
  if (!nombre) return alert("Ingresar nombre")

  let finalPdfUrl = pdfUrl

  const input = document.getElementById("pdf_file")
  if (input.files && input.files.length > 0 && !finalPdfUrl) {
    finalPdfUrl = await subirPDF()
    if (!finalPdfUrl) return
  }

  if (!finalPdfUrl) {
    return alert("Debes subir un PDF de ficha técnica")
  }

  try {
    const res = await apiFetch("/api/fichas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelo_id: Number(modelo_id),
        codigo,
        nombre,
        marca,
        horma,
        temporada,
        detalle_general,
        pdf_url: finalPdfUrl,
        fuente: "PDF",
        secciones: []
      })
    })

    const data = await res.json()

    if (data.ok) {
      alert("Ficha técnica guardada correctamente")
      window.location.href = "fichas_admin.html"
    } else {
      alert(data.error || "Error guardando ficha")
    }

  } catch (error) {
    console.error("Error guardando ficha:", error)
    alert("Error guardando ficha")
  }
}

function volver() {
  window.location.href = "fichas_admin.html"
}

async function init() {
  await cargarModelos()
}

init()