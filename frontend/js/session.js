function getUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario")) || {}
  } catch {
    return {}
  }
}