(() => {
  const PIEZAS = [
    "Capellada",
    "Caña",
    "Lengua",
    "Cordonería",
    "Talón",
    "Forro",
    "Plantilla",
    "Suela"
  ]

  async function initPatrones() {
    const select = document.getElementById("modeloSelect")
    const tbody = document.querySelector("#tablaPatrones tbody")

    if (!select || !tbody) return

    tbody.innerHTML = ""

    await cargarModelos()
    agregarFila()
  }

  async function cargarModelos() {
    try {
      const res = await apiFetch("/api/modelos")
      const modelos = await res.json()

      const select = document.getElementById("modeloSelect")
      if (!select) return

      select.innerHTML = `<option value="">Seleccionar modelo</option>`

      modelos.forEach(m => {
        const opt = document.createElement("option")
        opt.value = m.id
        opt.textContent = m.nombre
        select.appendChild(opt)
      })
    } catch (err) {
      console.error("Error cargando modelos:", err)
    }
  }

  function agregarFila() {
    const tbody = document.querySelector("#tablaPatrones tbody")
    if (!tbody) return

    const opciones = PIEZAS.map(p => `<option value="${p}">${p}</option>`).join("")
    const tr = document.createElement("tr")

    tr.innerHTML = `
      <td>
        <select>
          <option value="CORTE REFUERZO">CORTE REFUERZO</option>
          <option value="CORTE FORRO">CORTE FORRO</option>
          <option value="CORTE CAPELLADA">CORTE CAPELLADA</option>
        </select>
      </td>

      <td>
        <select>
          <option value="">Seleccionar</option>
          ${opciones}
        </select>
      </td>

      <td><input placeholder="Material"></td>
      <td><input placeholder="Color"></td>

      <td>
        <select>
          <option value="m">m</option>
          <option value="m2">m2</option>
          <option value="unidad">unidad</option>
          <option value="plancha">plancha</option>
        </select>
      </td>

      <td><input type="number" step="0.01"></td>

      <td>
        <button type="button" class="btn-eliminar-fila">❌</button>
      </td>
    `

    const btnEliminar = tr.querySelector(".btn-eliminar-fila")
    if (btnEliminar) {
      btnEliminar.addEventListener("click", () => tr.remove())
    }

    tbody.appendChild(tr)
  }

  async function guardarPatron() {
    const modeloSelect = document.getElementById("modeloSelect")
    if (!modeloSelect) return

    const modelo_id = modeloSelect.value

    if (!modelo_id) {
      alert("Seleccioná un modelo")
      return
    }

    const filas = document.querySelectorAll("#tablaPatrones tbody tr")
    const patrones = []

    filas.forEach(f => {
      const inputs = f.querySelectorAll("input, select")
      if (!inputs.length || !inputs[0].value) return

      patrones.push({
        bloque: inputs[0].value,
        pieza: inputs[1].value,
        material: inputs[2].value,
        color: inputs[3].value,
        unidad: inputs[4].value,
        consumo: parseFloat(inputs[5].value || 0)
      })
    })

    try {
      await apiFetch("/api/patrones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo_id, patrones })
      })

      alert("Patrón guardado")
    } catch (error) {
      console.error("Error guardando patrón:", error)
      alert("Error al guardar patrón")
    }
  }

  async function calcular() {
    const modeloSelect = document.getElementById("modeloSelect")
    const cantidadInput = document.getElementById("cantidad")
    const resultado = document.getElementById("resultado")

    if (!modeloSelect || !cantidadInput || !resultado) return

    const modelo_id = modeloSelect.value
    const cantidad = Number(cantidadInput.value)

    if (!modelo_id) {
      alert("Seleccioná un modelo")
      return
    }

    if (!cantidad || cantidad <= 0) {
      alert("Ingresá cantidad válida")
      return
    }

    try {
      const res = await apiFetch("/api/patrones/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo_id, cantidad })
      })

      const data = await res.json()

      resultado.innerHTML = ""

      data.forEach(b => {
        const titulo = document.createElement("h4")
        titulo.textContent = b.bloque
        resultado.appendChild(titulo)

        b.items.forEach(m => {
          const p = document.createElement("p")
          p.textContent = `${m.material} (${m.color}) → ${m.total} ${m.unidad}`
          resultado.appendChild(p)
        })
      })
    } catch (error) {
      console.error("Error calculando consumo:", error)
      alert("Error al calcular consumo")
    }
  }

  window.initPatrones = initPatrones
  window.agregarFila = agregarFila
  window.guardarPatron = guardarPatron
  window.calcular = calcular
})()