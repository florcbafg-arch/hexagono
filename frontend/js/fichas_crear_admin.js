let pdfUrl = ""
let secciones = []

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

function agregarSeccion() {
  secciones.push({
    nombre: "",
    sector: "",
    tipo_seccion: "proceso",
    titulo_impresion: "",
    observaciones: "",
    piezas: []
  })
  renderSecciones()
}

function eliminarSeccion(index) {
  secciones.splice(index, 1)
  renderSecciones()
}

function agregarPieza(seccionIndex) {
  secciones[seccionIndex].piezas.push({
    nombre: "",
    tipo_pieza: "estructural",
    observacion: "",
    materiales: [],
    operaciones: []
  })
  renderSecciones()
}

function eliminarPieza(seccionIndex, piezaIndex) {
  secciones[seccionIndex].piezas.splice(piezaIndex, 1)
  renderSecciones()
}

function agregarMaterial(seccionIndex, piezaIndex) {
  secciones[seccionIndex].piezas[piezaIndex].materiales.push({
    material: "",
    especificacion: "",
    color: "",
    categoria: "materia_prima",
    unidad_medida: "",
    consumo: "",
    observacion: ""
  })
  renderSecciones()
}

function eliminarMaterial(seccionIndex, piezaIndex, materialIndex) {
  secciones[seccionIndex].piezas[piezaIndex].materiales.splice(materialIndex, 1)
  renderSecciones()
}

function agregarOperacion(seccionIndex, piezaIndex) {
  secciones[seccionIndex].piezas[piezaIndex].operaciones.push({
    tipo: "",
    detalle: "",
    valor_tecnico: "",
    observacion: ""
  })
  renderSecciones()
}
function eliminarOperacion(seccionIndex, piezaIndex, operacionIndex) {
  secciones[seccionIndex].piezas[piezaIndex].operaciones.splice(operacionIndex, 1)
  renderSecciones()
}

function actualizarSeccion(index, campo, valor) {
  secciones[index][campo] = valor
}

function actualizarPieza(seccionIndex, piezaIndex, campo, valor) {
  secciones[seccionIndex].piezas[piezaIndex][campo] = valor
}

function actualizarMaterial(seccionIndex, piezaIndex, materialIndex, campo, valor) {
  secciones[seccionIndex].piezas[piezaIndex].materiales[materialIndex][campo] = valor
}

function actualizarOperacion(seccionIndex, piezaIndex, operacionIndex, campo, valor) {
  secciones[seccionIndex].piezas[piezaIndex].operaciones[operacionIndex][campo] = valor
}

function renderSecciones() {
  const contenedor = document.getElementById("secciones")
  contenedor.innerHTML = ""

if (secciones.length === 0) {
  contenedor.innerHTML = `<p>No hay secciones cargadas todavía.</p>`
  renderListaSecciones()
  renderPreviewFicha()
  return
}

  secciones.forEach((seccion, sIndex) => {
    const divSeccion = document.createElement("div")
    divSeccion.id = "seccion_" + sIndex
    divSeccion.style.border = "1px solid #999"
    divSeccion.style.padding = "12px"
    divSeccion.style.marginBottom = "16px"

    divSeccion.innerHTML = `
      <h3>Sección ${sIndex + 1}</h3>

      <div class="form-row">
  <label>Nombre sección</label>
  <input value="${escapeHtml(seccion.nombre)}"
    oninput="actualizarSeccion(${sIndex}, 'nombre', this.value)">

  <label>Sector</label>
  <input value="${escapeHtml(seccion.sector)}"
    oninput="actualizarSeccion(${sIndex}, 'sector', this.value)">

  <label>Tipo sección</label>
  <select onchange="actualizarSeccion(${sIndex}, 'tipo_seccion', this.value)">
    <option value="materia_prima" ${seccion.tipo_seccion === "materia_prima" ? "selected" : ""}>Materia prima</option>
    <option value="proceso" ${seccion.tipo_seccion === "proceso" ? "selected" : ""}>Proceso</option>
    <option value="agregado" ${seccion.tipo_seccion === "agregado" ? "selected" : ""}>Agregado</option>
    <option value="packaging" ${seccion.tipo_seccion === "packaging" ? "selected" : ""}>Packaging</option>
    <option value="armado" ${seccion.tipo_seccion === "armado" ? "selected" : ""}>Armado</option>
    <option value="parametro_tecnico" ${seccion.tipo_seccion === "parametro_tecnico" ? "selected" : ""}>Parámetro técnico</option>
    <option value="refuerzo_interno" ${seccion.tipo_seccion === "refuerzo_interno" ? "selected" : ""}>Refuerzo interno</option>
  </select>

  <label>Título impresión</label>
  <input value="${escapeHtml(seccion.titulo_impresion)}"
    oninput="actualizarSeccion(${sIndex}, 'titulo_impresion', this.value)">
</div>

      <div class="form-row">
        <label>Observaciones sección</label>
        <textarea rows="2"
          oninput="actualizarSeccion(${sIndex}, 'observaciones', this.value)">${escapeHtml(seccion.observaciones)}</textarea>
      </div>

      <div style="margin: 8px 0;">
        <button type="button" onclick="agregarPieza(${sIndex})">➕ Agregar Pieza</button>
        <button type="button" onclick="eliminarSeccion(${sIndex})">🗑 Eliminar Sección</button>
      </div>

      <div id="piezas_${sIndex}"></div>
    `

    contenedor.appendChild(divSeccion)
    renderPiezas(sIndex)
  })

  renderListaSecciones()
renderPreviewFicha()

}

