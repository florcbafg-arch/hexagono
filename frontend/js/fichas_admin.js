(() => {
let fichas = []

const ESTRUCTURA_BASE_IMPORT = {
  seccion1: {
    nombre: "SECCION N° 1",
    titulo_impresion: "SACABOCADO",
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
      "TALON"
    ]
  },
  seccion2: {
    nombre: "SECCION N° 2",
    titulo_impresion: "",
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
    nombre: "SECCION N° 3",
    titulo_impresion: "",
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
  seccion4: {
    nombre: "SECCION N° 4",
    titulo_impresion: "",
    items: [
      "BANDA",
      "BUMPER DELANTERO",
      "HORMA",
      "SUELIN",
      "TAPA TRASERA",
      "BASE",
      "COSTURA"
    ]
  },
  seccion5: {
    nombre: "SECCION N° 5",
    titulo_impresion: "",
    items: [
      "NUM. HORMA",
      "NUM. SACABOCADO",
      "NUM. GOM",
      "SACABOCADO",
      "TRANSFER DE CAPELL."
    ]
  },
  seccion6: {
    nombre: "SECCION N° 6",
    titulo_impresion: "SACABOCADO",
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

function normalizarTextoImport(valor = "") {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function construirSeccionesImportacion() {
  const defs = Object.values(ESTRUCTURA_BASE_IMPORT)

  return defs.map((seccionDef, sIndex) => ({
    nombre: seccionDef.nombre,
    sector: "",
    tipo_seccion: "proceso",
    titulo_impresion: seccionDef.titulo_impresion || "",
    observaciones: "",
    orden: sIndex + 1,
    piezas: seccionDef.items.map((item, iIndex) => ({
      nombre: item,
      tipo_pieza: "estructural",
      observacion: "",
      orden: iIndex + 1,
      sacabocado_id: null,
      materiales: [
        {
          material: "",
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
  }))
}

function aplicarDetalleImportado(secciones, filasDetalle) {
  let coincidencias = 0

  filasDetalle.forEach((fila) => {
    const seccionNombre = normalizarTextoImport(fila.seccion)
    const itemNombre = normalizarTextoImport(fila.item)
    const valor = String(fila.valor || "").trim()

    if (!seccionNombre || !itemNombre || !valor) return

    const seccion = secciones.find(
      s => normalizarTextoImport(s.nombre) === seccionNombre
    )
    if (!seccion) return

    const pieza = seccion.piezas.find(
      p => normalizarTextoImport(p.nombre) === itemNombre
    )
    if (!pieza) return

    if (pieza.materiales?.[0]) {
      pieza.materiales[0].material = valor
      coincidencias++
    }
  })

  return {
    secciones,
    coincidencias
  }
}

async function importarExcelFicha(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const nombreArchivo = (file.name || "").toLowerCase()
  const esExcel = nombreArchivo.endsWith(".xlsx") || nombreArchivo.endsWith(".xls")

  if (!esExcel) {
    alert("Error al importar: solo se permiten archivos Excel (.xlsx o .xls)")
    event.target.value = ""
    return
  }

  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: "array" })

    const hojaFicha = workbook.Sheets["ficha"]
    const hojaDetalle = workbook.Sheets["detalle"]

    if (!hojaFicha) {
      throw new Error("Falta la hoja 'ficha'")
    }

    if (!hojaDetalle) {
      throw new Error("Falta la hoja 'detalle'")
    }

    const filasFicha = XLSX.utils.sheet_to_json(hojaFicha, { defval: "" })
const filasDetalle = XLSX.utils.sheet_to_json(hojaDetalle, { defval: "" })

if (!Array.isArray(filasFicha) || filasFicha.length === 0) {
  throw new Error("La hoja 'ficha' está vacía o incompleta")
}

if (!Array.isArray(filasDetalle) || filasDetalle.length === 0) {
  throw new Error("La hoja 'detalle' está vacía o incompleta")
}

    const cabecera = filasFicha[0]

    const primeraFilaDetalle = filasDetalle[0] || {}

if (!("seccion" in primeraFilaDetalle) || !("item" in primeraFilaDetalle) || !("valor" in primeraFilaDetalle)) {
  throw new Error("La hoja 'detalle' debe incluir las columnas: seccion, item, valor")
}

    const resultadoImportacion = aplicarDetalleImportado(
  construirSeccionesImportacion(),
  filasDetalle
)

if (!resultadoImportacion.coincidencias) {
  throw new Error("El Excel no coincide con la estructura esperada. Revisá sección, item y valor.")
}

const payload = {
  modelo: String(cabecera.modelo || "").trim(),
  codigo: String(cabecera.codigo || "").trim(),
  nombre: String(cabecera.nombre || "").trim(),
  marca: String(cabecera.marca || "").trim(),
  horma: String(cabecera.horma || "").trim(),
  temporada: String(cabecera.temporada || "").trim(),
  detalle_general: "",
  tipo_calzado: String(cabecera.tipo_calzado || "vulcanizada").trim().toLowerCase(),
  imagen_modelo_url: "",
  imagen_secundaria_url: "",
  logo_marca_url: "",
  pdf_url: "",
  fuente: "EXCEL",
  secciones: resultadoImportacion.secciones
}
  

    if (!payload.modelo) {
      throw new Error("La hoja 'ficha' debe incluir 'modelo'")
    }

    if (!payload.codigo) {
      throw new Error("La hoja 'ficha' debe incluir 'codigo'")
    }

    if (!payload.nombre) {
      throw new Error("La hoja 'ficha' debe incluir 'nombre'")
    }

    const res = await apiFetch("/api/fichas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const resultado = await res.json()

    if (!res.ok || !resultado.ok) {
      throw new Error(resultado.error || "Error importando ficha desde Excel")
    }

    alert(`Ficha importada correctamente desde Excel. Se cargaron ${resultadoImportacion.coincidencias} ítems.`)
    await cargarFichas()

  } catch (error) {
    console.error("Error importando Excel de ficha:", error)
    alert(error.message || "Error al importar Excel. Revisá el formato del archivo.")
  } finally {
    event.target.value = ""
  }
}

async function cargarFichas() {
  try {
    const res = await apiFetch("/api/fichas")
    const data = await res.json()

    fichas = Array.isArray(data) ? data : []

fichas.sort((a, b) => {
  const modeloA = (a.modelo_nombre || "").toLowerCase()
  const modeloB = (b.modelo_nombre || "").toLowerCase()

  if (modeloA < modeloB) return -1
  if (modeloA > modeloB) return 1

  const marcaA = (a.marca || "").toLowerCase()
  const marcaB = (b.marca || "").toLowerCase()

  if (marcaA < marcaB) return -1
  if (marcaA > marcaB) return 1

  return 0
})

renderFichas()
    
  } catch (error) {
    console.error("Error cargando fichas:", error)
    alert("Error cargando fichas")
  }
}

function renderFichas() {
  const tbody = document.getElementById("tablaFichas")
  const buscador = document.getElementById("buscador")
  const filtro = (buscador?.value || "").toLowerCase().trim()

  tbody.innerHTML = ""

const filtradas = fichas.filter(f =>
  (f.nombre || "").toLowerCase().includes(filtro) ||
  (f.codigo || "").toLowerCase().includes(filtro) ||
  (f.modelo_nombre || "").toLowerCase().includes(filtro) ||
  (f.marca || "").toLowerCase().includes(filtro)
)

const visibles = filtradas.slice(0, 10)

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">No hay fichas técnicas cargadas</td>
      </tr>
    `
    return
  }

  visibles.forEach(f => {
    const tienePDF = !!f.pdf_url
    const fuente = f.fuente || "-"
    const pdfBoton = tienePDF
      ? `<button onclick="verPDF('${f.pdf_url}')">📄 PDF</button>`
      : `<span style="color:#888;">Sin PDF</span>`

    tbody.innerHTML += `
      <tr>
        <td>${f.modelo_nombre || "-"}</td>
        <td>${f.codigo || "-"}</td>
        <td>${f.nombre || "-"}</td>
        <td>${fuente}</td>
        <td>${tienePDF ? "Sí" : "No"}</td>
    <td>
  <button onclick="verFicha(${f.modelo_id})">👁 Ver</button>
  <button onclick="editarFicha(${f.modelo_id})">✏ Editar</button>
  <button onclick="eliminarFicha(${f.modelo_id})">🗑 Eliminar</button>
  ${pdfBoton}
</td>
      </tr>
    `
  })

  const infoResultados = document.getElementById("infoResultadosFichas")

if (infoResultados) {
  if (filtradas.length > 10) {
    infoResultados.textContent = `Mostrando 10 de ${filtradas.length} fichas. Usá el buscador para encontrar un modelo específico.`
  } else {
    infoResultados.textContent = `Mostrando ${filtradas.length} ficha(s).`
  }
}

}

function crearFicha() {
  window.location.href = "fichas_crear_admin.html"
}

function verFicha(modelo_id) {
  window.location.href = `fichas_detalle_admin.html?modelo_id=${modelo_id}`
}

function editarFicha(modelo_id) {
  window.location.href = `fichas_crear_admin.html?modelo_id=${modelo_id}`
}

async function eliminarFicha(modelo_id) {
  const ok = confirm("¿Eliminar esta ficha técnica?")
  if (!ok) return

  try {
    const res = await apiFetch(`/api/fichas/${modelo_id}`, {
      method: "DELETE"
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error eliminando ficha")
    }

    alert("Ficha eliminada correctamente")

    await cargarFichas()

  } catch (error) {
    console.error("Error eliminando ficha:", error)
    alert(error.message || "Error eliminando ficha")
  }
}

function verPDF(pdf_url) {
  if (!pdf_url) return

  let ruta = pdf_url.trim()

  if (!ruta.startsWith("http") && !ruta.startsWith("/")) {
    ruta = "/" + ruta
  }

  const url = ruta.startsWith("http")
    ? ruta
    : window.location.origin + ruta

  window.location.href = url
}

function filtrarFichas() {
  renderFichas()
}
 
function initFichas() {
  cargarFichas()
}

window.initFichas = initFichas
window.crearFicha = crearFicha
window.verFicha = verFicha
window.editarFicha = editarFicha
window.eliminarFicha = eliminarFicha
window.verPDF = verPDF
window.filtrarFichas = filtrarFichas
window.importarExcelFicha = importarExcelFicha
})()