const params = new URLSearchParams(window.location.search)
const id = params.get("id")

async function cargarDetalleSacabocado() {
  if (!id) {
    alert("Falta id en la URL")
    return
  }

  try {
    const res = await apiFetch(`/api/sacabocados/${id}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No se pudo cargar el sacabocado")
    }

    renderDetalleSacabocado(data.sacabocado)
    conectarBotonEditar(data.sacabocado.id)
  } catch (error) {
    console.error("Error cargando detalle sacabocado:", error)
    const cont = document.getElementById("detalleSacabocado")
    if (cont) {
      cont.innerHTML = `<p style="color:red;">Error: ${escapeHtml(error.message)}</p>`
    }
  }
}

function renderDetalleSacabocado(s) {
  const cont = document.getElementById("detalleSacabocado")
  if (!cont) return

  cont.innerHTML = `
    <div style="
      max-width:900px;
      background:#fff;
      color:#000;
      border:1px solid #999;
      padding:20px;
      border-radius:8px;
    ">
      <div style="margin-bottom:16px;">
        <div style="background:#000; color:#fff; padding:8px 12px; font-weight:bold; margin-bottom:8px;">
          Código: ${escapeHtml(s.codigo || "-")}
        </div>
        <div style="background:#000; color:#fff; padding:8px 12px; font-weight:bold;">
          ${escapeHtml(s.pieza || "-")} ${s.subpieza ? " - " + escapeHtml(s.subpieza) : ""}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(2, minmax(250px, 1fr)); gap:14px; margin-bottom:18px;">
        <div><strong>Marca:</strong> ${escapeHtml(s.marca || "-")}</div>
        <div><strong>Modelo referencia:</strong> ${escapeHtml(s.modelo_referencia || "-")}</div>
        <div><strong>Pieza:</strong> ${escapeHtml(s.pieza || "-")}</div>
        <div><strong>Subpieza:</strong> ${escapeHtml(s.subpieza || "-")}</div>
        <div><strong>Ancho:</strong> ${formatearNumero(s.ancho)}</div>
        <div><strong>Alto:</strong> ${formatearNumero(s.alto)}</div>
        <div><strong>Área base:</strong> ${formatearNumero(s.area_base)}</div>
        <div><strong>Consumo referencia:</strong> ${formatearNumero(s.consumo_referencia)}</div>
        <div><strong>Unidad medida:</strong> ${escapeHtml(s.unidad_medida || "-")}</div>
        <div><strong>Activo:</strong> ${s.activo ? "Sí" : "No"}</div>
      </div>

      <div style="margin-bottom:18px;">
        <strong>Descripción:</strong>
        <div style="
          margin-top:6px;
          border:1px solid #ccc;
          padding:10px;
          background:#fafafa;
          min-height:44px;
          white-space:pre-line;
        ">
          ${escapeHtml(s.descripcion || "-")}
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <strong>Observaciones:</strong>
        <div style="
          margin-top:6px;
          border:1px solid #ccc;
          padding:10px;
          background:#fafafa;
          min-height:70px;
          white-space:pre-line;
        ">
          ${escapeHtml(s.observaciones || "-")}
        </div>
      </div>

      <div>
        <strong>Imagen:</strong>
        <div style="
          margin-top:8px;
          border:1px dashed #999;
          background:#fafafa;
          min-height:180px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#666;
        ">
         ${
  s.imagen_url
    ? `<img src="${s.imagen_url}" style="max-width:100%; max-height:180px; object-fit:contain;">`
    : "Sin imagen"
}
        </div>
      </div>
    </div>
  `
}

function conectarBotonEditar(idSacabocado) {
  const btnEditar = document.getElementById("btnEditarSacabocado")
  if (!btnEditar) return

  btnEditar.onclick = () => {
    window.location.href = `sacabocados_crear_admin.html?id=${idSacabocado}`
  }
}

function formatearNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return "-"
  const numero = Number(valor)
  if (isNaN(numero)) return escapeHtml(valor)
  return numero
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
  window.location.href = "admin.html?modulo=sacabocados"
}

window.addEventListener("DOMContentLoaded", cargarDetalleSacabocado)