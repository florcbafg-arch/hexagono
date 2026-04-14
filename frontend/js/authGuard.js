// 🔥 VALIDAR SESIÓN REAL CONTRA BACKEND
async function validarSesionReal() {
  try {
    const userStorage = JSON.parse(localStorage.getItem("hexagono_user") || "null")

   if (userStorage?.tipo_login === "operario") {

  // ⏳ expiración simple (8 horas)
  const ahora = Date.now()
  const creado = userStorage?.login_time || 0

  const EXPIRACION = 1000 * 60 * 60 * 8 // 8 horas

  if (ahora - creado > EXPIRACION) {
    console.warn("⏳ Sesión operario expirada")
    localStorage.clear()
    window.location.href = "login.html"
    return null
  }

  return userStorage
}

    const res = await apiFetch("/api/auth/me")

    if (!res.ok) {
      throw new Error("Sesión inválida")
    }

    const user = await res.json()
    localStorage.setItem("hexagono_user", JSON.stringify(user))
    return user

  } catch (error) {
    console.warn("Error validando sesión:", error)
    localStorage.clear()
    window.location.href = "login.html"
    return null
  }
}


// 🔐 CHECK AUTH PRINCIPAL
async function checkAuth(rolRequerido = null) {
  const userStorage = JSON.parse(localStorage.getItem("hexagono_user") || "null")
  const token = localStorage.getItem("token")

  // ✅ caso operario: no exigir token, usar sesión local
  if (userStorage?.tipo_login === "operario") {
    const user = await validarSesionReal()
    if (!user) return

    if (rolRequerido && user.rol !== rolRequerido) {
      alert("No tenés permisos para acceder acá")
      window.location.href = "login.html"
      return
    }

    console.log("🔐 Usuario autenticado:", user.nombre)

    const nombreUsuario = document.getElementById("nombreUsuario")
    if (nombreUsuario) {
      nombreUsuario.textContent = user.nombre || "Usuario"
    }

    return user
  }

  // ✅ caso admin: sí exigir token
  if (!token) {
    window.location.href = "login.html"
    return
  }

  const user = await validarSesionReal()
  if (!user) return

  if (rolRequerido && user.rol !== rolRequerido) {
    alert("No tenés permisos para acceder acá")
    window.location.href = "login.html"
    return
  }

  console.log("🔐 Usuario autenticado:", user.nombre)

  const nombreUsuario = document.getElementById("nombreUsuario")
  if (nombreUsuario) {
    nombreUsuario.textContent = user.nombre || "Usuario"
  }

  return user
}

// 🔗 export global (para HTML)
window.checkAuth = checkAuth