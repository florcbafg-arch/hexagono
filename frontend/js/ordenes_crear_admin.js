const form = document.getElementById("formTarea")
const modeloSelect = document.getElementById("modelo")
const totalParesInput = document.getElementById("total_pares_input")
const tallesPreview = document.getElementById("tallesPreview")
const totalSpan = document.getElementById("total")
const mensaje = document.getElementById("mensajeOrden")
const btnCrearOrden = document.getElementById("btnCrearOrden")
const btnCalcular = document.getElementById("btnCalcular")

let tallesCalculados = []

function setMensaje(texto, tipo = "normal") {
  mensaje.textContent = texto
  mensaje.style.color =
    tipo === "error" ? "red" :
    tipo === "ok" ? "green" :
    "#333"
}

async function cargarModelos() {
  try {
    const res = await apiFetch("/api/modelos")
    const modelos = await res.json()

    modeloSelect.innerHTML = `<option value="">Seleccionar modelo</option>`

    modelos.forEach(m => {
      const option = document.createElement("option")
      option.value = m.id
      option.textContent = m.nombre
      modeloSelect.appendChild(option)
    })
  } catch (err) {
    console.error("Error cargando modelos:", err)
    setMensaje("Error cargando modelos", "error")
  }
}

async function obtenerCurvaModelo(modeloId) {
  const res = await apiFetch(`/api/modelos/${modeloId}/curva`)
  return await res.json()
}

function calcularTallesSegunCurva(curva, totalPares) {
  const items = curva.items || []
  if (!items.length) return []

  const sumaBase = items.reduce((acc, item) => acc + Number(item.valor || 0), 0)
  if (!sumaBase) return []

  let acumulado = 0

  const resultado = items.map((item, index) => {
    let cantidad

    if (index === items.length - 1) {
      cantidad = totalPares - acumulado
    } else {
      cantidad = Math.round((Number(item.valor || 0) / sumaBase) * totalPares)
      acumulado += cantidad
    }

    return {
      talle: item.talle,
      cantidad: cantidad < 0 ? 0 : cantidad
    }
  })

  return resultado
}

function renderTalles(talles) {
  tallesPreview.innerHTML = ""

  if (!talles.length) {
    totalSpan.textContent = "0"
    return
  }

  let total = 0

  const tabla = document.createElement("table")
  tabla.border = "1"
  tabla.style.borderCollapse = "collapse"
  tabla.style.width = "100%"

  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Talle</th>
        <th>Cantidad</th>
      </tr>
    </thead>
    <tbody></tbody>
  `

  const tbody = tabla.querySelector("tbody")

  talles.forEach(t => {
    total += Number(t.cantidad || 0)

    const tr = document.createElement("tr")
    tr.innerHTML = `
      <td>${t.talle}</td>
      <td>${t.cantidad}</td>
    `
    tbody.appendChild(tr)
  })

  tallesPreview.appendChild(tabla)
  totalSpan.textContent = total
}


form.addEventListener("submit", async (e) => {
  e.preventDefault()
  setMensaje("")

  const numero = document.getElementById("numero_tarea").value.trim()
  const modelo_id = modeloSelect.value
  const total_pares = parseInt(totalParesInput.value)

  if (!numero) {
    setMensaje("Falta número de tarea", "error")
    return
  }

  if (!modelo_id) {
    setMensaje("Debes seleccionar un modelo", "error")
    return
  }

  if (isNaN(total_pares) || total_pares <= 0) {
    setMensaje("Debes ingresar un total de pares válido", "error")
    return
  }

  if (!tallesCalculados.length) {
    setMensaje("Primero debes calcular los talles", "error")
    return
  }

  btnCrearOrden.disabled = true
  btnCalcular.disabled = true
  btnCrearOrden.textContent = "Creando..."

  try {
    const res = await apiFetch("/api/ordenes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        numero,
        modelo_id,
        total_pares,
        talles: tallesCalculados
      })
    })

    const data = await res.json()

    if (!res.ok) {
      setMensaje(data.mensaje || data.error || "Error creando orden", "error")
      return
    }

    setMensaje(data.mensaje || "Orden creada correctamente", "ok")

    form.reset()
    curvaSelect.innerHTML = `<option value="">Seleccionar curva</option>`
    curvaSelect.disabled = true
    tallesCalculados = []
    tallesPreview.innerHTML = ""
    totalSpan.textContent = "0"

    setTimeout(() => {
      cargarModulo("ordenes")
    }, 700)

  } catch (err) {
    console.error("Error creando orden:", err)
    setMensaje("Error inesperado al crear la orden", "error")
  } finally {
    btnCrearOrden.disabled = false
    btnCalcular.disabled = false
    btnCrearOrden.textContent = "Crear Orden"
  }
})

cargarModelos()