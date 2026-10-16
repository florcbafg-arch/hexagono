function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token")
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  }

  // FormData necesita que el navegador genere el Content-Type con su boundary.
  // Para JSON conservamos el comportamiento habitual.
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  return fetch(url, {
    ...options,
    headers
  })
  .then(res => {
    if (res.status === 401) {
      console.warn("🔒 Sesión expirada o token inválido")

      localStorage.clear()

      alert("Sesión expirada. Volvé a iniciar sesión.")

      window.location.href = "/login.html"

      return Promise.reject("Unauthorized")
    }

    return res
  })
}