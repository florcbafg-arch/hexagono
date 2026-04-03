function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token")

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
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