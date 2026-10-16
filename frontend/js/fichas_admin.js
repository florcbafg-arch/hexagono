(() => {
let fichasV2 = []
let articulosV2 = []

const esc = (v="") => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

function mostrarMensaje(texto, error=false) {
  const el=document.getElementById("fichaV2Mensaje"); if(!el) return
  el.innerHTML = texto ? `<div style="padding:10px 12px;border-radius:8px;background:${error?'#4a1717':'#153c27'}">${esc(texto)}</div>` : ""
}

async function cargarFichasV2() {
  const res=await apiFetch("/api/fichas-v2")
  const data=await res.json()
  if(!res.ok||!data.ok) throw new Error(data.error||"No se pudieron cargar las fichas")
  fichasV2=Array.isArray(data.fichas)?data.fichas:[]
  renderFichasV2()
}

function renderFichasV2() {
  const tbody=document.getElementById("tablaFichasV2"); if(!tbody) return
  const q=(document.getElementById("buscarFichaV2")?.value||"").trim().toLowerCase()
  const estado=document.getElementById("filtroEstadoFichaV2")?.value||""
  const candidatas=fichasV2.filter(f=>{
    const a=f.articulos||{}, m=a.modelos||{}
    const hay=[a.codigo,a.color,m.nombre,m.marca].join(" ").toLowerCase().includes(q)
    return hay && (!estado||f.estado===estado)
  })
  const porArticulo=new Map()
  candidatas.forEach(f=>{
    const actual=porArticulo.get(String(f.articulo_id))
    const prioridad=x=>x.estado==="borrador"?3:x.estado==="vigente"?2:x.estado==="historica"?1:0
    if(!actual || prioridad(f)>prioridad(actual) || (prioridad(f)===prioridad(actual)&&Number(f.version)>Number(actual.version))) porArticulo.set(String(f.articulo_id),f)
  })
  const rows=[...porArticulo.values()]
  if(!rows.length){tbody.innerHTML='<tr><td colspan="7" style="padding:22px;text-align:center;color:#888;">Todavía no hay fichas V2 para mostrar.</td></tr>';return}
  tbody.innerHTML=rows.map(f=>{
    const a=f.articulos||{},m=a.modelos||{}
    const acciones=f.estado==="borrador"
      ? `<button onclick="editarFichaV2(${f.id})">✏ Editar</button> <button onclick="publicarFichaV2(${f.id})">✅ Publicar</button>`
      : (["vigente","historica"].includes(f.estado)?`<button onclick="nuevaVersionFichaV2(${f.id})">🧬 Nueva versión</button>`:"")
    return `<tr>
      <td style="padding:10px;"><strong>${esc(a.codigo||"-")}</strong><div style="font-size:12px;color:#888;">${esc(a.color||"-")}</div></td>
      <td>${esc(m.nombre||"-")}</td><td>${esc(m.marca||"-")}</td>
      <td>V${esc(f.version)}</td><td>${esc(f.estado)}</td><td>${esc(f.sistema_constructivo||"-")}</td>
      <td style="white-space:nowrap;">${acciones} <button onclick="verFichaV2(${f.id})">👁 Ver</button></td>
    </tr>`
  }).join("")
}

async function cargarArticulosV2(){
  const res=await apiFetch("/api/articulos")
  const data=await res.json()
  if(!res.ok) throw new Error(data.error||"No se pudieron cargar los artículos")
  articulosV2=Array.isArray(data)?data:(data.articulos||[])
}

async function abrirNuevaFichaV2(){
  try{
    if(!articulosV2.length) await cargarArticulosV2()
    const select=document.getElementById("articuloNuevaFichaV2")
    const usados=new Set(fichasV2.filter(f=>f.estado !== "archivada").map(f=>String(f.articulo_id)))
    const disponibles=articulosV2.filter(a=>a.activo!==false&&!usados.has(String(a.id)))
    select.innerHTML=disponibles.length
      ? disponibles.map(a=>`<option value="${a.id}">${esc(a.codigo)} · ${esc(a.marca||a.modelos?.marca||"")} · ${esc(a.modelo_nombre||a.modelos?.nombre||"")} · ${esc(a.color||"")}</option>`).join("")
      : '<option value="">No hay artículos activos sin ficha</option>'
    document.getElementById("modalNuevaFichaV2").style.display="flex"
  }catch(e){mostrarMensaje(e.message,true)}
}
function cerrarNuevaFichaV2(){document.getElementById("modalNuevaFichaV2").style.display="none"}

async function crearFichaV2(){
  const articulo_id=Number(document.getElementById("articuloNuevaFichaV2").value)
  const sistema_constructivo=document.getElementById("sistemaNuevaFichaV2").value
  if(!articulo_id) return mostrarMensaje("No hay un artículo disponible para crear la ficha.",true)
  try{
    const res=await apiFetch("/api/fichas-v2",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({articulo_id,sistema_constructivo})})
    const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.error||"No se pudo crear la ficha")
    cerrarNuevaFichaV2()
    window.location.href=`fichas_crear_admin.html?ficha_id=${data.ficha.id}`
  }catch(e){mostrarMensaje(e.message,true)}
}

function editarFichaV2(id){window.location.href=`fichas_crear_admin.html?ficha_id=${id}`}
function verFichaV2(id){window.location.href=`fichas_detalle_admin.html?ficha_id=${id}`}

async function publicarFichaV2(id){
  if(!confirm("¿Publicar esta versión? Una vez vigente quedará congelada.")) return
  try{
    const res=await apiFetch(`/api/fichas-v2/${id}/publicar`,{method:"POST"})
    const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.error||"No se pudo publicar")
    mostrarMensaje(data.message||"Ficha publicada"); await cargarFichasV2()
  }catch(e){mostrarMensaje(e.message,true)}
}

async function nuevaVersionFichaV2(id){
  if(!confirm("¿Crear una nueva versión en borrador copiando esta ficha?")) return
  try{
    const res=await apiFetch(`/api/fichas-v2/${id}/nueva-version`,{method:"POST"})
    const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.error||"No se pudo crear la versión")
    window.location.href=`fichas_crear_admin.html?ficha_id=${data.ficha.id}`
  }catch(e){mostrarMensaje(e.message,true)}
}

async function cargarLegacy(){
  try{
    const res=await apiFetch("/api/fichas"); const data=await res.json()
    const arr=Array.isArray(data)?data:[]
    const el=document.getElementById("legacyFichasResumen")
    if(el) el.textContent=`${arr.length} ficha(s) legacy preservada(s). No se modifican desde este módulo V2.`
  }catch(_){const el=document.getElementById("legacyFichasResumen");if(el)el.textContent="No se pudo consultar el resumen legacy."}
}

async function initFichas(){
  try{await Promise.all([cargarFichasV2(),cargarLegacy()])}catch(e){mostrarMensaje(e.message,true)}
}
window.initFichas=initFichas; window.renderFichasV2=renderFichasV2; window.abrirNuevaFichaV2=abrirNuevaFichaV2;
window.cerrarNuevaFichaV2=cerrarNuevaFichaV2; window.crearFichaV2=crearFichaV2; window.editarFichaV2=editarFichaV2;
window.verFichaV2=verFichaV2; window.publicarFichaV2=publicarFichaV2; window.nuevaVersionFichaV2=nuevaVersionFichaV2;
})()