function renderListaSecciones() {
  const cont = document.getElementById("listaSecciones")
  if (!cont) return

  cont.innerHTML = ""

  if (secciones.length === 0) {
    cont.innerHTML = "<p>Sin secciones</p>"
    return
  }

  secciones.forEach((s, i) => {
    cont.innerHTML += `
      <div 
        onclick="scrollASeccion(${i})" 
        style="
          padding:8px;
          margin-bottom:6px;
          background:#222;
          border-radius:6px;
          cursor:pointer;
        ">
        ${i + 1}. ${s.nombre || "Sin nombre"}
      </div>
    `
  })
}

function scrollASeccion(index) {
  const el = document.getElementById("seccion_" + index)
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

function renderPiezas(seccionIndex) {
  const contenedor = document.getElementById(`piezas_${seccionIndex}`)
  const piezas = secciones[seccionIndex].piezas
  contenedor.innerHTML = ""

  if (piezas.length === 0) {
    contenedor.innerHTML = `<p>Sin piezas en esta sección.</p>`
    return
  }

  piezas.forEach((pieza, pIndex) => {
    const divPieza = document.createElement("div")
    divPieza.style.border = "1px dashed #666"
    divPieza.style.padding = "10px"
    divPieza.style.margin = "10px 0 10px 20px"

    divPieza.innerHTML = `
      <h4>Pieza ${pIndex + 1}</h4>

      <div class="form-row">
  <label>Nombre pieza</label>
  <input value="${escapeHtml(pieza.nombre)}"
    oninput="actualizarPieza(${seccionIndex}, ${pIndex}, 'nombre', this.value)">

  <label>Tipo pieza</label>
  <select onchange="actualizarPieza(${seccionIndex}, ${pIndex}, 'tipo_pieza', this.value)">
    <option value="estructural" ${pieza.tipo_pieza === "estructural" ? "selected" : ""}>Estructural</option>
    <option value="visual" ${pieza.tipo_pieza === "visual" ? "selected" : ""}>Visual</option>
    <option value="refuerzo" ${pieza.tipo_pieza === "refuerzo" ? "selected" : ""}>Refuerzo</option>
  </select>

  <label>Observación pieza</label>
  <input value="${escapeHtml(pieza.observacion)}"
    oninput="actualizarPieza(${seccionIndex}, ${pIndex}, 'observacion', this.value)">
</div>

      <div style="margin: 8px 0;">
        <button type="button" onclick="agregarMaterial(${seccionIndex}, ${pIndex})">➕ Material</button>
        <button type="button" onclick="agregarOperacion(${seccionIndex}, ${pIndex})">➕ Operación</button>
        <button type="button" onclick="eliminarPieza(${seccionIndex}, ${pIndex})">🗑 Eliminar Pieza</button>
      </div>

      <div id="materiales_${seccionIndex}_${pIndex}"></div>
      <div id="operaciones_${seccionIndex}_${pIndex}"></div>
    `

    contenedor.appendChild(divPieza)
    renderMateriales(seccionIndex, pIndex)
    renderOperaciones(seccionIndex, pIndex)
  })
}

function renderMateriales(seccionIndex, piezaIndex) {
  const contenedor = document.getElementById(`materiales_${seccionIndex}_${piezaIndex}`)
  const materiales = secciones[seccionIndex].piezas[piezaIndex].materiales
  contenedor.innerHTML = `<h5>Materiales</h5>`

  if (materiales.length === 0) {
    contenedor.innerHTML += `<p>Sin materiales.</p>`
    return
  }

  materiales.forEach((material, mIndex) => {
    contenedor.innerHTML += `
      <div style="border:1px solid #ccc; padding:8px; margin:6px 0 6px 20px;">
        <div class="form-row">
          <label>Material</label>
          <input value="${escapeHtml(material.material)}"
            oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'material', this.value)">

          <label>Especificación</label>
          <input value="${escapeHtml(material.especificacion)}"
            oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'especificacion', this.value)">

          <label>Color</label>
          <input value="${escapeHtml(material.color)}"
            oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'color', this.value)">
        </div>

        <div class="form-row">
  <label>Categoría</label>
  <select onchange="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'categoria', this.value)">
    <option value="materia_prima" ${material.categoria === "materia_prima" ? "selected" : ""}>Materia prima</option>
    <option value="agregado" ${material.categoria === "agregado" ? "selected" : ""}>Agregado</option>
    <option value="refuerzo" ${material.categoria === "refuerzo" ? "selected" : ""}>Refuerzo</option>
    <option value="packaging" ${material.categoria === "packaging" ? "selected" : ""}>Packaging</option>
  </select>

  <label>Unidad medida</label>
  <input value="${escapeHtml(material.unidad_medida)}"
    oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'unidad_medida', this.value)">

  <label>Consumo</label>
  <input type="number" step="0.0001" value="${escapeHtml(material.consumo)}"
    oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'consumo', this.value)">

  <label>Observación</label>
  <input value="${escapeHtml(material.observacion)}"
    oninput="actualizarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex}, 'observacion', this.value)">
</div>

        <button type="button" onclick="eliminarMaterial(${seccionIndex}, ${piezaIndex}, ${mIndex})">🗑 Eliminar Material</button>
      </div>
    `
  })
}

function renderOperaciones(seccionIndex, piezaIndex) {
  const contenedor = document.getElementById(`operaciones_${seccionIndex}_${piezaIndex}`)
  const operaciones = secciones[seccionIndex].piezas[piezaIndex].operaciones
  contenedor.innerHTML = `<h5>Operaciones</h5>`

  if (operaciones.length === 0) {
    contenedor.innerHTML += `<p>Sin operaciones.</p>`
    return
  }

  operaciones.forEach((operacion, oIndex) => {
    contenedor.innerHTML += `
      <div style="border:1px solid #ccc; padding:8px; margin:6px 0 6px 20px;">
        <div class="form-row">
  <label>Tipo</label>
  <input value="${escapeHtml(operacion.tipo)}"
    oninput="actualizarOperacion(${seccionIndex}, ${piezaIndex}, ${oIndex}, 'tipo', this.value)">

  <label>Detalle</label>
  <input value="${escapeHtml(operacion.detalle)}"
    oninput="actualizarOperacion(${seccionIndex}, ${piezaIndex}, ${oIndex}, 'detalle', this.value)">

  <label>Valor técnico</label>
  <input value="${escapeHtml(operacion.valor_tecnico)}"
    oninput="actualizarOperacion(${seccionIndex}, ${piezaIndex}, ${oIndex}, 'valor_tecnico', this.value)">

  <label>Observación</label>
  <input value="${escapeHtml(operacion.observacion)}"
    oninput="actualizarOperacion(${seccionIndex}, ${piezaIndex}, ${oIndex}, 'observacion', this.value)">
</div>

        <button type="button" onclick="eliminarOperacion(${seccionIndex}, ${piezaIndex}, ${oIndex})">🗑 Eliminar Operación</button>
      </div>
    `
  })
}

function normalizarSeccionesParaGuardar() {
  return secciones.map((seccion, sIndex) => ({
    nombre: (seccion.nombre || "").trim(),
    sector: (seccion.sector || "").trim(),
    tipo_seccion: (seccion.tipo_seccion || "proceso").trim(),
    titulo_impresion: (seccion.titulo_impresion || "").trim(),
    observaciones: (seccion.observaciones || "").trim(),
    orden: sIndex + 1,
    piezas: (seccion.piezas || []).map((pieza, pIndex) => ({
      nombre: (pieza.nombre || "").trim(),
      tipo_pieza: (pieza.tipo_pieza || "estructural").trim(),
      observacion: (pieza.observacion || "").trim(),
      orden: pIndex + 1,
      materiales: (pieza.materiales || [])
        .filter(m => (m.material || "").trim() !== "")
        .map((m, mIndex) => ({
          material: (m.material || "").trim(),
          especificacion: (m.especificacion || "").trim(),
          color: (m.color || "").trim(),
          categoria: (m.categoria || "materia_prima").trim(),
          unidad_medida: (m.unidad_medida || "").trim(),
          consumo: m.consumo !== "" ? Number(m.consumo) : null,
          observacion: (m.observacion || "").trim(),
          orden: mIndex + 1
        })),
      operaciones: (pieza.operaciones || [])
        .filter(o =>
          (o.tipo || "").trim() !== "" ||
          (o.detalle || "").trim() !== "" ||
          (o.valor_tecnico || "").trim() !== ""
        )
        .map((o, oIndex) => ({
          tipo: (o.tipo || "").trim(),
          detalle: (o.detalle || "").trim(),
          valor_tecnico: (o.valor_tecnico || "").trim(),
          observacion: (o.observacion || "").trim(),
          orden: oIndex + 1
        }))
    }))
  })).filter(seccion => seccion.nombre !== "")
}

async function guardarFichaCompleta() {
  const modelo = document.getElementById("modelo").value.trim()
  const codigo = document.getElementById("codigo").value.trim()
  const nombre = document.getElementById("nombre").value.trim()
  const marca = document.getElementById("marca").value.trim()
  const horma = document.getElementById("horma").value.trim()
  const temporada = document.getElementById("temporada").value.trim()
  const detalle_general = document.getElementById("detalle_general").value.trim()

  if (!modelo) return alert("Ingresar modelo")
  if (!codigo) return alert("Ingresar código")
  if (!nombre) return alert("Ingresar nombre")

  let finalPdfUrl = pdfUrl
  const input = document.getElementById("pdf_file")

  if (input.files && input.files.length > 0 && !finalPdfUrl) {
    finalPdfUrl = await subirPDF()
    if (!finalPdfUrl) return
  }

  const seccionesNormalizadas = normalizarSeccionesParaGuardar()

  if (seccionesNormalizadas.length === 0 && !finalPdfUrl) {
    return alert("Debes subir un PDF o cargar al menos una sección")
  }

  try {
    const res = await apiFetch("/api/fichas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelo,
        codigo,
        nombre,
        marca,
        horma,
        temporada,
        detalle_general,
        pdf_url: finalPdfUrl,
        fuente: seccionesNormalizadas.length > 0 ? "MANUAL" : "PDF",
        secciones: seccionesNormalizadas
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

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function renderPreviewFicha() {
  const cont = document.getElementById("previewFicha")
  if (!cont) return

  const totalSecciones = secciones.length
  const totalPiezas = secciones.reduce((acc, s) => acc + (s.piezas?.length || 0), 0)

  cont.innerHTML = `
    <p><strong>Secciones:</strong> ${totalSecciones}</p>
    <p><strong>Piezas:</strong> ${totalPiezas}</p>
  `
}

async function init() {
  renderSecciones()

}

init()