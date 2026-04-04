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

  if (!head || !row) return

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

function renderMaterialesFicha(ficha, sectorFiltro = null) {
  const body = document.getElementById("tablaMaterialesBody")
  if (!body) return

  body.innerHTML = ""

  if (!ficha?.secciones?.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay materiales cargados en la ficha técnica</td>
      </tr>
    `
    return
  }

  const grupos = agruparFichaPorSector(ficha)

  const sectoresAmostrar = sectorFiltro
    ? [sectorFiltro]
    : ["corte", "aparado", "armado", "terminacion", "general"]

  let hayContenido = false

  sectoresAmostrar.forEach(sector => {
    const secciones = grupos[sector] || []
    if (!secciones.length) return

       const nombresSector = {
      corte: "CORTE CAPELLADA",
      aparado: "APARADO",
      armado: "ARMADO",
      terminacion: "TERMINACIÓN",
      general: "GENERAL"
    }

    body.innerHTML += `
      <tr class="sector-row">
        <td colspan="4"><strong>${nombresSector[sector] || sector.toUpperCase()}</strong></td>
      </tr>
    `

    secciones.forEach(seccion => {
      const numero = seccion.numero_seccion_resuelto || "-"
      const titulo = seccion.nombre || seccion.titulo || `Sección ${numero}`

           body.innerHTML += `
        <tr class="seccion-row">
          <td colspan="4"><strong>${titulo}</strong></td>
        </tr>
      `

      const materiales = []

;(seccion.materiales || []).forEach(material => {
  materiales.push(material)
})

;(seccion.piezas || []).forEach(pieza => {
  ;(pieza.materiales || []).forEach(material => {
    materiales.push(material)
  })
})

      if (!materiales.length) {
        body.innerHTML += `
          <tr>
            <td colspan="4">Sin materiales en esta sección</td>
          </tr>
        `
        return
      }

      materiales.forEach(m => {
        hayContenido = true

        body.innerHTML += `
          <tr>
            <td>${m.material || m.nombre || "-"}</td>
            <td>${m.color || "-"}</td>
            <td>${m.unidad_medida || m.unidad || "-"}</td>
            <td>${m.consumo ?? m.cantidad ?? "-"}</td>
          </tr>
        `
      })
    })
  })

  if (!hayContenido) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay materiales cargados en la ficha técnica</td>
      </tr>
    `
  }
}

function limpiarFichaVisual() {
  document.getElementById("temporada").textContent = "-"
  document.getElementById("horma").textContent = "-"
  document.getElementById("detalleTecnico").textContent = "Sin ficha técnica asociada"
}

function obtenerNumeroSeccion(seccion, index) {
  if (typeof seccion?.numero === "number") return seccion.numero

  if (typeof seccion?.numero_seccion === "number") return seccion.numero_seccion

  if (typeof seccion?.orden === "number") return seccion.orden

  return index + 1
}

function obtenerSectorPorSeccion(numeroSeccion) {
  const mapa = {
    1: "corte",
    2: "aparado",
    3: "armado",
    4: "terminacion",
    5: "terminacion",
    6: "terminacion"
  }

  return mapa[numeroSeccion] || "general"
}

