let pdfUrl = ""
let secciones = []
let guardandoFicha = false
let sacabocadosDisponibles = []

const params = new URLSearchParams(window.location.search)
const modeloIdEditar = params.get("modelo_id")
let modoEdicion = !!modeloIdEditar

const inputImagenModelo = document.getElementById("imagen_modelo")
const inputImagenSecundaria = document.getElementById("imagen_secundaria")
const inputLogoMarca = document.getElementById("logo_marca")

const previewModelo = document.getElementById("preview_modelo")
const previewSecundaria = document.getElementById("preview_secundaria")
const previewLogo = document.getElementById("preview_logo")

const ESTRUCTURA_BASE = {
  seccion1: {
    titulo: "SECCION N° 1",
    subtitulo: "SACABOCADO",
    items: [
      "CAÑA",
      "CAPELLADA",
      "CORDONERA",
      "FORRO",
      "FRANJA TALON",
      "LENGUA SUPERIOR",
      "LENGUA INFERIOR",
      "PUNTERA",
      "RELLENO DE CUELLO",
      "RELLENO DE LENGUA",
      "TALON/CORDONERA",
      "TALONCITO"
    ]
  },
  seccion2: {
    titulo: "SECCION N° 2",
    subtitulo: "",
    items: [
      "COSTURA FIGURADA",
      "COSTURAS",
      "ETIQ. DE LENGUA",
      "GRIFA DE CAÑA EXT",
      "INSTRUCTIVO LENGUA",
      "PERFORACIONES",
      "SERIGRAFIA ETIQ LENGUA",
      "SERIGRAFIA GRIFA"
    ]
  },
  seccion3: {
    titulo: "SECCION N° 3",
    subtitulo: "",
    items: [
      "CAJA",
      "CALCOMANIA",
      "CORDONES",
      "EMBALADO",
      "ETIQ CAJA MADRE",
      "ETIQ COMPOSICION",
      "PLANTILLA",
      "SERIGRAFIA PLANTILLA",
      "SULFITO"
    ]
  },
  seccion4_vulcanizada: {
    titulo: "SECCION N° 4",
    subtitulo: "",
    items: [
      "BANDA",
      "BUMPER DELANTERO",
      "HORMA",
      "SUELIN",
      "TAPA TRASERA"
    ]
  },
  seccion4_pegada: {
  titulo: "SECCION N° 4",
  subtitulo: "",
  items: [
    "BASE",
    "HORMA",
    "COSTURA"
  ]
},
  seccion5: {
    titulo: "SECCION N° 5",
    subtitulo: "",
    items: [
      "NUM. HORMA",
      "NUM. SACABOCADO",
      "NUM. GOM",
      "SACABOCADO",
      "TRANSFER DE CAPELL."
    ]
  },
  seccion6: {
    titulo: "SECCION N° 6",
    subtitulo: "SACABOCADO",
    items: [
      "PLANTILLA DE STROBEL",
      "REFUERZO CAÑA",
      "REFUERZO CAPELLADA",
      "REFUERZO CORDONERA",
      "REFUERZO PUNTERA",
      "REFUERZO TALON",
      "RELLENO CAÑA"
    ]
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

async function subirImagen(file, tipo) {
  const formData = new FormData()
  formData.append("imagen", file)
  formData.append("tipo", tipo)

  const token = localStorage.getItem("token")

  const res = await fetch("/api/fichas/upload-imagen", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: formData
  })

  const data = await res.json()

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Error subiendo imagen")
  }

  return data.url
}

async function cargarSacabocadosDisponibles() {
  try {
    const res = await apiFetch("/api/sacabocados")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error cargando sacabocados")
    }

    sacabocadosDisponibles = Array.isArray(data.sacabocados) ? data.sacabocados : []
  } catch (error) {
    console.error("Error cargando sacabocados para ficha:", error)
    sacabocadosDisponibles = []
  }
}

function renderOpcionesSacabocadosSeleccionado(sacabocadoIdActual = "") {
  const opcionesBase = [`<option value="">-- Sin sacabocado --</option>`]

  sacabocadosDisponibles.forEach((s) => {
    opcionesBase.push(`
      <option value="${s.id}" ${String(s.id) === String(sacabocadoIdActual) ? "selected" : ""}>
        ${escapeHtml(s.codigo || "-")} - ${escapeHtml(s.material_base || "-")}
      </option>
    `)
  })

  return opcionesBase.join("")
}

