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

    renderHojaFicha(data.ficha)
  } catch (error) {
    console.error("Error cargando detalle ficha:", error)
    document.getElementById("contenido").innerHTML += `
      <p style="color:red;">Error cargando ficha: ${error.message}</p>
    `
  }
}

function normalizarUrl(url) {
  if (!url) return ""

  let ruta = url.trim()

  if (!ruta.startsWith("http") && !ruta.startsWith("/")) {
    ruta = "/" + ruta
  }

  return ruta.startsWith("http")
    ? ruta
    : window.location.origin + ruta
}

function obtenerValorDePieza(pieza) {
  if (!pieza) return "-"

  const materialPrincipal = pieza.materiales?.[0]?.material?.trim()
  if (materialPrincipal) return materialPrincipal

  const detalleOperacion = pieza.operaciones?.[0]?.detalle?.trim()
  if (detalleOperacion) return detalleOperacion

  return "-"
}

function renderBloqueSeccion(seccion, index) {
  const piezas = Array.isArray(seccion.piezas) ? seccion.piezas : []

  const filas = piezas.map((pieza) => {
    return `
      <div style="
        display:grid;
        grid-template-columns: 220px 1fr;
        gap:12px;
        margin-bottom:8px;
        align-items:start;
      ">
        <div style="font-weight:bold;">${escapeHtml(pieza.nombre || "-")}</div>
        <div style="white-space:pre-line;">${escapeHtml(obtenerValorDePieza(pieza))}</div>
      </div>
    `
  }).join("")

  return `
    <div style="margin-bottom:24px;">
      <div style="
        background:#000;
        color:#fff;
        padding:6px 10px;
        font-weight:bold;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <span>${escapeHtml(seccion.nombre || `SECCION N° ${index + 1}`)}</span>
        <span>${escapeHtml(seccion.titulo_impresion || "")}</span>
      </div>

      <div style="
        border-left:1px solid #000;
        border-right:1px solid #000;
        border-bottom:1px solid #000;
        padding:12px;
        background:#fff;
      ">
        ${filas || "<p>Sin datos en esta sección.</p>"}
      </div>
    </div>
  `
}

function renderHojaBase(contenido, conSalto = false) {
  return `
    <div style="
      max-width:1000px;
      margin:0 auto 20px auto;
      background:#fff;
      color:#000;
      padding:20px;
      border:1px solid #999;
      page-break-after:${conSalto ? "always" : "auto"};
      break-after:${conSalto ? "page" : "auto"};
    ">
      ${contenido}
    </div>
  `
}

function renderImagenTecnica(img) {
  const url = normalizarUrl(img?.url)

  return `
    <div style="
      border:1px solid #000;
      padding:10px;
      background:#fff;
      min-height:220px;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
    ">
      <div style="
        height:180px;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        margin-bottom:8px;
      ">
        ${
          url
            ? `<img
                 src="${url}"
                 alt="${escapeHtml(img?.descripcion || "Imagen técnica")}"
                 style="max-width:100%; max-height:100%; object-fit:contain;"
               >`
            : `<span style="color:#666;">Sin imagen</span>`
        }
      </div>

      <div style="font-size:12px;">
        <div><strong>Tipo:</strong> ${escapeHtml(img?.tipo || "-")}</div>
        <div><strong>Descripción:</strong> ${escapeHtml(img?.descripcion || "-")}</div>
      </div>
    </div>
  `
}

