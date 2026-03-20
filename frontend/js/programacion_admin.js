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
    </tr>
  `
  document.getElementById("tabla").innerHTML += fila
}

async function generarOrdenes() {

  const filas = document.querySelectorAll("#tabla tr")

  const data = []

  filas.forEach(fila => {
    const inputs = fila.querySelectorAll("input, select")

    data.push({
      modelo: inputs[0].value,
      cantidad: parseInt(inputs[1].value),
      fecha: inputs[2].value,
      prioridad: inputs[3].value
    })
  })

  const res = await fetch("https://hexagono.pro/api/programacion/generar", {
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
    const res = await fetch("https://hexagono.pro/api/programacion/generar", {
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