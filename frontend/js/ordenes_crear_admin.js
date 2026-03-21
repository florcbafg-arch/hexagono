const modeloSelect = document.getElementById("modelo")
const form = document.getElementById("formTarea")

// cargar modelos
async function cargarModelos(){

const res = await apiFetch("/api/modelos")

const modelos = await res.json()

modelos.forEach(m=>{

const option = document.createElement("option")

option.value = m.id
option.textContent = m.nombre

modeloSelect.appendChild(option)

})

}

cargarModelos()

// calcular total pares

const inputsTalles = document.querySelectorAll("#talles input")

function calcularTotal(){

let total = 0

inputsTalles.forEach(input=>{

const val = parseInt(input.value)

if(!isNaN(val)){
total += val
}

})

document.getElementById("total").textContent = total

}

inputsTalles.forEach(input=>{
input.addEventListener("input", calcularTotal)
})


// crear tarea
form.addEventListener("submit", async (e)=>{

e.preventDefault()

const numero = document.getElementById("numero_tarea").value
const modelo = modeloSelect.value

const inputs = document.querySelectorAll("#talles input")

let talles = []

inputs.forEach(input=>{

const cantidad = parseInt(input.value)

if(cantidad>0){

talles.push({

talle: input.dataset.talle,
cantidad

})

}

})


const res = await apiFetch("/api/ordenes", {

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

numero,
modelo_id: modelo,
talles

})

})


const data = await res.json()

alert(data.mensaje)

})

// ==========================
// IMPRIMIR ORDEN
// ==========================

const botonPrint = document.getElementById("imprimirOrden")

botonPrint.addEventListener("click", imprimirOrden)

function imprimirOrden(){

const numero = document.getElementById("numero_tarea").value

const modelo = modeloSelect.options[modeloSelect.selectedIndex]?.text || ""

const inputs = document.querySelectorAll("#talles input")

let total = 0

const tabla = document.getElementById("printTalles")

tabla.innerHTML = ""

inputs.forEach(input=>{

const cantidad = parseInt(input.value)

if(!isNaN(cantidad) && cantidad>0){

total += cantidad

tabla.innerHTML += `
<tr>
<td>${input.dataset.talle}</td>
<td>${cantidad}</td>
</tr>
`

}

})

document.getElementById("printTarea").textContent = numero
document.getElementById("printModelo").textContent = modelo
document.getElementById("printTotal").textContent = total

const contenido = document.getElementById("ordenPrint").innerHTML

const ventana = window.open("", "", "width=800,height=600")

ventana.document.write(contenido)

ventana.print()

}

// ==========================
// ENTER → SIGUIENTE TALLE
// ==========================

const inputs = document.querySelectorAll("#talles input")

inputs.forEach((input,index)=>{

input.addEventListener("keydown",(e)=>{

if(e.key === "Enter"){

e.preventDefault()

const siguiente = inputs[index+1]

if(siguiente){
siguiente.focus()
}

}

})

})

