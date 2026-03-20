function checkAuth(rolRequerido = null){

  const user = JSON.parse(localStorage.getItem("hexagono_user"))

  if(!user){
    window.location.href = "login.html"
    return
  }

  if(rolRequerido && user.rol !== rolRequerido){
    alert("No tenés permisos para acceder acá")
    window.location.href = "login.html"
    return
  }

  return user
}