function renderHojaFicha(ficha) {
  const cont = document.getElementById("hojaFicha")

  const imagenModelo = normalizarUrl(ficha.imagen_modelo_url)
const imagenSecundaria = normalizarUrl(ficha.imagen_secundaria_url)
const logoMarca = normalizarUrl(ficha.logo_marca_url)
const tipoCalzado = ficha.tipo_calzado || "-"

  const seccionesOrdenadas = (ficha.secciones || [])
  .slice()
  .sort((a, b) => (a.orden || 0) - (b.orden || 0))

const seccion1 = seccionesOrdenadas[0]
const seccion2 = seccionesOrdenadas[1]
const seccion3 = seccionesOrdenadas[2]
const seccion4 = seccionesOrdenadas[3]
const seccion5 = seccionesOrdenadas[4]
const seccion6 = seccionesOrdenadas[5]

const imagenesTecnicas = (ficha.imagenes || []).filter((img) => {
  const tipo = String(img?.tipo || "").toLowerCase()
  return tipo === "tecnica" || tipo === "detalle" || tipo === "referencia"
})
  const hoja1 = renderHojaBase(`
  <div style="margin-bottom:14px;">
    <div style="background:#000; color:#fff; padding:6px 10px; font-weight:bold; margin-bottom:6px; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      Cod: ${escapeHtml(ficha.codigo || "-")}
    </div>
    <div style="background:#000; color:#fff; padding:6px 10px; font-weight:bold; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      ${escapeHtml(ficha.nombre || ficha.modelo_id || "-")}
    </div>
  </div>

  <div style="
    position:relative;
    border:2px solid #000;
    min-height:280px;
    margin-bottom:24px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#fff;
    overflow:hidden;
  ">
    ${
      imagenModelo
        ? `<img
             src="${imagenModelo}"
             alt="Modelo"
             style="max-width:92%; max-height:240px; object-fit:contain;"
           >`
        : `<div style="color:#666;">Sin imagen del modelo</div>`
    }

    <div style="
      position:absolute;
      top:10px;
      right:10px;
      width:120px;
      height:70px;
      border:2px solid #000;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    ">
      ${
        logoMarca
          ? `<img
               src="${logoMarca}"
               alt="Logo marca"
               style="max-width:90%; max-height:90%; object-fit:contain;"
             >`
          : `<span style="font-size:12px; color:#666;">Sin logo</span>`
      }
    </div>
  </div>

  <div style="margin-bottom:18px; font-size:14px;">
    <div><strong>Marca:</strong> ${escapeHtml(ficha.marca || "-")}</div>
    <div><strong>Horma:</strong> ${escapeHtml(ficha.horma || "-")}</div>
    <div><strong>Temporada:</strong> ${escapeHtml(ficha.temporada || "-")}</div>
    <div><strong>Tipo de calzado:</strong> ${escapeHtml(tipoCalzado)}</div>
  </div>

  ${seccion1 ? renderBloqueSeccion(seccion1, 0) : ""}
`, true)

const hoja2 = renderHojaBase(`
  <div style="margin-bottom:18px;">
    <div style="background:#000; color:#fff; padding:6px 10px; font-weight:bold; margin-bottom:10px; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      Imagen secundaria
    </div>

    <div style="
      border:2px solid #000;
      min-height:260px;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      padding:10px;
    ">
      ${
        imagenSecundaria
          ? `<img
               src="${imagenSecundaria}"
               alt="Imagen secundaria"
               style="max-width:100%; max-height:240px; object-fit:contain;"
             >`
          : `<div style="color:#666;">Sin imagen secundaria</div>`
      }
    </div>
  </div>

  ${seccion2 ? renderBloqueSeccion(seccion2, 1) : ""}
  ${seccion3 ? renderBloqueSeccion(seccion3, 2) : ""}
  ${seccion4 ? renderBloqueSeccion(seccion4, 3) : ""}
`, true)

const hoja3 = renderHojaBase(`
  <div style="margin-bottom:18px;">
    <div style="background:#000; color:#fff; padding:6px 10px; font-weight:bold; margin-bottom:10px; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      Imágenes técnicas
    </div>

    <div style="
      display:grid;
      grid-template-columns:repeat(2, 1fr);
      gap:12px;
      margin-bottom:24px;
    ">
      ${
        imagenesTecnicas.length > 0
          ? imagenesTecnicas.map(renderImagenTecnica).join("")
          : `
            <div style="
              border:1px solid #000;
              padding:20px;
              min-height:120px;
              display:flex;
              align-items:center;
              justify-content:center;
              color:#666;
              grid-column:1 / -1;
            ">
              Sin imágenes técnicas cargadas
            </div>
          `
      }
    </div>
  </div>

  ${seccion5 ? renderBloqueSeccion(seccion5, 4) : ""}
  ${seccion6 ? renderBloqueSeccion(seccion6, 5) : ""}
`, false)

cont.innerHTML = hoja1 + hoja2 + hoja3
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function volver() {
  window.location.href = "fichas_admin.html"
}

cargarDetalleFicha()