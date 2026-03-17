var tareaActual = null

async function buscarTarea(){

const numero = document.getElementById("tarea").value

const res = await fetch("http://localhost:3000/tarea/"+numero)

if(res.status!=200){

document.getElementById("info").innerHTML=""
document.getElementById("tabla").innerHTML=""
return

}

const tarea = await res.json()

tareaActual = tarea

document.getElementById("info").innerHTML=
`
<h2>Tarea ${tarea.numero}</h2>

Marca: ${tarea.marca} |
Modelo: ${tarea.modelo} |
Cantidad: ${tarea.pares} pares
`

cargarProduccion(numero)

}

async function cargarProduccion(numero){

const res = await fetch("http://localhost:3000/api/produccion/tarea/"+numero)

const data = await res.json()

let html=`

<table class="tabla-produccion">

<tr>
<th>Sector</th>
<th>Producción</th>
</tr>
`
if(data.length === 0){

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

sectores.forEach((s,i)=>{

html+=`
<tr>
<td>${s}</td>
<td>
<input 
type="number"
class="prod-edit"
data-puesto="${i+1}"
value="0">
</td>
</tr>
`

})

}else{

data.forEach(p=>{

html+=`
<tr>
<td>Sector ${p.puesto_id}</td>
<td>
<input 
type="number"
class="prod-edit"
data-id="${p.id}"
data-puesto="${p.puesto_id}"
value="${p.cantidad}">
</td>
</tr>
`

})

}


html+=`</table>`

document.getElementById("tabla").innerHTML=html

document.getElementById("acciones").innerHTML=`
<button class="btn-guardar" onclick="guardarCambios()">
Guardar cambios
</button>
`

}

async function guardarCambios(){

const inputs=document.querySelectorAll(".prod-edit")

const registros=[]

inputs.forEach(i=>{

registros.push({
id: i.dataset.id || null,
tarea_id:tareaActual.id,
puesto_id:Number(i.dataset.puesto),
cantidad:Number(i.value)
})
})

await fetch("http://localhost:3000/api/produccion",{

method:"PUT",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(registros)

})

alert("Producción actualizada ✅")

buscarTarea()

}

document.getElementById("tarea").addEventListener("keydown",function(e){

if(e.key==="Enter"){
buscarTarea()
}

})

function volverMenu(){

window.location.href="admin.html"

}

function logout(){

localStorage.removeItem("hexagono_user")

window.location.href="login.html"

}
