// 🔥 VALIDAR SESIÓN REAL CONTRA BACKEND
async function validarSesionReal() {
  try {
    const res = await apiFetch("/api/auth/me")

    if (!res.ok) {
      throw new Error("Sesión inválida")
    }

    const user = await res.json()

    // 🔁 sincronizamos localStorage con backend
    localStorage.setItem("hexagono_user", JSON.stringify(user))

    return user

  } catch (error) {
    console.warn("Error validando sesión:", error)

    // 🧹 limpiamos sesión corrupta o vencida
    localStorage.clear()

    // 🔁 redirigimos al login
    window.location.href = "login.html"

    return null
  }
}


// 🔐 CHECK AUTH PRINCIPAL
async function checkAuth(rolRequerido = null){

  const token = localStorage.getItem("token")

  // ❌ sin token → afuera
  if(!token){
    window.location.href = "login.html"
    return
  }

  // 🔥 validamos sesión REAL contra backend
  const user = await validarSesionReal()
  if (!user) return

  // ❌ rol incorrecto → afuera
  if(rolRequerido && user.rol !== rolRequerido){
    alert("No tenés permisos para acceder acá")
    window.location.href = "login.html"
    return
  }

  console.log("🔐 Usuario autenticado:", user.nombre)

  // opcional: pintar nombre si existe elemento
  const nombreUsuario = document.getElementById("nombreUsuario")
  if (nombreUsuario) {
    nombreUsuario.textContent = user.nombre || "Usuario"
  }

  return user
}


// 🔗 export global (para HTML)
window.checkAuth = checkAuth