function agruparFichaPorSector(ficha) {
  const grupos = {
    corte: [],
    aparado: [],
    armado: [],
    terminacion: [],
    general: []
  }

  if (!ficha?.secciones?.length) return grupos

  ficha.secciones.forEach((seccion, index) => {
    const numeroSeccion = obtenerNumeroSeccion(seccion, index)
    const sector = obtenerSectorPorSeccion(numeroSeccion)

    grupos[sector].push({
      ...seccion,
      numero_seccion_resuelto: numeroSeccion,
      sector_resuelto: sector
    })
  })

  return grupos
}

 function normalizarFicha(ficha) {
  if (!ficha) return null

  const seccionesRaw = ficha.secciones || ficha.ficha_secciones || []

  return {
    ...ficha,
    secciones: seccionesRaw.map(seccion => {
      const piezasRaw = seccion.piezas || seccion.ficha_piezas || []
      const materialesDirectos = seccion.materiales || seccion.ficha_materiales || []

      return {
        ...seccion,
        nombre: seccion.nombre || seccion.titulo || seccion.titulo_impresion || `Sección`,
        piezas: piezasRaw.map(pieza => ({
          ...pieza,
          materiales: pieza.materiales || pieza.ficha_materiales || []
        })),
        materiales: materialesDirectos
      }
    })
  }
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

    ordenActual = orden

    console.log("ORDEN:", orden)

    if (!res.ok) {
      alert(orden.error || "Error cargando orden")
      return
    }

    // estado inicial seguro
    limpiarFichaVisual()

    // cabecera base desde orden

   const numeroTareaEl = document.getElementById("numeroTarea")
if (numeroTareaEl) {
  numeroTareaEl.textContent = orden.numero_tarea || orden.numero || "-"
}

    document.getElementById("modeloNombre").textContent = orden.modelo_nombre || "-"
    document.getElementById("codigoInterno").textContent = orden.codigo || "-"
    document.getElementById("marcaNombre").textContent = orden.marca || "-"
    document.getElementById("pares").textContent = orden.pares_plan || orden.pares || 0
    document.getElementById("totalPares").textContent = orden.pares_plan || orden.pares || 0

    document.getElementById("fechaEmision").textContent = formatearFecha(orden.fecha)
    document.getElementById("fechaEntrega").textContent = formatearFecha(orden.fecha_entrega)

    document.getElementById("pedido").textContent = orden.pedido || "-"
    document.getElementById("nroSeg").textContent = orden.nro_seg || "0"

    // IMPORTANTE: acá NO usamos ficha todavía
   document.getElementById("articuloNombre").textContent =
  orden.modelo_nombre || "-"

    renderTalles(orden.talles, orden.pares_plan || orden.pares || 0)

    // limpiar tabla de materiales al arrancar
    sectorActual = null
    actualizarTituloSector(null)
    renderMaterialesFicha(null)

    // usar ficha ya incluida en la orden
    const ficha = normalizarFicha(orden.ficha || null)

    fichaActual = ficha

if (ficha) {
  document.getElementById("temporada").textContent = ficha.temporada || "-"
  document.getElementById("horma").textContent = ficha.horma || "-"
  document.getElementById("articuloNombre").textContent =
    ficha.nombre || orden.modelo_nombre || "-"
  document.getElementById("detalleTecnico").textContent =
    ficha.detalle_general || "Sin detalle técnico"
 
  sectorActual = null
  actualizarTituloSector(null)
  renderMaterialesFicha(ficha)
} else {
  limpiarFichaVisual()
  renderMaterialesFicha(null)
}
  } catch (err) {
  console.error("Error en orden_ver:", err)
  alert("Error inesperado al cargar la orden: " + err.message)
}
}

  let ordenActual = null
   let fichaActual = null
   let sectorActual = null

   function actualizarTituloSector(sector = null) {
  const titulo = document.getElementById("tituloSector")
  if (!titulo) return

  const nombres = {
    corte: "CORTE CAPELLADA",
    aparado: "APARADO",
    armado: "ARMADO",
    terminacion: "TERMINACIÓN",
    empaque: "EMPAQUE",
    salida_linea: "SALIDA LÍNEA",
    serigrafia: "SERIGRAFÍA"
  }

  titulo.textContent = sector
    ? (nombres[sector] || sector.toUpperCase())
    : "ORDEN GENERAL"
}

function imprimirTodo() {
  if (!fichaActual) {
    alert("Esta orden no tiene ficha técnica para imprimir")
    return
  }

  sectorActual = null
  actualizarTituloSector(null)
  renderMaterialesFicha(fichaActual, null)

  window.print()
}

function imprimirSector(sector) {
  if (!fichaActual) {
    alert("Esta orden no tiene ficha técnica para imprimir ese sector")
    return
  }

  sectorActual = sector
  actualizarTituloSector(sector)
  renderMaterialesFicha(fichaActual, sector)

  window.print()

  sectorActual = null
  actualizarTituloSector(null)
  renderMaterialesFicha(fichaActual, null)
}

cargarOrden()