async function cargarFichaExistente() {
  if (!modoEdicion || !modeloIdEditar) return

  try {
    const res = await apiFetch(`/api/fichas/${modeloIdEditar}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No se pudo cargar la ficha para editar")
    }

    const ficha = data.ficha

    cargarCabeceraFicha(ficha)
    cargarSeccionesFicha(ficha)

  } catch (error) {
    console.error("Error cargando ficha para edición:", error)
    alert(error.message || "Error cargando ficha para edición")
  }
}

function cargarCabeceraFicha(ficha) {
  const setValue = (id, valor) => {
    const el = document.getElementById(id)
    if (el) el.value = valor || ""
  }

  setValue("modelo", ficha.nombre || "")
  setValue("codigo", ficha.codigo || "")
  setValue("nombre", ficha.nombre || "")
  setValue("marca", ficha.marca || "")
  setValue("horma", ficha.horma || "")
  setValue("temporada", ficha.temporada || "")
  setValue("detalle_general", ficha.detalle_general || "")

  const tipoCalzado = document.getElementById("tipo_calzado")
  if (tipoCalzado) {
    tipoCalzado.value = ficha.tipo_calzado || "vulcanizada"
  }

  if (previewModelo && ficha.imagen_modelo_url) {
    previewModelo.src = ficha.imagen_modelo_url
    previewModelo.style.display = "block"
  }

  if (previewSecundaria && ficha.imagen_secundaria_url) {
    previewSecundaria.src = ficha.imagen_secundaria_url
    previewSecundaria.style.display = "block"
  }

  if (previewLogo && ficha.logo_marca_url) {
    previewLogo.src = ficha.logo_marca_url
    previewLogo.style.display = "block"
  }
}

function cargarSeccionesFicha(ficha) {
  const seccionesBackend = Array.isArray(ficha.secciones) ? ficha.secciones : []

  secciones = seccionesBackend.map((seccion, sIndex) => ({
    nombre: seccion.nombre || `SECCION N° ${sIndex + 1}`,
    sector: seccion.sector || "",
    tipo_seccion: seccion.tipo_seccion || "proceso",
    titulo_impresion: seccion.titulo_impresion || "",
    observaciones: seccion.observaciones || "",
    fija: true,
    items: (seccion.piezas || []).map((pieza, pIndex) => ({
      label: pieza.nombre || `ITEM ${pIndex + 1}`,
      valor: pieza.materiales?.[0]?.material || "",
      no_aplica: (pieza.materiales?.[0]?.material || "").trim().toUpperCase() === "NO APLICA",
      orden: pieza.orden || pIndex + 1,
      es_extra: false,
      sacabocado_id: pieza.sacabocado_id || "",
      sacabocado_codigo: obtenerCodigoSacabocadoPorId(pieza.sacabocado_id)
    }))
  }))

  renderSecciones()
  renderPreviewFicha()
}

function obtenerCodigoSacabocadoPorId(sacabocadoId) {
  if (!sacabocadoId) return ""

  const encontrado = sacabocadosDisponibles.find(
    s => String(s.id) === String(sacabocadoId)
  )

  return encontrado?.codigo || ""
}

function activarPreview(input, preview) {
  if (!input || !preview) return

  input.addEventListener("change", () => {
    const file = input.files?.[0]

    if (!file) {
      preview.src = ""
      preview.style.display = "none"
      return
    }

    preview.src = URL.createObjectURL(file)
    preview.style.display = "block"
  })
}
function crearItemFijo(label, orden) {
  return {
    label,
    valor: "",
    no_aplica: false,
    orden,
    es_extra: false,
    sacabocado_id: "",
    sacabocado_codigo: ""
  }
}

function crearItemExtra(orden) {
  return {
    label: "",
    valor: "",
    no_aplica: false,
    orden,
    es_extra: true,
    sacabocado_id: "",
    sacabocado_codigo: ""
  }
}

function crearSeccionFija(titulo, subtitulo, items) {
  return {
    nombre: titulo,
    sector: "",
    tipo_seccion: "proceso",
    titulo_impresion: subtitulo || "",
    observaciones: "",
    fija: true,
    items: items.map((label, index) => crearItemFijo(label, index + 1))
  }
}

function construirSeccionesFijas() {
  const tipoCalzado = document.getElementById("tipo_calzado")?.value || "vulcanizada"

  const seccion4 =
    tipoCalzado === "pegada"
      ? ESTRUCTURA_BASE.seccion4_pegada
      : ESTRUCTURA_BASE.seccion4_vulcanizada

  secciones = [
    crearSeccionFija(
      ESTRUCTURA_BASE.seccion1.titulo,
      ESTRUCTURA_BASE.seccion1.subtitulo,
      ESTRUCTURA_BASE.seccion1.items
    ),
    crearSeccionFija(
      ESTRUCTURA_BASE.seccion2.titulo,
      ESTRUCTURA_BASE.seccion2.subtitulo,
      ESTRUCTURA_BASE.seccion2.items
    ),
    crearSeccionFija(
      ESTRUCTURA_BASE.seccion3.titulo,
      ESTRUCTURA_BASE.seccion3.subtitulo,
      ESTRUCTURA_BASE.seccion3.items
    ),
    crearSeccionFija(
      seccion4.titulo,
      seccion4.subtitulo,
      seccion4.items
    ),
    crearSeccionFija(
      ESTRUCTURA_BASE.seccion5.titulo,
      ESTRUCTURA_BASE.seccion5.subtitulo,
      ESTRUCTURA_BASE.seccion5.items
    ),
    crearSeccionFija(
      ESTRUCTURA_BASE.seccion6.titulo,
      ESTRUCTURA_BASE.seccion6.subtitulo,
      ESTRUCTURA_BASE.seccion6.items
    )
  ]
}

function cambiarTipoCalzado() {
  const valoresActuales = JSON.parse(JSON.stringify(secciones))

  construirSeccionesFijas()

  secciones.forEach((seccionNueva, sIndex) => {
    const seccionVieja = valoresActuales[sIndex]
    if (!seccionVieja || !Array.isArray(seccionVieja.items)) return

    seccionNueva.items.forEach((itemNuevo) => {
      const itemViejo = seccionVieja.items.find(i => i.label === itemNuevo.label)
      if (itemViejo) {
        itemNuevo.valor = itemViejo.valor || ""
        itemNuevo.no_aplica = !!itemViejo.no_aplica
      }
    })
  })

  renderSecciones()
}

function agregarSeccion() {
  return
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

function actualizarItem(seccionIndex, itemIndex, campo, valor) {
  secciones[seccionIndex].items[itemIndex][campo] = valor
  renderPreviewFicha()
}

function actualizarSacabocadoItem(seccionIndex, itemIndex, sacabocadoId) {
  const item = secciones[seccionIndex]?.items?.[itemIndex]
  if (!item) return

  item.sacabocado_id = sacabocadoId || ""

  const encontrado = sacabocadosDisponibles.find(s => String(s.id) === String(sacabocadoId))
  item.sacabocado_codigo = encontrado?.codigo || ""
}

function toggleNoAplica(seccionIndex, itemIndex) {
  const item = secciones[seccionIndex].items[itemIndex]
  item.no_aplica = !item.no_aplica
  item.valor = item.no_aplica ? "NO APLICA" : ""
  renderSecciones()
}

function agregarItemExtra(seccionIndex) {
  const items = secciones[seccionIndex].items || []
  items.push(crearItemExtra(items.length + 1))
  renderSecciones()
}

function eliminarItemExtra(seccionIndex, itemIndex) {
  const item = secciones[seccionIndex].items[itemIndex]
  if (!item?.es_extra) return
  secciones[seccionIndex].items.splice(itemIndex, 1)
  renderSecciones()
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
    divSeccion.style.background = "#111"
    divSeccion.style.borderRadius = "8px"

    const itemsHtml = (seccion.items || []).map((item, iIndex) => `
      <div style="margin-bottom:12px; padding:10px; background:#1c1c1c; border-radius:6px;">
        <label style="display:block; font-weight:bold; margin-bottom:6px;">
          ${escapeHtml(item.label || "Nuevo ítem")}
        </label>

        ${item.es_extra ? `
          <input
            placeholder="Título del ítem extra"
            value="${escapeHtml(item.label)}"
            oninput="actualizarItem(${sIndex}, ${iIndex}, 'label', this.value)"
            style="margin-bottom:8px;"
          >
        ` : ""}

        <textarea
          rows="2"
          ${item.no_aplica ? "disabled" : ""}
          oninput="actualizarItem(${sIndex}, ${iIndex}, 'valor', this.value)"
          style="width:100%; margin-bottom:8px;"
        >${escapeHtml(item.valor)}</textarea>

    ${seccionPermiteSacabocado(seccion) ? `
  <div style="margin-bottom:8px;">
    <label style="display:block; font-weight:bold; margin-bottom:6px;">
      Sacabocado
    </label>
    <select
      onchange="actualizarSacabocadoItem(${sIndex}, ${iIndex}, this.value)"
      style="width:100%;"
    >
      ${renderOpcionesSacabocadosSeleccionado(item.sacabocado_id)}
    </select>

    ${item.sacabocado_codigo ? `
      <div style="margin-top:6px; font-size:12px; color:#aaa;">
        Código seleccionado: ${escapeHtml(item.sacabocado_codigo)}
      </div>
    ` : ""}
  </div>
` : ""}
    

        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" onclick="toggleNoAplica(${sIndex}, ${iIndex})">
            ${item.no_aplica ? "✅ No aplica" : "No aplica"}
          </button>

          ${item.es_extra ? `
            <button type="button" onclick="eliminarItemExtra(${sIndex}, ${iIndex})">🗑 Eliminar ítem</button>
          ` : ""}
        </div>
      </div>
    `).join("")

    divSeccion.innerHTML = `
      <div style="background:#000; color:#fff; padding:10px; font-weight:bold; margin-bottom:12px; display:flex; justify-content:space-between;">
        <span>${escapeHtml(seccion.nombre)}</span>
        <span>${escapeHtml(seccion.titulo_impresion || "")}</span>
      </div>

      <div class="form-row">
        <label>Observaciones sección</label>
        <textarea rows="2"
          oninput="actualizarSeccion(${sIndex}, 'observaciones', this.value)">${escapeHtml(seccion.observaciones)}</textarea>
      </div>

      ${itemsHtml}

      <div style="margin-top:12px;">
        <button type="button" onclick="agregarItemExtra(${sIndex})">➕ Agregar ítem extra</button>
      </div>
    `

    contenedor.appendChild(divSeccion)
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
        ${i + 1}. ${escapeHtml(s.nombre || "Sin nombre")}
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

function seccionPermiteSacabocado(seccion) {
  const nombre = (seccion?.nombre || "").toUpperCase().trim()
  return nombre === "SECCION N° 1" || nombre === "SECCION N° 6"
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
  return secciones.map((seccion, sIndex) => {
    return {
      nombre: seccion.nombre,
      sector: "",
      tipo_seccion: "proceso",
      titulo_impresion: seccion.titulo_impresion || "",
      observaciones: seccion.observaciones || "",
      orden: sIndex + 1,

      piezas: (seccion.items || []).map((item, iIndex) => ({
  nombre: item.label || "ITEM",
  tipo_pieza: item.es_extra ? "visual" : "estructural",
  observacion: "",
  orden: iIndex + 1,
  sacabocado_id: item.sacabocado_id || null,

  materiales: [
          {
            material: item.no_aplica ? "NO APLICA" : (item.valor || ""),
            especificacion: "",
            color: "",
            categoria: "materia_prima",
            unidad_medida: "",
            consumo: null,
            observacion: "",
            orden: 1
          }
        ],

        operaciones: []
      }))
    }
  })
}

async function guardarFichaCompleta() {
  if (guardandoFicha) return

guardandoFicha = true

const btnGuardar = document.getElementById("btnGuardarFicha")
if (btnGuardar) {
  btnGuardar.disabled = true
  btnGuardar.textContent = "Guardando..."
}

  const modelo = document.getElementById("modelo").value.trim()
  const codigo = document.getElementById("codigo").value.trim()
  const nombre = document.getElementById("nombre").value.trim()
  const marca = document.getElementById("marca").value.trim()
  const horma = document.getElementById("horma").value.trim()
  const temporada = document.getElementById("temporada").value.trim()
  const detalle_general = document.getElementById("detalle_general").value.trim()
  const tipo_calzado = document.getElementById("tipo_calzado").value

  if (!modelo) return alert("Ingresar modelo")
  if (!codigo) return alert("Ingresar código")
  if (!nombre) return alert("Ingresar nombre")

  let finalPdfUrl = ""
  let imagenModeloUrl = ""
  let imagenSecundariaUrl = ""
  let logoMarcaUrl = ""
  const seccionesNormalizadas = normalizarSeccionesParaGuardar()

 if (seccionesNormalizadas.length === 0) {
  return alert("La ficha no tiene estructura")
}

  try {

    if (inputImagenModelo?.files?.[0]) {
  imagenModeloUrl = await subirImagen(inputImagenModelo.files[0], "modelo")
}

if (inputImagenSecundaria?.files?.[0]) {
  imagenSecundariaUrl = await subirImagen(inputImagenSecundaria.files[0], "secundaria")
}

if (inputLogoMarca?.files?.[0]) {
  logoMarcaUrl = await subirImagen(inputLogoMarca.files[0], "logo")
}

    if (modoEdicion && modeloIdEditar) {
      const resDelete = await apiFetch(`/api/fichas/${modeloIdEditar}`, {
        method: "DELETE"
      })

      const dataDelete = await resDelete.json()

      if (!resDelete.ok || !dataDelete.ok) {
        throw new Error(dataDelete.error || "Error eliminando ficha anterior")
      }
    }

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
  tipo_calzado,
  imagen_modelo_url: imagenModeloUrl,
imagen_secundaria_url: imagenSecundariaUrl,
logo_marca_url: logoMarcaUrl,
  pdf_url: "",
  fuente: "MANUAL",
  secciones: seccionesNormalizadas
})
    })

    const data = await res.json()

if (data.ok) {
  alert(modoEdicion ? "Ficha técnica actualizada correctamente" : "Ficha técnica guardada correctamente")
  window.location.href = "admin.html?modulo=fichas"
} else {
  guardandoFicha = false
  alert(data.error || "Error guardando ficha")
}

if (btnGuardar) {
  btnGuardar.disabled = false
  btnGuardar.textContent = "💾 Guardar Ficha"
}

  } catch (error) {
  console.error("Error guardando ficha:", error)
  guardandoFicha = false
  alert(error.message || "Error guardando ficha")
}
if (btnGuardar) {
  btnGuardar.disabled = false
  btnGuardar.textContent = "💾 Guardar Ficha"
}
}

function volver() {
  window.location.href = "admin.html?modulo=fichas"
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

  const modelo = document.getElementById("modelo")?.value || "-"
  const codigo = document.getElementById("codigo")?.value || "-"
  const nombre = document.getElementById("nombre")?.value || "-"
  const tipoCalzado = document.getElementById("tipo_calzado")?.value || "-"

  const resumenSecciones = secciones.map((seccion) => {
    const primerosItems = (seccion.items || []).slice(0, 3).map(item => `
      <div style="display:flex; justify-content:space-between; gap:8px; font-size:12px; margin-bottom:4px;">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.valor || "")}</span>
      </div>
    `).join("")

    return `
      <div style="margin-bottom:16px; border:1px solid #333;">
        <div style="background:#000; color:#fff; padding:6px 8px; display:flex; justify-content:space-between;">
          <span>${escapeHtml(seccion.nombre)}</span>
          <span>${escapeHtml(seccion.titulo_impresion || "")}</span>
        </div>
        <div style="padding:8px;">
          ${primerosItems || "<small>Sin datos aún</small>"}
        </div>
      </div>
    `
  }).join("")

  cont.innerHTML = `
    <div style="border:1px solid #999; padding:12px; background:#fff; color:#000;">
      <div style="background:#000; color:#fff; padding:8px; margin-bottom:12px;">
        <div><strong>Código:</strong> ${escapeHtml(codigo)}</div>
        <div><strong>Nombre:</strong> ${escapeHtml(nombre)}</div>
        <div><strong>Modelo:</strong> ${escapeHtml(modelo)}</div>
        <div><strong>Tipo:</strong> ${escapeHtml(tipoCalzado)}</div>
      </div>
      ${resumenSecciones}
    </div>
  `
}

async function init() {
  await cargarSacabocadosDisponibles()
  construirSeccionesFijas()

  if (modoEdicion) {
    const titulo = document.querySelector("h1")
    if (titulo) titulo.textContent = "Editar Ficha Técnica"

    const btnGuardar = document.getElementById("btnGuardarFicha")
    if (btnGuardar) btnGuardar.textContent = "💾 Actualizar Ficha"

    await cargarFichaExistente()
  } else {
    renderSecciones()
    renderPreviewFicha()
  }

  const tipoCalzado = document.getElementById("tipo_calzado")
  if (tipoCalzado) {
    tipoCalzado.addEventListener("change", cambiarTipoCalzado)
  }

  ;["modelo", "codigo", "nombre"].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener("input", renderPreviewFicha)
  })
}

activarPreview(inputImagenModelo, previewModelo)
activarPreview(inputImagenSecundaria, previewSecundaria)
activarPreview(inputLogoMarca, previewLogo)

window.actualizarSacabocadoItem = actualizarSacabocadoItem
window.addEventListener("DOMContentLoaded", init)