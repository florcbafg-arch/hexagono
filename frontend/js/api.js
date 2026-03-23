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
}

window.apiFetch = apiFetch