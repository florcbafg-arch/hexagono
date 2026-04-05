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

function renderTallesPatron(talles, totalPares) {
  const head = document.getElementById("patronTallesHead")
  const row = document.getElementById("patronTallesRow")

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

function renderMaterialesPatron(patron, sectorFiltro = null) {
  const body = document.getElementById("tablaMaterialesBody")
  if (!body) return

  body.innerHTML = ""

  if (!Array.isArray(patron) || !patron.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay patrón cargado para este modelo</td>
      </tr>
    `
    return
  }

  const bloquesPermitidos = sectorFiltro
    ? obtenerBloquesPorSector(sectorFiltro)
    : ["CORTE REFUERZO", "CORTE FORRO", "CORTE CAPELLADA"]

  const bloquesFiltrados = patron.filter(b =>
    bloquesPermitidos.includes((b.bloque || "").toUpperCase())
  )

  if (!bloquesFiltrados.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">No hay materiales para este sector</td>
      </tr>
    `
    return
  }

  bloquesFiltrados.forEach(bloque => {
    body.innerHTML += `
      <tr class="sector-row">
        <td colspan="4"><strong>${bloque.bloque}</strong></td>
      </tr>
    `

    ;(bloque.items || []).forEach(item => {
      body.innerHTML += `
        <tr>
          <td>${item.material || "-"}</td>
          <td>${item.color || "-"}</td>
          <td>${item.um || "-"}</td>
          <td>${item.t_tarea ?? "-"}</td>
        </tr>
      `
    })
  })
}

function renderHojaPatron(patron = []) {
  const refuerzoBody = document.getElementById("tablaPatronRefuerzo")
  const forroBody = document.getElementById("tablaPatronForro")
  const capelladaBody = document.getElementById("tablaPatronCapellada")

  if (!refuerzoBody || !forroBody || !capelladaBody) return

  refuerzoBody.innerHTML = ""
  forroBody.innerHTML = ""
  capelladaBody.innerHTML = ""

  if (!Array.isArray(patron) || !patron.length) {
    refuerzoBody.innerHTML = `<tr><td colspan="4">Sin patrón</td></tr>`
    forroBody.innerHTML = `<tr><td colspan="4">Sin patrón</td></tr>`
    capelladaBody.innerHTML = `<tr><td colspan="4">Sin patrón</td></tr>`
    return
  }

  const bloques = {
    "CORTE REFUERZO": refuerzoBody,
    "CORTE FORRO": forroBody,
    "CORTE CAPELLADA": capelladaBody
  }

  patron.forEach(bloque => {
    const nombreBloque = (bloque.bloque || "").toUpperCase().trim()
    const tbody = bloques[nombreBloque]

    if (!tbody) return

    const items = Array.isArray(bloque.items) ? bloque.items : []

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="4">Sin datos en este bloque</td></tr>`
      return
    }

    items.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${item.material || "-"}</td>
          <td>${item.color || "-"}</td>
          <td>${item.um || "-"}</td>
          <td>${item.t_tarea ?? "-"}</td>
        </tr>
      `
    })
  })

  if (!refuerzoBody.innerHTML.trim()) {
    refuerzoBody.innerHTML = `<tr><td colspan="4">Sin datos de corte refuerzo</td></tr>`
  }

  if (!forroBody.innerHTML.trim()) {
    forroBody.innerHTML = `<tr><td colspan="4">Sin datos de corte forro</td></tr>`
  }

  if (!capelladaBody.innerHTML.trim()) {
    capelladaBody.innerHTML = `<tr><td colspan="4">Sin datos de corte capellada</td></tr>`
  }
}

