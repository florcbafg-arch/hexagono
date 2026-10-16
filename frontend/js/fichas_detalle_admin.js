const params = new URLSearchParams(window.location.search)
const ficha_id = params.get("ficha_id")
const modelo_id = params.get("modelo_id")

async function cargarDetalleFicha() {
  if (!ficha_id && !modelo_id) {
    alert("Falta ficha_id en la URL")
    return
  }

  try {
    const esV2 = Boolean(ficha_id)
    const res = await apiFetch(esV2 ? `/api/fichas-v2/id/${ficha_id}` : `/api/fichas/${modelo_id}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No se pudo cargar la ficha")
    }

    const ficha = data.ficha
    if (esV2 && ficha.articulo_id) {
      const ar = await apiFetch(`/api/fichas-v2/articulo/${ficha.articulo_id}`)
      const ad = await ar.json()
      if (ar.ok && ad.ok && ad.articulo) {
        const a = ad.articulo, m = a.modelos || {}
        ficha.codigo = a.codigo || ficha.codigo
        ficha.nombre = m.nombre || ficha.nombre
        ficha.marca = m.marca || ficha.marca
        ficha.color_articulo = a.color || ""
      }
    }
    renderHojaFicha(ficha)
    if (esV2 && ficha.articulo_id) cargarHistorialVersiones(ficha.articulo_id, ficha.id)
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
  const materiales = (pieza.materiales || []).map(m =>
    [m.material, m.especificacion, m.color].filter(Boolean).join(" · ")
  ).filter(Boolean)
  const operaciones = (pieza.operaciones || []).map(o =>
    [o.tipo, o.detalle, o.valor_tecnico].filter(Boolean).join(" · ")
  ).filter(Boolean)
  const extras = []
  if (pieza.observacion) extras.push(pieza.observacion)
  return [...materiales, ...operaciones, ...extras].join(" · ") || "-"
}

function renderBloqueSeccion(seccion, index) {
  const piezas = Array.isArray(seccion.piezas) ? seccion.piezas : []

  const filas = piezas.map((pieza) => {
    return `
      <div style="
        display:grid;
        grid-template-columns: 34mm minmax(0, 1fr);
        column-gap:3mm;
        margin-bottom:1.2mm;
        font-family:Arial,sans-serif;
        font-size:8pt;
        line-height:1.12;
        align-items:start;
        break-inside:avoid;
      ">
        <div style="font-weight:bold;">${escapeHtml(pieza.nombre || "-")}</div>
        <div style="white-space:normal; overflow-wrap:anywhere; word-break:normal; min-width:0;">${escapeHtml(obtenerValorDePieza(pieza))}</div>
      </div>
    `
  }).join("")

  return `
    <div style="margin-bottom:4mm; break-inside:avoid;">
      <div style="
        background:#000;
        color:#fff;
        padding:1.2mm 1.5mm;
        font-size:8.5pt;
        line-height:1;
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
        padding:1.5mm;
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
      width:190mm;
      height:277mm;
      max-width:190mm;
      box-sizing:border-box;
      margin:0 auto;
      background:#fff;
      color:#000;
      padding:3mm;
      border:0;
      overflow:hidden;
      page-break-after:${conSalto ? "always" : "avoid"};
      break-after:${conSalto ? "page" : "avoid"};
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
      height:48mm;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
    ">
      <div style="
        height:36mm;
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

      <div style="font-size:7pt;">
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
const tipoCalzado = ficha.sistema_constructivo || ficha.tipo_calzado || "-"

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
    height:86mm;
    margin-bottom:4mm;
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
             style="max-width:92%; max-height:80mm; object-fit:contain;"
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
          : `<span style="font-size:7pt; color:#666;">Sin logo</span>`
      }
    </div>
  </div>

  <div style="margin-bottom:12px; font-size:11px; display:flex; gap:16px; flex-wrap:wrap;">
    <div><strong>Marca:</strong> ${escapeHtml(ficha.marca || "-")}</div>
    ${ficha.color_articulo ? `<div><strong>Color:</strong> ${escapeHtml(ficha.color_articulo)}</div>` : ""}
    ${ficha.version ? `<div><strong>Versión:</strong> V${escapeHtml(ficha.version)} · ${escapeHtml(ficha.estado || "")}</div>` : ""}
    <div><strong>Sistema:</strong> ${escapeHtml(tipoCalzado)}</div>
  </div>

  ${seccion1 ? renderBloqueSeccion(seccion1, 0) : ""}
`, true)

const hoja2 = renderHojaBase(`
  <div style="margin-bottom:3mm;">
    <div style="background:#000; color:#fff; padding:6px 10px; font-weight:bold; margin-bottom:10px; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      Imagen secundaria
    </div>

    <div style="
      border:2px solid #000;
      height:70mm;
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
               style="max-width:100%; max-height:80mm; object-fit:contain;"
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
      margin-bottom:4mm;
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
  window.location.href = "admin.html?modulo=fichas"
}

cargarDetalleFicha()
function editarFicha() {
  if (ficha_id) window.location.href = `fichas_crear_admin.html?ficha_id=${ficha_id}`
  else if (modelo_id) window.location.href = `fichas_crear_admin.html?modelo_id=${modelo_id}`
}


async function cargarHistorialVersiones(articuloId, fichaActualId) {
  const panel = document.getElementById("historialVersiones")
  if (!panel) return
  try {
    const res = await apiFetch(`/api/fichas-v2/articulo/${articuloId}`)
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el historial")
    const versiones = Array.isArray(data.versiones) ? data.versiones : []
    panel.innerHTML = `
      <div class="historial-cabecera">
        <div>
          <strong>Historial de versiones</strong>
          <span>${versiones.length} versión${versiones.length === 1 ? "" : "es"}</span>
        </div>
        <button type="button" class="historial-toggle" onclick="toggleHistorialVersiones()">Ver historial</button>
      </div>
      <div id="historialVersionesLista" class="historial-lista" hidden>
        ${versiones.map(v => {
          const actual = Number(v.id) === Number(fichaActualId)
          const fecha = v.vigente_desde || v.created_at
          const fechaTxt = fecha ? new Date(fecha).toLocaleDateString("es-AR") : "-"
          return `
            <div class="historial-fila ${actual ? "actual" : ""}">
              <div class="historial-version"><strong>V${escapeHtml(v.version)}</strong> ${actual ? '<span class="historial-actual">Visualizando</span>' : ""}</div>
              <div><span class="historial-estado estado-${escapeHtml(v.estado)}">${escapeHtml(v.estado)}</span></div>
              <div class="historial-fecha">${escapeHtml(fechaTxt)}</div>
              <div class="historial-acciones">
                ${actual ? "" : `<button type="button" onclick="verVersionFicha(${v.id})">Ver</button>`}
              </div>
            </div>
          `
        }).join("") || '<div class="historial-vacio">No hay versiones registradas.</div>'}
      </div>
    `
  } catch (e) {
    panel.innerHTML = `<div class="historial-error">No se pudo cargar el historial: ${escapeHtml(e.message)}</div>`
  }
}

function toggleHistorialVersiones() {
  const lista = document.getElementById("historialVersionesLista")
  const boton = document.querySelector(".historial-toggle")
  if (!lista) return
  lista.hidden = !lista.hidden
  if (boton) boton.textContent = lista.hidden ? "Ver historial" : "Ocultar historial"
}

function verVersionFicha(id) {
  window.location.href = `fichas_detalle_admin.html?ficha_id=${id}`
}
