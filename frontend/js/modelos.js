const form = document.getElementById("formModelo")

form.addEventListener("submit", async (e)=>{

e.preventDefault()

const formData = new FormData()

formData.append("marca", document.getElementById("marca").value)
formData.append("codigo", document.getElementById("codigo").value)
formData.append("nombre", document.getElementById("nombre").value)
formData.append("descripcion", document.getElementById("descripcion").value)

const ficha = document.getElementById("ficha").files[0]
const imagen = document.getElementById("imagen").files[0]

if(ficha) formData.append("ficha", ficha)
if(imagen) formData.append("imagen", imagen)

const res = await fetch("/api/modelos",{
method:"POST",
body:formData
})

const data = await res.json()

alert(data.message)

form.reset()

cargarModelos()

})



async function cargarModelos(){

const res = await fetch("/api/modelos")

const modelos = await res.json()

const tabla = document.getElementById("tablaModelos")

tabla.innerHTML = ""

modelos.forEach(m=>{

tabla.innerHTML += `

<tr>

<td>${m.id}</td>
<td>${m.marca}</td>
<td>${m.codigo}</td>
<td>${m.nombre}</td>

<td>

${m.ficha_pdf ? `<a href="/uploads/${m.ficha_pdf}" target="_blank">Ver</a>` : "-"}

</td>

</tr>

`

})

}

cargarModelos()