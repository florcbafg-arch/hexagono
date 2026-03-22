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

async function generarOrdenes() {

  const confirmar = confirm("¿Generar órdenes reales?")

  if (!confirmar) return

  const res = await apiFetch("/api/programacion/generar", {
    method: "POST"
  })

  const json = await res.json()

  if(json.ok){
    alert("🚀 Órdenes generadas correctamente")
    location.reload()
  } else {
    alert("Error al generar")
  }
}

  const res = await apiFetch("/api/programacion/importar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })

  const json = await res.json()

  if(json.ok){
    alert("Órdenes generadas 🚀")
  } else {
    alert("Error")
  }
}

if(result.ok){
  alert("🔥 Programación cargada")

  // 🔄 recargar tabla visual (simple)
  location.reload()
}

async function importarExcel() {

  const fileInput = document.getElementById("excelFile")
  const file = fileInput.files[0]

  if (!file) {
    alert("Seleccioná un archivo")
    return
  }

  const reader = new FileReader()

  reader.onload = async (e) => {

    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: "array" })

    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const json = XLSX.utils.sheet_to_json(sheet)

    console.log("EXCEL:", json)

    // 🔥 TRANSFORMAR A FORMATO HEXAFLOW
    const programacion = json.map(row => ({
      modelo: row.MODELO || row.Modelo,
      cantidad: row.PARES || row.Cantidad,
      fecha: new Date(),
      prioridad: "media"
    }))

    // 🚀 ENVIAR AL BACKEND
    const res = await apiFetch("/api/programacion/generar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(programacion)
    })

    const result = await res.json()

    if(result.ok){
      alert("🔥 Programación cargada desde Excel")
    } else {
      alert("Error al importar")
    }

  }

  reader.readAsArrayBuffer(file)
}