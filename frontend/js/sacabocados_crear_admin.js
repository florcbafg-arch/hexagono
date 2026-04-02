const params = new URLSearchParams(window.location.search)
const id = params.get("id")

let guardandoSacabocado = false

async function cargarSacabocadoSiEdita() {
  if (!id) return

  try {
    const res = await apiFetch(`/api/sacabocados/${id}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error cargando sacabocado")
    }

    const s = data.sacabocado

    document.getElementById("tituloPantalla").textContent = "Editar Sacabocado"
    document.getElementById("marca").value = s.marca || ""
    document.getElementById("modelo_referencia").value = s.modelo_referencia || ""
    document.getElementById("pieza").value = s.pieza || ""
    document.getElementById("subpieza").value = s.subpieza || ""
    document.getElementById("descripcion").value = s.descripcion || ""
    document.getElementById("unidad_medida").value = s.unidad_medida || ""
    document.getElementById("ancho").value = s.ancho ?? ""
    document.getElementById("alto").value = s.alto ?? ""
    document.getElementById("area_base").value = s.area_base ?? ""
    document.getElementById("consumo_referencia").value = s.consumo_referencia ?? ""
    document.getElementById("activo").value = String(s.activo ?? true)
    document.getElementById("observaciones").value = s.observaciones || ""
  } catch (error) {
    console.error("Error cargando sacabocado:", error)
    alert(error.message || "Error cargando sacabocado")
  }
}

async function guardarSacabocado() {
  if (guardandoSacabocado) return
  guardandoSacabocado = true

  const btnGuardar = document.getElementById("btnGuardarSacabocado")
  if (btnGuardar) {
    btnGuardar.disabled = true
    btnGuardar.textContent = "Guardando..."
  }

  const marca = document.getElementById("marca").value.trim()
  const modelo_referencia = document.getElementById("modelo_referencia").value.trim()
  const pieza = document.getElementById("pieza").value.trim()
  const subpieza = document.getElementById("subpieza").value.trim()
  const descripcion = document.getElementById("descripcion").value.trim()
  const unidad_medida = document.getElementById("unidad_medida").value.trim()
  const anchoRaw = document.getElementById("ancho").value
  const altoRaw = document.getElementById("alto").value
  const areaBaseRaw = document.getElementById("area_base").value
  const consumoReferenciaRaw = document.getElementById("consumo_referencia").value
  const activo = document.getElementById("activo").value === "true"
  const observaciones = document.getElementById("observaciones").value.trim()

  if (!marca) {
    restaurarBoton()
    return alert("Ingresar marca")
  }

  if (!pieza) {
    restaurarBoton()
    return alert("Ingresar pieza")
  }

  const payload = {
    marca,
    modelo_referencia,
    pieza,
    subpieza,
    descripcion,
    unidad_medida,
    ancho: anchoRaw === "" ? null : Number(anchoRaw),
    alto: altoRaw === "" ? null : Number(altoRaw),
    area_base: areaBaseRaw === "" ? null : Number(areaBaseRaw),
    consumo_referencia: consumoReferenciaRaw === "" ? null : Number(consumoReferenciaRaw),
    activo,
    observaciones
  }

  try {
    const url = id ? `/api/sacabocados/${id}` : "/api/sacabocados"
    const method = id ? "PUT" : "POST"

    const res = await apiFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Error guardando sacabocado")
    }

    alert(id ? "Sacabocado actualizado correctamente" : "Sacabocado creado correctamente")
    window.location.href = "sacabocados_admin.html"
  } catch (error) {
    console.error("Error guardando sacabocado:", error)
    alert(error.message || "Error guardando sacabocado")
    restaurarBoton()
  }
}

function restaurarBoton() {
  guardandoSacabocado = false

  const btnGuardar = document.getElementById("btnGuardarSacabocado")
  if (btnGuardar) {
    btnGuardar.disabled = false
    btnGuardar.textContent = "💾 Guardar"
  }
}

function volver() {
  window.location.href = "sacabocados_admin.html"
}

window.addEventListener("DOMContentLoaded", cargarSacabocadoSiEdita)