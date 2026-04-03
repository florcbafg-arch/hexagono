if (!window.usuariosLoaded) {
  window.usuariosLoaded = true
  iniciarUsuarios()
}

function iniciarUsuarios() {
  const API_USUARIOS = "/api/usuarios"

  async function cargarUsuarios() {
    try {
      const res = await apiFetch(API_USUARIOS)
      const usuarios = await res.json()

      document.getElementById("totalUsuarios").textContent = Array.isArray(usuarios) ? usuarios.length : 0

      const tabla = document.getElementById("tablaUsuarios")
      if (!tabla) return

      tabla.innerHTML = ""

      if (!Array.isArray(usuarios)) return

      usuarios.forEach(u => {
        tabla.innerHTML += `
          <tr>
            <td>${u.nombre || "-"}</td>
            <td>${u.tipo_login || "-"}</td>
            <td>${u.rol || "-"}</td>
            <td>${u.acceso || "-"}</td>
            <td>${u.puesto || "-"}</td>
            <td>
              <button class="action-btn" onclick="editarUsuario(${u.id})">
                Editar
              </button>

              <button class="delete-btn" onclick="eliminarUsuario(${u.id})">
                Eliminar
              </button>
            </td>
          </tr>
        `
      })
    } catch (err) {
      console.error("Error cargando usuarios:", err)
    }
  }

  async function crearAdmin() {
    const nombre = document.getElementById("adminNombre")?.value.trim()
    const email = document.getElementById("adminEmail")?.value.trim()
    const password = document.getElementById("adminPassword")?.value.trim()
    const rol = document.getElementById("adminRol")?.value || "admin"
    const mensaje = document.getElementById("mensajeAdmin")

    if (!mensaje) return

    if (!nombre || !email || !password || !rol) {
      mensaje.style.color = "red"
      mensaje.textContent = "⚠ Complete todos los campos del admin"
      return
    }

    try {
      const res = await apiFetch("/api/usuarios/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Error creando admin")
      }

      mensaje.style.color = "green"
      mensaje.textContent = "✅ Admin creado correctamente"

      limpiarFormularioAdmin()
      cargarUsuarios()

    } catch (err) {
      console.error(err)
      mensaje.style.color = "red"
      mensaje.textContent = "❌ " + (err.message || "Error al crear admin")
    }

    setTimeout(() => {
      mensaje.textContent = ""
    }, 3000)
  }

  async function crearOperario() {
    const nombre = document.getElementById("operarioNombre")?.value.trim()
    const codigo_acceso = document.getElementById("operarioCodigo")?.value.trim()
    const pin = document.getElementById("operarioPin")?.value.trim()
    const puesto_id = document.getElementById("operarioPuesto")?.value
    const mensaje = document.getElementById("mensajeOperario")

    if (!mensaje) return

    if (!nombre || !codigo_acceso || !pin || !puesto_id) {
      mensaje.style.color = "red"
      mensaje.textContent = "⚠ Complete todos los campos del operario"
      return
    }

    try {
      const res = await apiFetch("/api/usuarios/operario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombre,
          codigo_acceso,
          pin,
          puesto_id
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Error creando operario")
      }

      mensaje.style.color = "green"
      mensaje.textContent = "✅ Operario creado correctamente"

      limpiarFormularioOperario()
      cargarUsuarios()

    } catch (err) {
      console.error(err)
      mensaje.style.color = "red"
      mensaje.textContent = "❌ " + (err.message || "Error al crear operario")
    }

    setTimeout(() => {
      mensaje.textContent = ""
    }, 3000)
  }

 async function cargarPuestos() {
  try {
    const res = await apiFetch("/api/puestos")
    const puestos = await res.json()

    const selectOperario = document.getElementById("operarioPuesto")

    if (!selectOperario) {
      console.warn("⚠️ No existe #operarioPuesto en el HTML")
      return
    }

    selectOperario.innerHTML = "<option value=''>Seleccionar puesto</option>"

    if (!Array.isArray(puestos)) return

    puestos.forEach(p => {
      const option = document.createElement("option")
      option.value = p.id
      option.textContent = p.nombre
      selectOperario.appendChild(option)
    })

  } catch (err) {
    console.error("Error cargando puestos", err)
  }
}

  function limpiarFormularioAdmin() {
    const adminNombre = document.getElementById("adminNombre")
    const adminEmail = document.getElementById("adminEmail")
    const adminPassword = document.getElementById("adminPassword")
    const adminRol = document.getElementById("adminRol")

    if (adminNombre) adminNombre.value = ""
    if (adminEmail) adminEmail.value = ""
    if (adminPassword) adminPassword.value = ""
    if (adminRol) adminRol.value = "admin"
  }

  function limpiarFormularioOperario() {
    const operarioNombre = document.getElementById("operarioNombre")
    const operarioCodigo = document.getElementById("operarioCodigo")
    const operarioPin = document.getElementById("operarioPin")
    const operarioPuesto = document.getElementById("operarioPuesto")

    if (operarioNombre) operarioNombre.value = ""
    if (operarioCodigo) operarioCodigo.value = ""
    if (operarioPin) operarioPin.value = ""
    if (operarioPuesto) operarioPuesto.value = ""
  }

  async function eliminarUsuario(id) {
    if (!confirm("Eliminar usuario?")) return

    try {
      await apiFetch(API_USUARIOS + "/" + id, {
        method: "DELETE"
      })

      cargarUsuarios()
    } catch (err) {
      console.error("Error eliminando usuario:", err)
    }
  }

  function editarUsuario(id) {
    alert("Edición de usuario próximamente")
  }

  window.crearAdmin = crearAdmin
  window.crearOperario = crearOperario
  window.eliminarUsuario = eliminarUsuario
  window.editarUsuario = editarUsuario
  window.initUsuarios = iniciarUsuarios

  cargarUsuarios()
  cargarPuestos()
}