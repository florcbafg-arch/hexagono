function agregarFila() {
  const fila = `
    <tr>
      <td><input placeholder="Modelo"></td>
      <td><input type="number"></td>
      <td><input type="date"></td>
      <td>
        <select>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </td>
      <td><span class="estado pendiente">pendiente</span></td>
    </tr>
  `
  document.getElementById("tabla").innerHTML += fila
}

function formatearFecha(fecha) {
  if (!fecha) return "-"
  const d = new Date(fecha)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString("es-AR")
}

function pintarProgramacion(items) {
  const tabla = document.getElementById("tabla")

  if (!items || items.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">No hay programación cargada</td>
      </tr>
    `
    return
  }

  tabla.innerHTML = items.map(item => `
    <tr>
      <td>${item.modelo || "-"}</td>
      <td>${item.cantidad || 0}</td>
      <td>${formatearFecha(item.fecha)}</td>
      <td>${item.prioridad || "-"}</td>
      <td>${item.estado || "pendiente"}</td>
    </tr>
  `).join("")
}

async function cargarProgramacion() {
  try {
    const res = await apiFetch("/api/programacion")
    const data = await res.json()

    console.log("PROGRAMACION DESDE BACK:", data)

    const items = Array.isArray(data) ? data : (data.items || data.data || [])
    pintarProgramacion(items)
  } catch (error) {
    console.error("ERROR CARGANDO PROGRAMACION:", error)
    document.getElementById("tabla").innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">Error al cargar programación</td>
      </tr>
    `
  }
}

async function generarOrdenes() {

  const confirmar = confirm("¿Generar órdenes reales?")

  if (!confirmar) return

  const res = await apiFetch("/api/programacion/generar", {
    method: "POST"
  })

  const json = await res.json()

  if (json.ok && json.creadas > 0) {
  alert(`🚀 Órdenes generadas: ${json.creadas}`)
  await cargarProgramacion()
} else {
  console.error("Resultado generar:", json)

// 👇 ESTO ES LO IMPORTANTE
console.log("ERRORES DETALLADOS:", json.errores)
console.log("ERRORES JSON:", JSON.stringify(json.errores, null, 2))

// 👇 opcional pero útil
if (json.errores && json.errores.length > 0) {
  console.table(json.errores)
}
}
}

async function importarExcel() {
  const fileInput = document.getElementById("excelFile")
  const file = fileInput.files[0]
  

  if (!file) {
    alert("Seleccioná un archivo")
    return
  }

  console.log("ARCHIVO SELECCIONADO:", file.name)

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
  alert("Solo se permiten archivos Excel (.xlsx o .xls)")
  return
}

function convertirFecha(fecha) {
  if (fecha === null || fecha === undefined || fecha === "") return null

  // ✅ Caso 1: número serial de Excel
  if (typeof fecha === "number" && !isNaN(fecha)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const fechaConvertida = new Date(excelEpoch.getTime() + fecha * 86400000)

    const y = fechaConvertida.getUTCFullYear()
    const m = String(fechaConvertida.getUTCMonth() + 1).padStart(2, "0")
    const d = String(fechaConvertida.getUTCDate()).padStart(2, "0")

    return `${y}-${m}-${d}`
  }

  const texto = String(fecha).trim()

  // ✅ Caso 2: viene como texto numérico serial de Excel: "46111"
  if (/^\d{5}$/.test(texto)) {
    const serial = Number(texto)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const fechaConvertida = new Date(excelEpoch.getTime() + serial * 86400000)

    const y = fechaConvertida.getUTCFullYear()
    const m = String(fechaConvertida.getUTCMonth() + 1).padStart(2, "0")
    const d = String(fechaConvertida.getUTCDate()).padStart(2, "0")

    return `${y}-${m}-${d}`
  }

  // ✅ Caso 3: formato dd/mm/yyyy
  const matchLatino = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchLatino) {
    const [, d, m, y] = matchLatino
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // ✅ Caso 4: ya viene tipo yyyy-mm-dd
  const matchISO = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matchISO) {
    return texto
  }

  // ✅ Caso 5: intentar parsear con Date
  const d = new Date(texto)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const dia = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dia}`
  }

  // 🚨 Si no se pudo convertir, mejor null que romper backend
  console.warn("Fecha no reconocida:", fecha)
  return null
}
  const reader = new FileReader()

  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)

   console.log("PRIMERA FILA EXCEL:", json[0])
console.log("TODAS LAS CLAVES DE LA PRIMERA FILA:", Object.keys(json[0] || {}))

    const programacion = json
  .map(row => ({
    marca: row["MARCA"] || row["Marca"] || row["marca"] || null,
    estado: row["ESTADO"] || row["Estado"] || row["estado"] || "pendiente",
 fecha: convertirFecha(
  row["FECHA DE INGRESO"] ?? row["Fecha de ingreso"] ?? row["fecha"] ?? null
),
    numero_tarea: row["Nº DE TAREA"] || row["N° DE TAREA"] || row["N DE TAREA"] || row["numero_tarea"] || null,
    curva: row["CURVA"] || row["Curva"] || row["curva"] || null,
    modelo: row["MODELO"] || row["Modelo"] || row["modelo"] || null,
    codigo: row["CODIGO"] || row["Codigo"] || row["codigo"] || null,
    v_p: row["V/P"] || row["v_p"] || row["vp"] || null,
    horma: row["HORMA"] || row["Horma"] || row["horma"] || null,
    cantidad: Number(row["PARES"] || row["Cantidad"] || row["cantidad"] || 0),
    pares_remitidos: Number(row["PARES REMITADOS"] || row["pares_remitidos"] || 0),
    pedido: row["PEDIDO"] || row["Pedido"] || row["pedido"] || null,
    comentario: row["COMENTARIO"] || row["Comentario"] || row["comentario"] || null,
    mes_entrega: row["MES ENTREGA"] || row["Mes entrega"] || row["mes_entrega"] || null,
    prioridad: "media"
  }))
  .filter(item => item.modelo && item.cantidad > 0)
      

console.log("MAPEADO A PROGRAMACION:", programacion.slice(0, 5))
    console.log("PROGRAMACION LIMPIA:", programacion[0])
    console.log("TOTAL VALIDAS:", programacion.length)

    if (programacion.length === 0) {
      alert("El Excel no tiene filas válidas. Revisá nombres de columnas como MODELO y PARES.")
      return
    }

    const res = await apiFetch("/api/programacion/importar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(programacion)
    })

    const result = await res.json()

    if (result.ok) {
  alert(`🔥 Programación cargada. Importadas: ${result.total}`)
  fileInput.value = ""
  await cargarProgramacion()
} else {
      alert(result.error || "Error al importar")
      console.error("ERROR BACKEND:", result)
    }
  }

  reader.readAsArrayBuffer(file)
}

cargarProgramacion()