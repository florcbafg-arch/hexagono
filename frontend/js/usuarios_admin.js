if(!window.usuariosLoaded){
  window.usuariosLoaded = true

  iniciarUsuarios()
}

function iniciarUsuarios(){

const API_USUARIOS = "/api/usuarios"

async function cargarUsuarios(){

const res = await apiFetch(API_USUARIOS)
const usuarios = await res.json()

document.getElementById("totalUsuarios").textContent = usuarios.length

const tabla = document.getElementById("tablaUsuarios")

tabla.innerHTML = ""


if(!Array.isArray(usuarios)) return

usuarios.forEach(u => {

tabla.innerHTML += `

<tr>

<td>${u.nombre}</td>

<td>${u.username}</td>


<td>${u.puesto || "-"}</td>

<td>

<button class="action-btn" onclick="editarUsuario(${u.id})">
Editar
</button>

<button class="delete-btn" onclick="eliminarUsuario(${u.id})">
Eliminar
</button>

</td>

</tr>

`

})

}

async function crearUsuario(){

const nombre = document.getElementById("nombre").value
const username = document.getElementById("username").value
const password = document.getElementById("password").value
const puesto_id = document.getElementById("puesto").value

const mensaje = document.getElementById("mensajeUsuario")

if(!nombre || !username || !password || !puesto_id){

mensaje.style.color="red"
mensaje.textContent="⚠ Complete todos los campos"

return
}

try{

const res = await apiFetch(API_USUARIOS,{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
nombre,
username,
password,
puesto_id
})

})

if(!res.ok){
throw new Error("error")
}

mensaje.style.color = "green"
mensaje.textContent = "✅ Usuario creado correctamente"

limpiarFormulario()
cargarUsuarios()

}catch(err){

mensaje.style.color = "red"
mensaje.textContent = "❌ Error al crear usuario"

}

setTimeout(()=>{
mensaje.textContent=""
},3000)

}


async function cargarPuestos(){

try{

const res = await apiFetch("/api/puestos")
const puestos = await res.json()

const select = document.getElementById("puesto")

select.innerHTML = "<option value=''>Seleccionar puesto</option>"

puestos.forEach(p=>{

const option = document.createElement("option")
option.value = p.id
option.textContent = p.nombre

select.appendChild(option)

})

}catch(err){

console.error("Error cargando puestos",err)

}

}



function limpiarFormulario(){

document.getElementById("nombre").value = ""
document.getElementById("username").value = ""
document.getElementById("password").value = ""
document.getElementById("puesto").value = ""

}



async function eliminarUsuario(id){

if(!confirm("Eliminar usuario?")) return

await apiFetch(API_USUARIOS + "/" + id,{
method:"DELETE"
})

cargarUsuarios()

}



function editarUsuario(id){

alert("Edición de usuario próximamente")

}

window.crearUsuario = crearUsuario
window.eliminarUsuario = eliminarUsuario
window.editarUsuario = editarUsuario

cargarUsuarios()
cargarPuestos()

}