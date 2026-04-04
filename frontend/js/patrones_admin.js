(() => {

  async function initPatrones() {
    await cargarModelos()

    const select = document.getElementById("modeloSelect")

    if (select) {
      select.addEventListener("change", async () => {
        const modelo_id = select.value
        if (modelo_id) {
          await cargarDesdeFicha(modelo_id)
        }
      })
    }
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

  async function cargarDesdeFicha(modelo_id) {
    const tbody = document.querySelector("#tablaPatrones tbody")
    if (!tbody) return

    tbody.innerHTML = ""

    try {
      const res = await apiFetch(`/api/patrones/generar-desde-ficha/${modelo_id}`)
      const data = await res.json()

      data.bloques.forEach(bloque => {

        // titulo bloque
        const trTitulo = document.createElement("tr")
        trTitulo.innerHTML = `
          <td colspan="6" style="background:#eee;font-weight:bold;">
            ${bloque.bloque}
          </td>
        `
        tbody.appendChild(trTitulo)

        // items
        bloque.items.forEach(item => {
          const tr = document.createElement("tr")

          tr.innerHTML = `
            <td>${item.pieza}</td>
            <td>${item.material}</td>
            <td>${item.color || ""}</td>

            <td>
              <select class="um">
                <option value="">-</option>
                <option value="m">m</option>
                <option value="m2">m2</option>
                <option value="unidad">unidad</option>
                <option value="plancha">plancha</option>
              </select>
            </td>

            <td>
              <input type="number" class="t_tarea" step="0.01" value="${item.t_tarea || ""}">
            </td>
          `

          tr.dataset.ficha_material_id = item.ficha_material_id

          // setear UM si ya existe
          if (item.um) {
            setTimeout(() => {
              tr.querySelector(".um").value = item.um
            }, 0)
          }

          tbody.appendChild(tr)
        })
      })

    } catch (err) {
      console.error("Error cargando patrón:", err)
      alert("Error cargando patrón")
    }
  }

  async function guardarPatron() {
    const modeloSelect = document.getElementById("modeloSelect")
    if (!modeloSelect) return

    const modelo_id = modeloSelect.value
    if (!modelo_id) {
      alert("Seleccioná modelo")
      return
    }

    const filas = document.querySelectorAll("#tablaPatrones tbody tr")
    const items = []

    filas.forEach(f => {
      const id = f.dataset.ficha_material_id
      if (!id) return

      const um = f.querySelector(".um")?.value || ""
      const t_tarea = f.querySelector(".t_tarea")?.value || ""

      items.push({
        ficha_material_id: Number(id),
        um,
        t_tarea
      })
    })

    try {
      await apiFetch("/api/patrones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo_id, items })
      })

      alert("Patrón guardado")
    } catch (error) {
      console.error("Error guardando patrón:", error)
      alert("Error al guardar")
    }
  }

  window.initPatrones = initPatrones
  window.guardarPatron = guardarPatron

})()