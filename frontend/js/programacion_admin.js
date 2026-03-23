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
  alert(`No se generó ninguna orden. Revisá consola.\nErrores: ${(json.errores || []).length}`)
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

  const reader = new FileReader()

  function normalizarTexto(texto) {
    return String(texto || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // saca acentos
      .replace(/\s+/g, " ") // espacios dobles
  }

  function normalizarFila(row) {
    const fila = {}

    Object.keys(row || {}).forEach(key => {
      const keyNormalizada = normalizarTexto(key)
      fila[keyNormalizada] = row[key]
    })

    return fila
  }

  function obtenerValor(fila, aliases = []) {
    for (const alias of aliases) {
      const key = normalizarTexto(alias)
      if (fila[key] !== undefined && fila[key] !== null && fila[key] !== "") {
        return fila[key]
      }
    }
    return null
  }

  function convertirNumero(valor) {
    if (valor === null || valor === undefined || valor === "") return 0

    if (typeof valor === "number") return valor

    const limpio = String(valor)
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()

    const numero = Number(limpio)
    return isNaN(numero) ? 0 : numero
  }

  function convertirFechaExcel(valor) {
    if (!valor) return null

    // Si ya viene como número serial de Excel
    if (typeof valor === "number") {
      const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000))
      return isNaN(fecha.getTime()) ? null : fecha.toISOString().split("T")[0]
    }

    // Si viene como texto
    const texto = String(valor).trim()

    // dd/mm/yyyy
    const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) {
      const [, dd, mm, yyyy] = match
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
    }

    const fecha = new Date(texto)
    return isNaN(fecha.getTime()) ? texto : fecha.toISOString().split("T")[0]
  }

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" })

      console.log("PRIMERA FILA EXCEL:", json[0])
      console.log("TODAS LAS CLAVES DE LA PRIMERA FILA:", Object.keys(json[0] || {}))

      const programacion = json
        .map(row => {
          const fila = normalizarFila(row)

          return {
            marca: obtenerValor(fila, ["MARCA", "Marca", "marca"]),
            estado: obtenerValor(fila, ["ESTADO", "Estado", "estado"]) || "pendiente",
            fecha: convertirFechaExcel(
              obtenerValor(fila, [
                "FECHA DE INGRESO",
                "Fecha de ingreso",
                "FECHA",
                "Fecha",
                "fecha"
              ])
            ),
            numero_tarea: obtenerValor(fila, [
              "Nº DE TAREA",
              "N° DE TAREA",
              "N DE TAREA",
              "NUMERO DE TAREA",
              "NUMERO_TAREA",
              "numero_tarea"
            ]),
            curva: obtenerValor(fila, ["CURVA", "Curva", "curva"]),
            modelo: obtenerValor(fila, ["MODELO", "Modelo", "modelo"]),
            codigo: obtenerValor(fila, ["CODIGO", "CÓDIGO", "Codigo", "Código", "codigo"]),
            v_p: obtenerValor(fila, ["V/P", "V P", "VP", "v_p", "vp"]),
            horma: obtenerValor(fila, ["HORMA", "Horma", "horma"]),
            cantidad: convertirNumero(
              obtenerValor(fila, ["PARES", "Cantidad", "CANTIDAD", "cantidad"])
            ),
            pares_remitidos: convertirNumero(
              obtenerValor(fila, [
                "PARES REMITIDOS",
                "PARES REMITADOS",
                "PARES_REMITIDOS",
                "pares_remitidos"
              ])
            ),
            pedido: obtenerValor(fila, ["PEDIDO", "Pedido", "pedido"]),
            comentario: obtenerValor(fila, ["COMENTARIO", "Comentario", "comentario"]),
            mes_entrega: obtenerValor(fila, [
              "MES ENTREGA",
              "MES DE ENTREGA",
              "Mes entrega",
              "mes_entrega"
            ]),
            prioridad: "media"
          }
        })
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
    } catch (error) {
      console.error("ERROR IMPORTANDO EXCEL:", error)
      alert("Ocurrió un error al procesar el Excel")
    }
  }

  reader.readAsArrayBuffer(file)
}

cargarProgramacion()