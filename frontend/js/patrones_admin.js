(() => {
  let patronActual = null
  let articuloActualId = null
  let materialesMaestro = []

  const esc = (v = "") => String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  async function leerJson(res) {
    let data = {}
    try { data = await res.json() } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || "No se pudo completar la operación")
      err.status = res.status
      throw err
    }
    return data
  }

  async function initPatrones() {
    await Promise.all([cargarArticulos(), cargarMaterialesMaestro()])
    const select = document.getElementById("articuloSelect")
    select?.addEventListener("change", () => {
      if (select.value) cargarPatron(select.value)
      else limpiar()
    })
  }

  async function cargarArticulos() {
    const select = document.getElementById("articuloSelect")
    if (!select) return
    try {
      const data = await leerJson(await apiFetch("/api/articulos"))
      select.innerHTML = '<option value="">Seleccionar artículo</option>'
      ;(data || []).filter(a => a.activo !== false).forEach(a => {
        const opt = document.createElement("option")
        opt.value = a.id
        const marca = a.modelos?.marca || "Sin marca"
        const modelo = a.modelos?.nombre || "Sin modelo"
        opt.textContent = `${a.codigo} · ${marca} · ${modelo} · ${a.color}`
        select.appendChild(opt)
      })
    } catch (err) {
      console.error(err)
      mostrarMensaje("No se pudieron cargar los artículos.")
    }
  }

  function limpiar() {
    patronActual = null
    articuloActualId = null
    document.getElementById("patronBloques").innerHTML = ""
    document.getElementById("patronMeta").classList.remove("visible")
    document.getElementById("patronMeta").innerHTML = ""
    document.getElementById("patronActions").classList.remove("visible")
    mostrarMensaje("Seleccioná un artículo para cargar su patrón técnico.")
  }

  function mostrarMensaje(texto, ocultar = false) {
    const el = document.getElementById("patronMensaje")
    if (!el) return
    el.textContent = texto
    el.style.display = ocultar ? "none" : "block"
  }

  async function cargarPatron(articuloId) {
    articuloActualId = String(articuloId)
    patronActual = null
    document.getElementById("patronBloques").innerHTML = ""
    document.getElementById("patronActions").classList.remove("visible")
    mostrarMensaje("Cargando Ficha Técnica vigente…")

    try {
      const data = await leerJson(await apiFetch(`/api/patrones/v2/articulo/${articuloId}`))
      patronActual = data
      renderMeta(data)
      renderBloques(data)
      await cargarResumenRindes(articuloId)
      mostrarMensaje("", true)
      document.getElementById("patronActions").classList.add("visible")
    } catch (err) {
      console.error(err)
      document.getElementById("patronMeta").classList.remove("visible")
      const msg = err.status === 409
        ? err.message
        : "No se pudo cargar el patrón técnico."
      mostrarMensaje(msg)
    }
  }

  function renderMeta(data) {
    const a = data.articulo || {}
    const m = a.modelos || {}
    const f = data.ficha || {}
    const meta = document.getElementById("patronMeta")
    meta.innerHTML = `
      <div class="patron-meta-card"><small>Código</small><strong>${esc(a.codigo || "-")}</strong></div>
      <div class="patron-meta-card"><small>Artículo</small><strong>${esc(m.nombre || "-")} · ${esc(a.color || "-")}</strong></div>
      <div class="patron-meta-card"><small>Marca</small><strong>${esc(m.marca || "-")}</strong></div>
      <div class="patron-meta-card"><small>Ficha origen</small><strong>V${esc(f.version || "-")} · ${esc(f.estado || "-")}</strong></div>
      <div class="patron-meta-card"><small>Estado del patrón</small><strong class="patron-status">${data.patron_guardado ? "Guardado" : "Propuesta desde ficha"}</strong></div>
    `
    meta.classList.add("visible")
  }


  async function cargarMaterialesMaestro() {
    const d = await leerJson(await apiFetch("/api/maestro/materiales"))
    materialesMaestro = d.materiales || []
  }

  function materialInicial(item) {
    if (item.material_id) return String(item.material_id)
    const nombre = String(item.material || "").trim().toUpperCase()
    return String((materialesMaestro.find(m => String(m.nombre||"").trim().toUpperCase() === nombre) || {}).id || "")
  }

  function opcionesMaterial(item) {
    const actual = materialInicial(item)
    return '<option value="">Seleccionar material…</option>' +
      materialesMaestro.map(m => `<option value="${m.id}" ${String(m.id)===actual?"selected":""}>${esc(m.nombre)}${m.unidad_sugerida?" · "+esc(m.unidad_sugerida):""}</option>`).join("") +
      '<option value="__nuevo__">＋ Agregar material…</option>'
  }

  async function cambioMaterial(select) {
    if (select.value !== "__nuevo__") {
      const m=materialesMaestro.find(x=>String(x.id)===String(select.value))
      const fila=select.closest("tr")
      const um=fila?.querySelector(".patron-um")
      if(m?.unidad_sugerida && um) um.value=String(m.unidad_sugerida).toUpperCase()
      return
    }
    const nombre=prompt("Nombre del nuevo material:")
    if(!nombre){select.value=select.dataset.anterior||"";return}
    const unidad=(prompt("Unidad sugerida (M2, ML, PLANCHA, UNIDAD, PAR):","")||"").trim().toUpperCase()
    try{
      const d=await leerJson(await apiFetch("/api/maestro/materiales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nombre,unidad_sugerida:unidad})}))
      materialesMaestro.push(d.material)
      const id=String(d.material.id)
      const opt=document.createElement("option");opt.value=id;opt.textContent=d.material.nombre+(d.material.unidad_sugerida?" · "+d.material.unidad_sugerida:"")
      select.insertBefore(opt,select.lastElementChild);select.value=id;select.dataset.anterior=id
      const um=select.closest("tr")?.querySelector(".patron-um");if(unidad&&um)um.value=unidad
    }catch(err){alert(err.message||"No se pudo crear el material");select.value=select.dataset.anterior||""}
  }

  function opcionesUM(valor) {
    const valores = ["ML", "M2", "PLANCHA", "UNIDAD", "PAR"]
    const actual = String(valor || "").toUpperCase()
    if (actual && !valores.includes(actual)) valores.push(actual)
    return valores.map(v => `<option value="${esc(v)}" ${v === actual ? "selected" : ""}>${esc(v)}</option>`).join("")
  }

  function renderBloques(data) {
    const cont = document.getElementById("patronBloques")
    const excluirPatron = item => ["CAJA","CORDONES"].includes(String(item?.pieza || "").trim().toUpperCase())
    const bloques = (Array.isArray(data.bloques) ? data.bloques : []).map(b => ({...b, items:(b.items||[]).filter(i=>!excluirPatron(i))})).filter(b => b.items.length)
    if (!bloques.length) {
      cont.innerHTML = '<div class="patron-aviso">La Ficha vigente no tiene materiales para formar el patrón técnico.</div>'
      return
    }

    cont.innerHTML = bloques.map((bloque, bi) => `
      <div class="patron-bloque" data-bloque-index="${bi}">
        <div class="patron-bloque-head">
          <h3>Bloque técnico</h3>
          <input class="patron-bloque-input" value="${esc(bloque.bloque || "")}" aria-label="Nombre del bloque">
        </div>
        <table class="patron-tabla-v2">
          <thead><tr><th>Pieza</th><th>Material</th><th>Especificación / color</th><th>U.M.</th><th>Método de consumo</th><th>Resultado rinde</th></tr></thead>
          <tbody>
            ${(bloque.items || []).map((item, ii) => `
              <tr data-material-id="${item.ficha_material_id}" data-orden="${item.orden ?? ii + 1}">
                <td><strong>${esc(item.pieza || "-")}</strong>${item.sacabocado_id ? `<div class="patron-muted">Sacabocado #${esc(item.sacabocado_id)}</div>` : ""}</td>
                <td><select class="patron-material" data-anterior="${materialInicial(item)}" onchange="cambioMaterial(this)">${opcionesMaterial(item)}</select></td>
                <td>${esc(item.color || item.especificacion || "-")}</td>
                <td><select class="patron-um">${opcionesUM(item.um || item.unidad_ficha)}</select></td>
                <td><select class="patron-metodo"><option value="" ${!item.metodo_consumo ? "selected" : ""}>Clasificar…</option><option value="rinde" ${item.metodo_consumo === "rinde" ? "selected" : ""}>Rinde por talle</option><option value="directo" ${item.metodo_consumo === "directo" ? "selected" : ""}>Consumo directo</option></select></td>
                <td class="patron-rinde-resumen" data-rinde-material-id="${item.ficha_material_id}"><span class="patron-muted">${item.metodo_consumo === "rinde" ? "Cargando…" : "—"}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("")
  }

  async function cargarResumenRindes(articuloId) {
    const celdas = [...document.querySelectorAll(".patron-rinde-resumen")]
    if (!celdas.length) return
    try {
      const data = await leerJson(await apiFetch(`/api/rindes/v2/articulo/${articuloId}`))
      const porMaterial = new Map((data.lineas || []).map(l => [String(l.ficha_material_id), l]))
      celdas.forEach(td => {
        const linea = porMaterial.get(String(td.dataset.rindeMaterialId))
        if (!linea) { td.innerHTML = '<span class="patron-muted">—</span>'; return }
        const vigentes = (linea.rindes || []).filter(r => r.vigente !== false && Number(r.consumo_por_par) > 0)
        if (!vigentes.length) { td.innerHTML = '<span class="patron-rinde-falta">Sin rindes</span>'; return }
        td.innerHTML = `<div class="patron-rinde-chips">${vigentes.map(r => `<span class="patron-rinde-chip"><b>${esc(r.talle)}</b>: ${Number(r.consumo_por_par).toFixed(6)}</span>`).join("")}</div>`
      })
    } catch (err) {
      console.warn("No se pudo cargar el resumen de rindes del patrón", err)
      celdas.forEach(td => td.innerHTML = '<span class="patron-muted">No disponible</span>')
    }
  }

  function recolectarItems() {
    const items = []
    document.querySelectorAll(".patron-bloque").forEach(bloque => {
      const nombreBloque = bloque.querySelector(".patron-bloque-input")?.value?.trim() || "CORTE CAPELLADA"
      bloque.querySelectorAll("tbody tr[data-material-id]").forEach((fila, index) => {
        const pieza = fila.querySelector("td strong")?.textContent?.trim()?.toUpperCase()
        if (["CAJA","CORDONES"].includes(pieza)) return
        items.push({
          ficha_material_id: Number(fila.dataset.materialId),
          material_id: Number(fila.querySelector(".patron-material")?.value) || null,
          bloque: nombreBloque,
          um: fila.querySelector(".patron-um")?.value || "",
          metodo_consumo: fila.querySelector(".patron-metodo")?.value || null,
          orden: Number(fila.dataset.orden || index + 1)
        })
      })
    })
    return items
  }

  async function guardarPatron() {
    if (!articuloActualId) return alert("Seleccioná un artículo")
    const items = recolectarItems()
    if (!items.length) return alert("No hay materiales para guardar")

    try {
      const data = await leerJson(await apiFetch(`/api/patrones/v2/articulo/${articuloActualId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      }))
      alert(`Patrón técnico guardado · ${data.filas_guardadas} filas`)
      await cargarPatron(articuloActualId)
    } catch (err) {
      console.error(err)
      alert(err.message || "No se pudo guardar el patrón técnico")
    }
  }

  async function recargarPatron() {
    if (!articuloActualId) return
    await cargarPatron(articuloActualId)
  }


  function abrirCalculoTarea() {
    if (!articuloActualId || !patronActual?.patron_guardado) return alert("Guardá primero el Patrón Técnico.")
    const panel = document.getElementById("tareaPanel")
    panel.innerHTML = `
      <div class="tarea-modal" role="dialog" aria-modal="true" aria-labelledby="tareaTitulo">
        <div class="tarea-top"><div><h3 id="tareaTitulo" style="margin:0">Calcular patrón de tarea</h3><div class="patron-muted">Curva rápida de simulación · no crea Pedido ni guarda el resultado.</div></div><button type="button" onclick="cerrarCalculoTarea()">✕ Cerrar</button></div>
        <div class="tarea-grid-wrap"><table class="tarea-curva"><thead><tr id="tareaTallesHead"><th>Curva</th></tr></thead><tbody><tr id="tareaParesRow"><td>Pares</td></tr></tbody></table></div>
        <div class="tarea-btns"><button type="button" onclick="agregarBloqueTalles()">＋ 5 talles</button><button type="button" onclick="agregarTalleTarea()">＋ 1 talle</button><button type="button" onclick="calcularPatronTarea()">🧮 Calcular patrón</button></div>
        <div id="tareaResultado" class="tarea-resultado"></div>
      </div>`
    panel.classList.add("visible")
    ;["35","36","37","38","39","40"].forEach(t => agregarTalleTarea(t, ""))
  }

  function cerrarCalculoTarea(){const p=document.getElementById("tareaPanel");p.classList.remove("visible");p.innerHTML=""}

  function agregarTalleTarea(talle="",pares=""){
    const head=document.getElementById("tareaTallesHead"), row=document.getElementById("tareaParesRow"); if(!head||!row)return
    const key="t"+Date.now()+Math.random().toString(16).slice(2)
    const th=document.createElement("th"); th.dataset.key=key
    th.innerHTML=`<div class="talle-head"><input class="tarea-talle" value="${esc(talle)}" placeholder="Talle"><button type="button" title="Quitar talle">×</button></div>`
    const td=document.createElement("td"); td.dataset.key=key
    td.innerHTML=`<input class="tarea-pares" type="number" min="0" step="1" value="${esc(pares)}" placeholder="0">`
    th.querySelector("button").onclick=()=>{th.remove();td.remove()}
    head.appendChild(th); row.appendChild(td)
  }

  function agregarBloqueTalles(){
    const actuales=[...document.querySelectorAll("#tareaTallesHead .tarea-talle")].map(i=>Number(i.value)).filter(Number.isFinite)
    let inicio=actuales.length?Math.max(...actuales)+1:35
    for(let i=0;i<5;i++) agregarTalleTarea(String(inicio+i),"")
  }

  function curvaTarea(){
    const heads=[...document.querySelectorAll("#tareaTallesHead th[data-key]")]
    return heads.map(th=>{
      const td=document.querySelector(`#tareaParesRow td[data-key="${th.dataset.key}"]`)
      return {talle:th.querySelector(".tarea-talle").value.trim(),pares:Number(td?.querySelector(".tarea-pares")?.value)}
    }).filter(x=>x.talle&&x.pares>0)
  }

  async function calcularPatronTarea(){
    const curva=curvaTarea(), out=document.getElementById("tareaResultado")
    if(!curva.length)return alert("Ingresá al menos un talle y su cantidad de pares.")
    out.innerHTML='<div class="tarea-alerta">Calculando…</div>'
    try{
      const d=await leerJson(await apiFetch(`/api/rindes/v2/articulo/${articuloActualId}/calcular-tarea`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({curva})}))
      let aviso=d.faltantes?.length?`<div class="tarea-alerta"><strong>⚠️ Cálculo incompleto.</strong><br>${d.faltantes.map(x=>`Falta rinde: ${esc(x.pieza||"Pieza")} · ${esc(x.material||"Material")} · talle ${esc(x.talle)}`).join("<br>")}</div>`:'<div class="tarea-alerta"><strong>✓ Rindes completos para la curva ingresada.</strong></div>'
      const directos=(d.lineas||[]).filter(x=>x.metodo_consumo==="directo").length
      if(directos) aviso+=`<div class="tarea-alerta">${directos} línea(s) de consumo directo quedan identificadas pero todavía no calculadas en esta etapa.</div>`
      const visibles=(d.lineas||[]).filter(x=>!["CAJA","CORDONES"].includes(String(x.pieza||"").trim().toUpperCase()))
      const grupos={}
      visibles.forEach(x=>{const k=x.bloque||"SIN BLOQUE";(grupos[k]??=[]).push(x)})
      const curvaHtml=d.curva.map(x=>`<th>${esc(x.talle)}</th>`).join("")
      const paresHtml=d.curva.map(x=>`<td>${esc(x.pares)}</td>`).join("")
      const bloquesHtml=Object.entries(grupos).map(([bloque,lineas])=>`
        <section class="patron-print-bloque"><div class="patron-print-bloque-title">${esc(bloque)}</div>
        <table><thead><tr><th>Pieza</th><th>Materiales</th><th>Detalle / color</th><th>U.M.</th><th>T. Tarea</th></tr></thead><tbody>
        ${lineas.map(x=>`<tr><td><strong>${esc(x.pieza||"-")}</strong></td><td>${esc(x.material||"-")}</td><td>${esc(x.color||"-")}</td><td>${esc(x.um||"-")}</td><td class="tarea-total">${x.t_tarea==null?"—":Number(x.t_tarea).toFixed(4)}</td></tr>`).join("")}
        </tbody></table></section>`).join("")
      out.innerHTML=`<div class="patron-print-toolbar"><button type="button" onclick="imprimirPatronTarea()">🖨️ Imprimir patrón de tarea</button></div>
        <article id="patronTareaPrint" class="patron-print">
          <h2>PATRON DEL ARTICULO</h2>
          <div class="patron-print-identidad"><strong>${esc(patronActual?.articulo?.modelos?.nombre||"ARTÍCULO")} ${esc(patronActual?.articulo?.color||"")}</strong><span>Cod. Interno: ${esc(patronActual?.articulo?.codigo||"-")}</span><span>Marca: ${esc(patronActual?.articulo?.modelos?.marca||"-")}</span><span>Ficha: V${esc(d.ficha_version||"-")}</span></div>
          <table class="patron-print-curva"><thead><tr><th>Total</th>${curvaHtml}</tr></thead><tbody><tr><td><strong>${d.total_pares}</strong></td>${paresHtml}</tr></tbody></table>
          ${aviso}${bloquesHtml}
        </article>`
    }catch(err){out.innerHTML=`<div class="tarea-alerta">⚠️ ${esc(err.message)}</div>`}
  }

  window.initPatrones = initPatrones
  window.cambioMaterial = cambioMaterial
  window.guardarPatron = guardarPatron
  window.recargarPatron = recargarPatron
  window.abrirCalculoTarea = abrirCalculoTarea
  window.cerrarCalculoTarea = cerrarCalculoTarea
  window.agregarTalleTarea = agregarTalleTarea
  window.agregarBloqueTalles = agregarBloqueTalles
  function imprimirPatronTarea(){ window.print() }

  window.calcularPatronTarea = calcularPatronTarea
  window.imprimirPatronTarea = imprimirPatronTarea
})()