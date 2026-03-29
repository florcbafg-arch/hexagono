(() => {
  let ordenActual = null
  let resumenInterval = null

  async function initProduccion() {
    const input = document.getElementById("tarea")
    const container = document.getElementById("produccionContainer")

    if (!input || !container) return

    if (resumenInterval) {
      clearInterval(resumenInterval)
      resumenInterval = null
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        buscarOrdenes()
      }
    })

    await cargarProduccionResumen()
    resumenInterval = setInterval(() => {
      const visibleContainer = document.getElementById("produccionContainer")
      if (!visibleContainer) {
        clearInterval(resumenInterval)
        resumenInterval = null
        return
      }
      cargarProduccionResumen()
    }, 5000)
  }

  async function buscarOrdenes() {
    const input = document.getElementById("tarea")
    const info = document.getElementById("info")
    const tabla = document.getElementById("tabla")
    const acciones = document.getElementById("acciones")

    if (!input || !info || !tabla || !acciones) return

    const numero = input.value.trim()

    if (!numero) {
      alert("Ingresá un número de tarea")
      return
    }

    try {
      const res = await apiFetch("/api/ordenes/" + numero)

      if (res.status !== 200) {
        info.innerHTML = ""
        tabla.innerHTML = ""
        acciones.innerHTML = ""
        ordenActual = null
        return
      }

      const orden = await res.json()
      ordenActual = orden

      info.innerHTML = `
        <h2>Orden ${orden.numero}</h2>
        <p>
          Marca: ${orden.marca || "-"} |
          Modelo: ${orden.modelo || "-"} |
          Cantidad: ${orden.pares || 0} pares
        </p>
      `

      await cargarProduccion(numero)
    } catch (error) {
      console.error("Error buscando orden:", error)
      alert("Error al buscar la orden")
    }
  }

  async function cargarProduccion(numero) {
    const tabla = document.getElementById("tabla")
    const acciones = document.getElementById("acciones")

    if (!tabla || !acciones) return

    try {
      const res = await apiFetch("/api/produccion/ordenes/" + numero)
      const data = await res.json()

      let html = `
        <table class="tabla-produccion">
          <tr>
            <th>Sector</th>
            <th>Producción</th>
          </tr>
      `

      if (!Array.isArray(data) || data.length === 0) {
        const sectores = [
          "Ingreso de Línea",
          "Salida de Línea",
          "Empaque de Aparado",
          "Strobel",
          "Ojillado",
          "Cortado",
          "Cerrado",
          "Lengua",
          "Aparado",
          "Armado",
          "Pre Empaque",
          "Empaque",
          "Embalado"
        ]

        sectores.forEach((s, i) => {
          html += `
            <tr>
              <td>${s}</td>
              <td>
                <input 
                  type="number"
                  class="prod-edit"
                  data-puesto="${i + 1}"
                  value="0"
                >
              </td>
            </tr>
          `
        })
      } else {
        data.sort((a, b) => {
          const ordenA = a?.puestos?.orden ?? 999
          const ordenB = b?.puestos?.orden ?? 999
          return ordenA - ordenB
        })

        data.forEach(p => {
          html += `
            <tr>
              <td>${p?.puestos?.nombre || "-"}</td>
              <td>
                <input 
                  type="number"
                  class="prod-edit"
                  data-id="${p.id || ""}"
                  data-puesto="${p.puesto_id || ""}"
                  value="${p.cantidad || 0}"
                >
              </td>
            </tr>
          `
        })
      }

      html += `</table>`

      tabla.innerHTML = html
      acciones.innerHTML = `
        <button class="btn-guardar" onclick="guardarCambios()">
          Guardar cambios
        </button>
      `
    } catch (error) {
      console.error("Error cargando producción:", error)
      tabla.innerHTML = ""
      acciones.innerHTML = ""
      alert("Error al cargar producción")
    }
  }

  async function guardarCambios() {
    if (!ordenActual?.id) {
      alert("Primero buscá una orden")
      return
    }

    const inputs = document.querySelectorAll(".prod-edit")
    const registros = []

    inputs.forEach(i => {
      registros.push({
        id: i.dataset.id || null,
        ordenes_id: ordenActual.id,
        puesto_id: Number(i.dataset.puesto),
        cantidad: Number(i.value || 0)
      })
    })

    try {
      await apiFetch("/api/produccion", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(registros)
      })

      alert("Producción actualizada ✅")
      buscarOrdenes()
    } catch (error) {
      console.error("Error guardando producción:", error)
      alert("Error al guardar producción")
    }
  }

  async function cargarProduccionResumen() {
    const container = document.getElementById("produccionContainer")
    if (!container) return

    try {
      const res = await apiFetch("/api/produccion/resumen")
      const data = await res.json()

      container.innerHTML = ""

      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<p>No hay datos de producción.</p>`
        return
      }

      data.forEach(item => {
        const producido = Number(item.producido || 0)
        const objetivo = Number(item.objetivo || 0)
        const porcentaje = objetivo > 0
          ? Math.min((producido / objetivo) * 100, 100)
          : 0

        container.innerHTML += `
          <div class="card">
            <h3>Orden #${item.id}</h3>
            <p>${producido} / ${objetivo}</p>
            <p>${item.estado || "-"}</p>

            <div style="background:#ddd;height:10px;">
              <div style="width:${porcentaje}%;background:green;height:10px;"></div>
            </div>
          </div>
        `
      })
    } catch (error) {
      console.error("Error cargando resumen de producción:", error)
    }
  }

  window.initProduccion = initProduccion
  window.buscarOrdenes = buscarOrdenes
  window.guardarCambios = guardarCambios
})()