function renderCabeceraPatron(orden, ficha) {
  const codigo = ficha?.codigo || orden?.codigo || "-"
  const fechaEntrega = formatearFecha(ficha?.fecha_entrega || orden?.fecha_entrega)
  const temporada = ficha?.temporada || "-"
  const articulo = ficha?.nombre || orden?.modelo_nombre || "-"
  const marca = ficha?.marca || orden?.marca || "-"
  const horma = ficha?.horma || orden?.horma || "-"
  const numeroTarea = orden?.numero_tarea || orden?.numero || "-"
  const pedido = orden?.pedido || "-"
  const nroSeg = orden?.nro_seg || "0"

  const patronCodigoInterno = document.getElementById("patronCodigoInterno")
  const patronFechaEntrega = document.getElementById("patronFechaEntrega")
  const patronTemporada = document.getElementById("patronTemporada")
  const patronArticulo = document.getElementById("patronArticulo")
  const patronMarca = document.getElementById("patronMarca")
  const patronHorma = document.getElementById("patronHorma")
  const patronNumeroTarea = document.getElementById("patronNumeroTarea")
  const patronPedido = document.getElementById("patronPedido")
  const patronNroSeg = document.getElementById("patronNroSeg")

  if (patronCodigoInterno) patronCodigoInterno.textContent = codigo
  if (patronFechaEntrega) patronFechaEntrega.textContent = fechaEntrega
  if (patronTemporada) patronTemporada.textContent = temporada
  if (patronArticulo) patronArticulo.textContent = articulo
  if (patronMarca) patronMarca.textContent = marca
  if (patronHorma) patronHorma.textContent = horma
  if (patronNumeroTarea) patronNumeroTarea.textContent = numeroTarea
  if (patronPedido) patronPedido.textContent = pedido
  if (patronNroSeg) patronNroSeg.textContent = nroSeg
}

function limpiarFichaVisual() {
  const temporada = document.getElementById("temporada")
  const horma = document.getElementById("horma")
  const detalleGeneral = document.getElementById("detalleTecnicoGeneral")
  const detallePatron = document.getElementById("detalleTecnicoPatron")

  if (temporada) temporada.textContent = "-"
  if (horma) horma.textContent = "-"

  if (detalleGeneral) {
    detalleGeneral.textContent = "Sin ficha técnica asociada"
  }

  if (detallePatron) {
    detallePatron.textContent = "Sin ficha técnica asociada"
  }
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

function obtenerBloquesPorSector(sector) {
  const mapa = {
    corte: ["CORTE REFUERZO", "CORTE FORRO", "CORTE CAPELLADA"],
    aparado: [],
    armado: [],
    terminacion: []
  }

  return mapa[sector] || []
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

    console.log("🧪 ORDEN COMPLETA:", orden)
    console.log("🧪 PATRON RECIBIDO:", orden.patron)
    console.log("🧪 FICHA RECIBIDA:", orden.ficha)

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

const ficha = normalizarFicha(orden.ficha || null)
const patron = Array.isArray(orden.patron) ? orden.patron : []

fichaActual = ficha
patronActual = patron

if (ficha) {
  document.getElementById("temporada").textContent = ficha.temporada || "-"
  document.getElementById("horma").textContent = ficha.horma || "-"
  document.getElementById("articuloNombre").textContent =
    ficha.nombre || orden.modelo_nombre || "-"

  const detalleGeneral = document.getElementById("detalleTecnicoGeneral")
  const detallePatron = document.getElementById("detalleTecnicoPatron")

  const detalleTexto =
    ficha.detalle_general ||
    orden.detalle_tecnico ||
    "Sin detalle técnico"

  if (detalleGeneral) {
    detalleGeneral.textContent = detalleTexto
  }

  if (detallePatron) {
    detallePatron.textContent = detalleTexto
  }
} else {
  limpiarFichaVisual()
}

sectorActual = null
actualizarTituloSector(null)

renderCabeceraPatron(orden, fichaActual)
renderTallesPatron(orden.talles, orden.pares_plan || orden.pares || 0)
renderHojaPatron(patronActual)

if (fichaActual) {
  renderSectoresGenerales(fichaActual)
} else {
  renderSectoresGenerales(null)
}
  } catch (err) {
  console.error("Error en orden_ver:", err)
  alert("Error inesperado al cargar la orden: " + err.message)
}
}

let ordenActual = null
let fichaActual = null
let patronActual = null
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
  if (!fichaActual && !patronActual?.length) {
    alert("Esta orden no tiene información para imprimir")
    return
  }

  sectorActual = null
  actualizarTituloSector(null)

  if (patronActual?.length) {
    renderMaterialesPatron(patronActual, null)
  } else {
    renderMaterialesFicha(fichaActual, null)
  }

  window.print()
}
function imprimirSector(sector) {
  if (!fichaActual && !patronActual?.length) {
    alert("Esta orden no tiene información para imprimir ese sector")
    return
  }

  sectorActual = sector
  actualizarTituloSector(sector)

  if (patronActual?.length) {
    renderMaterialesPatron(patronActual, sector)
  } else {
    renderMaterialesFicha(fichaActual, sector)
  }

  window.print()

  sectorActual = null
  actualizarTituloSector(null)

  if (patronActual?.length) {
    renderMaterialesPatron(patronActual, null)
  } else {
    renderMaterialesFicha(fichaActual, null)
  }
}

cargarOrden()