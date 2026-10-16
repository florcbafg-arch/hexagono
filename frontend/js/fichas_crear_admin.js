(() => {
const params=new URLSearchParams(location.search)
const fichaId=Number(params.get("ficha_id"))
const soloLectura=params.get("solo_lectura")==="1"
let ficha=null, articulo=null, secciones=[], sacabocados=[], activa=0

const BASE={
 vulcanizado:[
  ["SECCION N° 1","SACABOCADO",["CAÑA","CAPELLADA","CORDONERA","FORRO","FRANJA TALON","LENGUA SUPERIOR","LENGUA INFERIOR","PUNTERA","RELLENO DE CUELLO","RELLENO DE LENGUA","TALON/CORDONERA","TALON"]],
  ["SECCION N° 2","",["COSTURA FIGURADA","COSTURAS","ETIQ. DE LENGUA","GRIFA DE CAÑA EXT","INSTRUCTIVO LENGUA","PERFORACIONES","SERIGRAFIA ETIQ LENGUA","SERIGRAFIA GRIFA"]],
  ["SECCION N° 3","",["CAJA","CALCOMANIA","CORDONES","EMBALADO","ETIQ CAJA MADRE","ETIQ COMPOSICION","PLANTILLA","SERIGRAFIA PLANTILLA","SULFITO"]],
  ["SECCION N° 4","",["BANDA","BUMPER DELANTERO","HORMA","SUELIN","TAPA TRASERA"]],
  ["SECCION N° 5","",["NUM. HORMA","NUM. SACABOCADO","NUM. GOM","SACABOCADO","TRANSFER DE CAPELL."]],
  ["SECCION N° 6","SACABOCADO",["PLANTILLA DE STROBEL","REFUERZO CAÑA","REFUERZO CAPELLADA","REFUERZO CORDONERA","REFUERZO PUNTERA","REFUERZO TALON","RELLENO CAÑA"]]
 ],
 pegado:null
}
BASE.pegado=BASE.vulcanizado.map((s,i)=>i===3?["SECCION N° 4","",["BASE","HORMA","COSTURA"]]:[s[0],s[1],[...s[2]]])
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const val=(v="")=>esc(v)
function mensaje(t,e=false){const x=document.getElementById("mensajeFichaV2");x.innerHTML=t?`<div class="ficha-msg ${e?'error':''}">${esc(t)}</div>`:""}

function piezaNueva(nombre="",orden=1){return {nombre,tipo_pieza:"estructural",observacion:"",orden,sacabocado_id:null,materiales:[],operaciones:[]}}
function construirBase(sistema){
 secciones=BASE[sistema||"vulcanizado"].map((s,si)=>({nombre:s[0],titulo_impresion:s[1],tipo_seccion:"proceso",observaciones:"",orden:si+1,client_key:`s${si+1}`,piezas:s[2].map((n,i)=>piezaNueva(n,i+1))}))
}
function normalizarCargadas(xs){return xs.map((s,si)=>({...s,client_key:`s${si+1}`,piezas:(s.piezas||[]).map(p=>({...p,materiales:p.materiales||[],operaciones:p.operaciones||[]}))}))}

async function cargar(){
 if(!fichaId) throw new Error("Falta ficha_id")
 const [fr,sr]=await Promise.all([apiFetch(`/api/fichas-v2/id/${fichaId}`),apiFetch("/api/sacabocados")])
 const fd=await fr.json(), sd=await sr.json()
 if(!fr.ok||!fd.ok) throw new Error(fd.error||"No se pudo cargar la ficha")
 ficha=fd.ficha
 sacabocados=sr.ok&&sd.ok?(sd.sacabocados||[]):[]
 const ar=await apiFetch(`/api/fichas-v2/articulo/${ficha.articulo_id}`), ad=await ar.json()
 if(!ar.ok||!ad.ok) throw new Error(ad.error||"No se pudo cargar el artículo")
 articulo=ad.articulo
 secciones=ficha.secciones?.length?normalizarCargadas(ficha.secciones):[]
 if(!secciones.length) construirBase(ficha.sistema_constructivo||"vulcanizado")
 pintarCabecera(); render()
}
function pintarCabecera(){
 const m=articulo.modelos||{}
 document.getElementById("fCodigo").textContent=articulo.codigo||"-";document.getElementById("fModelo").textContent=m.nombre||"-"
 document.getElementById("fMarca").textContent=m.marca||"-";document.getElementById("fColor").textContent=articulo.color||"-"
 document.getElementById("fVersion").textContent=`V${ficha.version}`;document.getElementById("fSistema").value=ficha.sistema_constructivo||"vulcanizado"
 document.getElementById("fDetalle").value=ficha.detalle_general||"";document.getElementById("fObservaciones").value=ficha.observaciones_generales||""
 document.getElementById("estadoFichaV2").textContent=ficha.estado;document.getElementById("subtituloFichaV2").textContent=`${articulo.codigo} · ${m.marca||""} · ${m.nombre||""} · ${articulo.color||""}`
 const bloquear=soloLectura||ficha.estado!=="borrador";document.getElementById("btnGuardarFichaV2").style.display=bloquear?"none":""
 ;["fSistema","fDetalle","fObservaciones"].forEach(id=>document.getElementById(id).disabled=bloquear)
 document.getElementById("fSistema").onchange=()=>{if(!confirm("Cambiar el sistema reconstruirá la Sección 4. ¿Continuar?")){document.getElementById("fSistema").value=ficha.sistema_constructivo||"vulcanizado";return} const viejo=secciones;construirBase(document.getElementById("fSistema").value);[0,1,2,4,5].forEach(i=>{if(viejo[i])secciones[i]=viejo[i]});render()}
}
function puedeSaca(s){return s.nombre==="SECCION N° 1"||s.nombre==="SECCION N° 6"}
function optsSaca(id){return '<option value="">-- Sin sacabocado --</option>'+sacabocados.map(s=>`<option value="${s.id}" ${String(id||"")===String(s.id)?"selected":""}>${esc(s.codigo||"-")} · ${esc(s.material_base||"")}</option>`).join("")}
function render(){
 document.getElementById("listaSeccionesV2").innerHTML=secciones.map((s,i)=>`<button class="ficha-nav-btn ${i===activa?'activo':''}" onclick="irSeccionV2(${i})"><b>${i+1}</b><span>${esc(s.nombre)}</span></button>`).join("")
 const s=secciones[activa], ro=soloLectura||ficha.estado!=="borrador"
 document.getElementById("editorSeccionV2").innerHTML=`
  <div class="seccion-head"><div><h2>${esc(s.nombre)}</h2><small>${esc(s.titulo_impresion||"")}</small></div><span>Sección ${activa+1} de ${secciones.length}</span></div>
  <label>Observaciones de sección</label><textarea rows="2" ${ro?'disabled':''} oninput="updSec('observaciones',this.value)">${esc(s.observaciones||"")}</textarea>
  <div class="piezas-v2">${s.piezas.map((p,pi)=>renderPieza(p,pi,ro)).join("")}</div>
  ${ro?'':`<button onclick="agregarPiezaV2()">➕ Ítem extra</button>`}
  <div class="seccion-pager"><button onclick="irSeccionV2(${activa-1})" ${activa===0?'disabled':''}>⬅ Anterior</button><button onclick="irSeccionV2(${activa+1})" ${activa===secciones.length-1?'disabled':''}>Siguiente ➡</button></div>`
 renderPreview()
}
function renderPieza(p,pi,ro){
 return `<article class="pieza-v2">
 <div class="pieza-title"><input value="${val(p.nombre)}" ${ro?'disabled':''} oninput="updP(${pi},'nombre',this.value)"><span>Ítem ${pi+1}</span></div>
 <div class="pieza-grid">
  <div><label>Sacabocado</label><select ${ro||!puedeSaca(secciones[activa])?'disabled':''} onchange="updP(${pi},'sacabocado_id',this.value||null)">${optsSaca(p.sacabocado_id)}</select></div>
  <div><label>Observación</label><input value="${val(p.observacion||"")}" ${ro?'disabled':''} oninput="updP(${pi},'observacion',this.value)"></div>
 </div>
 <div class="subbloque"><div class="subtitulo"><b>Materiales</b>${ro?'':`<button onclick="addMat(${pi})">+ Material</button>`}</div>
 ${p.materiales.length?p.materiales.map((m,mi)=>`<div class="fila-tecnica"><input placeholder="Material" value="${val(m.material)}" ${ro?'disabled':''} oninput="updMat(${pi},${mi},'material',this.value)"><input placeholder="Especificación" value="${val(m.especificacion)}" ${ro?'disabled':''} oninput="updMat(${pi},${mi},'especificacion',this.value)"><input placeholder="Color" value="${val(m.color)}" ${ro?'disabled':''} oninput="updMat(${pi},${mi},'color',this.value)">${ro?'':`<button onclick="delMat(${pi},${mi})">×</button>`}</div>`).join(""):'<small>Sin materiales.</small>'}
 </div>
 <div class="subbloque"><div class="subtitulo"><b>Operaciones / instrucciones</b>${ro?'':`<button onclick="addOp(${pi})">+ Operación</button>`}</div>
 ${p.operaciones.length?p.operaciones.map((o,oi)=>`<div class="fila-tecnica"><input placeholder="Tipo (ej. COSTURA)" value="${val(o.tipo)}" ${ro?'disabled':''} oninput="updOp(${pi},${oi},'tipo',this.value)"><input placeholder="Detalle" value="${val(o.detalle)}" ${ro?'disabled':''} oninput="updOp(${pi},${oi},'detalle',this.value)"><input placeholder="Valor técnico" value="${val(o.valor_tecnico)}" ${ro?'disabled':''} oninput="updOp(${pi},${oi},'valor_tecnico',this.value)">${ro?'':`<button onclick="delOp(${pi},${oi})">×</button>`}</div>`).join(""):'<small>Sin operaciones.</small>'}
 </div></article>`
}
function renderPreview(){const s=secciones[activa];document.getElementById("previewFichaV2").innerHTML=`<b>${esc(s.nombre)}</b><div class="preview-list">${s.piezas.map(p=>{const mats=p.materiales.map(x=>x.material).filter(Boolean).join(" · ");const ops=p.operaciones.map(x=>[x.tipo,x.detalle,x.valor_tecnico].filter(Boolean).join(" ")).filter(Boolean).join(" · ");return `<div><strong>${esc(p.nombre)}</strong><span>${esc([mats,ops].filter(Boolean).join(" | ")||"Sin completar")}</span></div>`}).join("")}</div>`}
function updSec(k,v){secciones[activa][k]=v} function updP(i,k,v){secciones[activa].piezas[i][k]=v;renderPreview()}
function updMat(p,m,k,v){secciones[activa].piezas[p].materiales[m][k]=v;renderPreview()} function updOp(p,o,k,v){secciones[activa].piezas[p].operaciones[o][k]=v;renderPreview()}
function addMat(p){secciones[activa].piezas[p].materiales.push({material:"",especificacion:"",color:"",categoria:"materia_prima",unidad_medida:"",consumo:null,observacion:""});render()}
function delMat(p,m){secciones[activa].piezas[p].materiales.splice(m,1);render()} function addOp(p){secciones[activa].piezas[p].operaciones.push({tipo:"",detalle:"",valor_tecnico:"",observacion:""});render()}
function delOp(p,o){secciones[activa].piezas[p].operaciones.splice(o,1);render()} function agregarPieza(){secciones[activa].piezas.push(piezaNueva("",secciones[activa].piezas.length+1));render()}
function ir(i){if(i<0||i>=secciones.length)return;activa=i;render()}
async function guardar(){
 const btn=document.getElementById("btnGuardarFichaV2");btn.disabled=true;btn.textContent="Guardando…"
 try{
  let r=await apiFetch(`/api/fichas-v2/${ficha.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sistema_constructivo:document.getElementById("fSistema").value,detalle_general:document.getElementById("fDetalle").value,observaciones_generales:document.getElementById("fObservaciones").value})})
  let d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"No se pudo guardar cabecera")
  const payload={secciones:secciones.map((s,si)=>({...s,orden:si+1,client_key:`s${si+1}`,piezas:s.piezas.map((p,pi)=>({...p,orden:pi+1,materiales:p.materiales.map((m,mi)=>({...m,orden:mi+1})),operaciones:p.operaciones.map((o,oi)=>({...o,orden:oi+1}))}))})),imagenes:[]}
  r=await apiFetch(`/api/fichas-v2/${ficha.id}/estructura`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"No se pudo guardar estructura")
  mensaje("Borrador guardado correctamente.");ficha=d.ficha;secciones=normalizarCargadas(ficha.secciones||[]);render();setTimeout(()=>{location.href="admin.html?modulo=fichas"},450)
 }catch(e){mensaje(e.message,true)}finally{btn.disabled=false;btn.textContent="💾 Guardar borrador"}
}
async function init(){try{await cargar()}catch(e){mensaje(e.message,true)}}
window.irSeccionV2=ir;window.updSec=updSec;window.updP=updP;window.updMat=updMat;window.updOp=updOp;window.addMat=addMat;window.delMat=delMat;window.addOp=addOp;window.delOp=delOp;window.agregarPiezaV2=agregarPieza;window.guardarFichaV2=guardar;window.volverFichasV2=()=>location.href="admin.html?modulo=fichas";
window.addEventListener("DOMContentLoaded",()=>{
  const volver=document.getElementById("btnVolverFichaV2")
  if(volver) volver.addEventListener("click",()=>location.href="admin.html?modulo=fichas")
  const guardarBtn=document.getElementById("btnGuardarFichaV2")
  if(guardarBtn) guardarBtn.addEventListener("click",guardar)
  init()
})
})()