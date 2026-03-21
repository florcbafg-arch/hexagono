// verificar sesión
var usuario = JSON.parse(localStorage.getItem("hexagono_user"))

console.log("USUARIO STORAGE:", usuario)

// si no hay usuario → login
if(!usuario){
  window.location.href = "login.html"
}

// si no tiene rol → limpiar (caso bug)
if(!usuario.rol){
  localStorage.removeItem("hexagono_user")
  window.location.href = "login.html"
}

// proteger rutas
const pagina = window.location.pathname

// admin no puede entrar a operario
if(pagina.includes("operario") && usuario.rol !== "operario"){
  window.location.href = "admin.html"
}

// operario no puede entrar a admin
if(pagina.includes("admin") && usuario.rol !== "admin"){
  window.location.href = "operario.html"
}