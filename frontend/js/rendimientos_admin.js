(() => {
let articuloId=null, datos=null, sacabocados=[], materialesMaestro=[]
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
async function json(res){let d={};try{d=await res.json()}catch(_){}if(!res.ok)throw new Error(d.error||"Error");return d}
async function initRendimientos(){
  const sel=document.getElementById("rindeArticulo"); if(!sel)return
  try{
    const [arts,sacs,mats]=await Promise.all([json(await apiFetch("/api/articulos")),json(await apiFetch("/api/rindes/v2/sacabocados")),json(await apiFetch("/api/maestro/materiales"))])
    sacabocados=sacs.sacabocados||[]
    materialesMaestro=mats.materiales||[]
    ;(arts||[]).filter(a=>a.activo!==false).forEach(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=`${a.codigo} · ${a.modelos?.marca||"Sin marca"} · ${a.modelos?.nombre||"Sin modelo"} · ${a.color}`;sel.appendChild(o)})
    sel.onchange=()=>sel.value?cargar(sel.value):limpiar()
  }catch(e){mensaje("No se pudieron cargar los datos de Rendimientos.")}
}
function mensaje(t,hide=false){const e=document.getElementById("rindesMensaje");e.textContent=t;e.style.display=hide?"none":"block"}
function limpiar(){articuloId=null;datos=null;document.getElementById("rindesLineas").innerHTML="";mensaje("Seleccioná un artículo con Patrón Técnico guardado.")}
async function cargar(id){
  articuloId=String(id);document.getElementById("rindesLineas").innerHTML="";mensaje("Cargando rindes…")
  try{datos=await json(await apiFetch(`/api/rindes/v2/articulo/${id}`));render();mensaje("",true)}
  catch(e){mensaje(e.message||"No se pudieron cargar los rindes.")}
}
function opcionesSac(actual){
  return '<option value="">Seleccionar…</option>'+sacabocados.map(s=>`<option value="${s.id}" ${String(s.id)===String(actual||"")?"selected":""}>${esc(s.codigo||("#"+s.id))} · ${esc(s.pieza||"")}${s.subpieza?" · "+esc(s.subpieza):""}</option>`).join("")
}

function nombreMaterial(id){return (materialesMaestro.find(m=>String(m.id)===String(id))||{}).nombre||"—"}
function opcionesMaterial(actual){
  return '<option value="">Seleccionar material…</option>'+materialesMaestro.map(m=>`<option value="${m.id}" ${String(m.id)===String(actual||"")?"selected":""}>${esc(m.nombre)}${m.unidad_sugerida?" · "+esc(m.unidad_sugerida):""}</option>`).join("")+'<option value="__nuevo__">＋ Agregar material…</option>'
}
async function cambioMaterialRinde(select){
  if(select.value!=="__nuevo__"){
    const m=materialesMaestro.find(x=>String(x.id)===String(select.value)), f=select.closest(".rinde-form"), um=f?.querySelector(".f-unidad")
    if(m?.unidad_sugerida&&um)um.value=String(m.unidad_sugerida).toUpperCase()
    return
  }
  const nombre=prompt("Nombre del nuevo material:")
  if(!nombre){select.value=select.dataset.anterior||"";return}
  const unidad=(prompt("Unidad sugerida (M2, ML, PLANCHA, UNIDAD, PAR):","")||"").trim().toUpperCase()
  try{
    const d=await json(await apiFetch("/api/maestro/materiales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nombre,unidad_sugerida:unidad})}))
    materialesMaestro.push(d.material);const id=String(d.material.id)
    const o=document.createElement("option");o.value=id;o.textContent=d.material.nombre+(d.material.unidad_sugerida?" · "+d.material.unidad_sugerida:"")
    select.insertBefore(o,select.lastElementChild);select.value=id;select.dataset.anterior=id
    const um=select.closest(".rinde-form")?.querySelector(".f-unidad");if(unidad&&um)um.value=unidad
  }catch(e){alert(e.message||"No se pudo crear el material");select.value=select.dataset.anterior||""}
}

function filaRinde(r){
 return `<tr><td><strong>${esc(r.talle)}</strong></td><td>V${r.version}</td><td><span class="rinde-badge">${esc(r.estado)}</span></td><td>${esc(r.origen_medicion)}</td><td>${r.sacabocado_id?esc((sacabocados.find(s=>String(s.id)===String(r.sacabocado_id))||{}).codigo||("#"+r.sacabocado_id)):"—"}</td><td>${esc(nombreMaterial(r.material_id))}</td><td>${r.piezas_por_par??"—"}</td><td><strong>${r.consumo_por_par??"—"}</strong></td><td>${esc(r.material_unidad||"")}</td><td><button onclick="abrirRevision(${r.patron_id},${r.id})">Revisar</button></td></tr>`
}
function render(){
 const c=document.getElementById("rindesLineas")
 c.innerHTML=(datos.lineas||[]).map(l=>`
 <section class="rinde-linea" data-patron="${l.id}">
  <div class="rinde-linea-head"><div><h3>${esc(l.pieza||"Pieza")}</h3><div class="rinde-meta">${esc(l.bloque||"")} · U.M. patrón: ${esc(l.um||l.unidad_ficha||"—")}${l.color?" · "+esc(l.color):""}</div></div>
  <div class="rinde-tools"><button onclick="abrirNuevoRinde(${l.id})">＋ Rinde por talle</button><button onclick="verHistorial(${l.id})">Historial</button></div></div>
  <div>${l.rindes?.length?`<table class="rinde-tabla"><thead><tr><th>Talle</th><th>Versión</th><th>Estado</th><th>Origen</th><th>Sacabocado</th><th>Material</th><th>Piezas/par</th><th>Consumo/par</th><th>U.M.</th><th></th></tr></thead><tbody>${l.rindes.map(filaRinde).join("")}</tbody></table>`:'<div class="rindes-empty">Todavía no hay rindes cargados para esta línea.</div>'}</div>
  <div class="rinde-form" id="form-${l.id}"></div><div class="rinde-history" id="hist-${l.id}"></div>
 </section>`).join("")
}
function formHtml(l,r=null){
 const rev=!!r
 return `<h4>${rev?"Nueva revisión":"Nuevo rinde por talle"}</h4><div class="rinde-grid">
 <div class="rinde-field"><label>Talle</label><input class="f-talle" value="${esc(r?.talle||"")}" ${rev?"disabled":""} placeholder="Ej: 38"></div>
 <div class="rinde-field"><label>Estado</label><select class="f-estado"><option value="estimado">Estimado</option><option value="verificado">Verificado</option><option value="revisado">Revisado</option></select></div>
 <div class="rinde-field"><label>Origen</label><select class="f-origen"><option value="sacabocado">Sacabocado físico</option><option value="molde_provisorio">Molde provisorio</option><option value="otro">Otro</option></select></div>
 <div class="rinde-field"><label>Sacabocado</label><select class="f-sac">${opcionesSac(r?.sacabocado_id)}</select></div>
 <div class="rinde-field"><label>Material</label><select class="f-material" data-anterior="${esc(r?.material_id||l.material_id||"")}" onchange="cambioMaterialRinde(this)">${opcionesMaterial(r?.material_id||l.material_id)}</select></div>
 <div class="rinde-field"><label>Piezas por par</label><input class="f-piezas" type="number" step="0.0001" value="${r?.piezas_por_par??""}"></div>
 <div class="rinde-field"><label>U.M. consumo</label><input class="f-unidad" value="${esc(r?.material_unidad||l.um||l.unidad_ficha||"")}"></div>
 <div class="rinde-field"><label>Ancho estándar material</label><input class="f-mancho" type="number" step="0.000001" value="${r?.material_ancho??""}"></div>
 <div class="rinde-field"><label>Largo estándar material</label><input class="f-mlargo" type="number" step="0.000001" value="${r?.material_largo??""}"></div>
 <div class="rinde-field"><label>Ancho de la pieza / sacabocado</label><input class="f-cancho" type="number" step="0.000001" value="${r?.capacidad_ancho??""}" placeholder="Ej: 3.5"></div>
 <div class="rinde-field"><label>Largo de la pieza / sacabocado</label><input class="f-clargo" type="number" step="0.000001" value="${r?.capacidad_largo??""}" placeholder="Ej: 5.5"></div>
 <div class="rinde-field"><label>Ancho pieza/molde</label><input class="f-pancho" type="number" step="0.000001" value="${r?.pieza_ancho??""}"></div>
 <div class="rinde-field"><label>Largo pieza/molde</label><input class="f-plargo" type="number" step="0.000001" value="${r?.pieza_largo??""}"></div>
 <div class="rinde-field"><label>Piezas simuladas</label><input class="f-simuladas" type="number" step="0.000001" value="${r?.cantidad_piezas_simuladas??""}"></div>
 <div class="rinde-field"><label>Pares obtenidos</label><input class="f-pares" type="number" step="0.000001" value="${r?.pares_obtenidos??""}"></div>
 <div class="rinde-field"><label>Pares calculados</label><input class="f-parescalc" readonly></div>
 <div class="rinde-field"><label>Consumo por par</label><input class="f-consumo" type="number" step="0.00000001" value="${r?.consumo_por_par??""}" placeholder="Se calcula automáticamente"></div>
 </div><div class="rinde-actions"><button type="button" onclick="calcularRinde(${l.id})">🧮 Calcular rinde</button></div><div class="rinde-field" style="margin-top:10px"><label>Observaciones</label><textarea class="f-obs" rows="2">${esc(r?.observaciones||"")}</textarea></div>
 <div class="rinde-actions"><button onclick="cerrarForm(${l.id})">Cancelar</button><button onclick="guardarRinde(${l.id},${r?.id||"null"})">💾 ${rev?"Guardar revisión":"Guardar rinde"}</button></div>`
}
function linea(id){return (datos.lineas||[]).find(x=>Number(x.id)===Number(id))}
function abrirNuevoRinde(id){const f=document.getElementById("form-"+id);f.innerHTML=formHtml(linea(id));f.classList.add("visible")}
function abrirRevision(pid,rid){const l=linea(pid),r=(l.rindes||[]).find(x=>Number(x.id)===Number(rid));const f=document.getElementById("form-"+pid);f.innerHTML=formHtml(l,r);f.classList.add("visible");f.querySelector(".f-estado").value="revisado";f.querySelector(".f-origen").value=r.origen_medicion||"sacabocado"}
function cerrarForm(id){const f=document.getElementById("form-"+id);f.classList.remove("visible");f.innerHTML=""}
function val(f,cls){return f.querySelector(cls)?.value??""}
function calcularRinde(pid){
 const f=document.getElementById("form-"+pid)
 const a=Number(val(f,".f-cancho")), l=Number(val(f,".f-clargo")), p=Number(val(f,".f-piezas"))
 if(!(a>0&&l>0&&p>0)) return alert("Completá ancho, largo y piezas por par.")
 // Fórmula documentada por fábrica (PIZARRA_M2_V1):
 // ancho × largo / piezas_por_par × piezas_por_par = pares de referencia.
 // Se conservan ambos factores en la trazabilidad aunque matemáticamente se cancelen.
 const pares=(a*l/p)*p, consumo=1/pares
 f.querySelector(".f-parescalc").value=pares.toFixed(6)
 f.querySelector(".f-pares").value=pares.toFixed(6)
 f.querySelector(".f-consumo").value=consumo.toFixed(8)
}
async function guardarRinde(pid,rid){
 const f=document.getElementById("form-"+pid)
 const payload={talle:val(f,".f-talle"),estado:val(f,".f-estado"),origen_medicion:val(f,".f-origen"),sacabocado_id:val(f,".f-sac")||null,material_id:val(f,".f-material")||null,piezas_por_par:val(f,".f-piezas")||null,material_unidad:val(f,".f-unidad"),material_ancho:val(f,".f-mancho")||null,material_largo:val(f,".f-mlargo")||null,pieza_ancho:val(f,".f-pancho")||null,pieza_largo:val(f,".f-plargo")||null,capacidad_ancho:val(f,".f-cancho")||null,capacidad_largo:val(f,".f-clargo")||null,cantidad_piezas_simuladas:val(f,".f-simuladas")||null,pares_obtenidos:val(f,".f-pares")||null,consumo_por_par:val(f,".f-consumo")||null,metodo_calculo:(val(f,".f-cancho")&&val(f,".f-clargo")&&val(f,".f-piezas"))?"formula":"manual",formula_codigo:(val(f,".f-cancho")&&val(f,".f-clargo")&&val(f,".f-piezas"))?"PIZARRA_M2_V1":null,formula_version:(val(f,".f-cancho")&&val(f,".f-clargo")&&val(f,".f-piezas"))?1:null,parametros_calculo:{ancho_pieza:val(f,".f-cancho")||null,largo_pieza:val(f,".f-clargo")||null,piezas_por_par:val(f,".f-piezas")||null,formula_documentada:"ancho × largo ÷ piezas_por_par × piezas_por_par",unidad_resultado:val(f,".f-unidad")||null},observaciones:val(f,".f-obs")}
 try{
   const url=rid?`/api/rindes/v2/${rid}/revisar`:`/api/rindes/v2/patron/${pid}`
   await json(await apiFetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}))
   alert(rid?"Revisión guardada":"Rinde guardado");await cargar(articuloId)
 }catch(e){alert(e.message||"No se pudo guardar")}
}
async function verHistorial(pid){
 const h=document.getElementById("hist-"+pid)
 if(h.classList.contains("visible")){h.classList.remove("visible");return}
 try{
  const d=await json(await apiFetch(`/api/rindes/v2/patron/${pid}/historial`))
  h.innerHTML='<strong>Historial</strong>'+(d.rindes?.length?`<table class="rinde-tabla"><thead><tr><th>Talle</th><th>Versión</th><th>Estado</th><th>Vigente</th><th>Consumo/par</th><th>Fecha</th></tr></thead><tbody>${d.rindes.map(r=>`<tr><td>${esc(r.talle)}</td><td>V${r.version}</td><td>${esc(r.estado)}</td><td>${r.vigente?"Sí":"No"}</td><td>${r.consumo_por_par??"—"}</td><td>${r.created_at?new Date(r.created_at).toLocaleString():"—"}</td></tr>`).join("")}</tbody></table>`:'<div class="rindes-empty">Sin historial.</div>')
  h.classList.add("visible")
 }catch(e){alert(e.message)}
}
// La navegación con Enter ahora es global (js/enter_navigation.js).\nwindow.cambioMaterialRinde=cambioMaterialRinde
window.initRendimientos=initRendimientos;window.calcularRinde=calcularRinde;window.abrirNuevoRinde=abrirNuevoRinde;window.abrirRevision=abrirRevision;window.cerrarForm=cerrarForm;window.guardarRinde=guardarRinde;window.verHistorial=verHistorial
})()