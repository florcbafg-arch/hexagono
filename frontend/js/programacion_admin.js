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

  const res = await fetch("/api/programacion/generar", {
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