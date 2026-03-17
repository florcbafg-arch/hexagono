// verificar sesión

const usuario = JSON.parse(localStorage.getItem("hexagono_user"))

if(!usuario){
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