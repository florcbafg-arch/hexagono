function checkAuth(rolRequerido = null){

  const token = localStorage.getItem("token")
  const user = JSON.parse(localStorage.getItem("hexagono_user") || "null")

  // 🔒 sin token → afuera
  if(!token){
    window.location.href = "login.html"
    return
  }

  // 🔒 sin user → afuera
  if(!user){
    window.location.href = "login.html"
    return
  }

  // 🔒 rol incorrecto → afuera
  if(rolRequerido && user.rol !== rolRequerido){
    alert("No tenés permisos para acceder acá")
    window.location.href = "login.html"
    return
  }

  console.log("🔐 Usuario autenticado:", user.nombre)

  return user
}