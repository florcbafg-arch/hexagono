if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const { supabase } = require("../config/supabase")
const multer = require("multer")
const bcrypt = require("bcryptjs")
const { authMiddleware } = require("../backend/middlewares/authMiddleware") // ✅ SOLO UNA VEZ

const fichasRoutes = require("../backend/routes/fichas");
const programacionRoutes = require("../backend/routes/programacion");
const authRoutes = require("../backend/routes/auth");
const sacabocadosRoutes = require("../backend/routes/sacabocados");
console.log("✅ sacabocadosRoutes importado en server.js")
const app = express();

app.use(express.static(path.join(__dirname, "../frontend")));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

let registrosProduccion = []

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


app.use("/api/auth", authRoutes);

app.use("/api/produccion", authMiddleware);
app.use("/api/dashboard", authMiddleware);
app.use("/api/ordenes", authMiddleware);
app.use("/api/tarea", authMiddleware);
app.use("/api/usuarios", authMiddleware);
app.use("/api/patrones", authMiddleware);
app.use("/api/sector", authMiddleware);
app.use("/api/objetivos", authMiddleware);
app.use("/api/modelos", authMiddleware);

app.use("/api/programacion", authMiddleware, programacionRoutes);

// ==========================
// LOGIN OPERARIO SIMPLE PARA CONSULTA
// ==========================
app.post("/api/operario/login-ficha", async (req, res) => {
  try {
    const { codigo_acceso, pin } = req.body

    if (!codigo_acceso || !pin) {
      return res.status(400).json({ error: "Faltan datos" })
    }

    const codigo = String(codigo_acceso).trim().toUpperCase()

    const { data: operario, error } = await supabase
      .from("usuarios")
      .select("id, nombre, rol, empresa_id, codigo_acceso, pin_hash, activo")
      .eq("codigo_acceso", codigo)
      .eq("rol", "operario")
      .eq("activo", true)
      .maybeSingle()

    if (error) throw error

    if (!operario) {
      return res.status(404).json({ error: "Operario no encontrado" })
    }

    const ok = await bcrypt.compare(pin, operario.pin_hash || "")
    if (!ok) {
      return res.status(401).json({ error: "PIN incorrecto" })
    }

    res.json({
      ok: true,
      operario: {
        id: operario.id,
        nombre: operario.nombre,
        rol: operario.rol,
        empresa_id: operario.empresa_id
      }
    })
  } catch (err) {
    console.error("Error login operario ficha:", err)
    res.status(500).json({ error: "Error login operario" })
  }
})

// ==========================
// FICHAS SOLO LECTURA OPERARIO
// ==========================
app.get("/api/fichas-operario", async (req, res) => {
  try {
    const empresaId = req.query.empresa_id

    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id requerido" })
    }

    const { data, error } = await supabase
      .from("fichas_tecnicas")
      .select(`
        id,
        modelo_id,
        codigo,
        nombre,
        marca,
        horma,
        temporada,
        detalle_general,
        observaciones_generales,
        imagen_modelo_url,
        modelos (
          id,
          nombre,
          marca,
          codigo,
          imagen,
          tipo_curva
        )
      `)
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false })

    if (error) throw error

    res.json(data || [])
  } catch (err) {
    console.error("Error en /api/fichas-operario:", err)
    res.status(500).json({ error: "Error cargando fichas operario" })
  }
})

app.get("/api/fichas-operario/:id", async (req, res) => {
  try {
    const fichaId = req.params.id
    const empresaId = req.query.empresa_id

    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id requerido" })
    }

    const { data: fichaBase, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("*")
      .eq("id", fichaId)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (fichaError) throw fichaError

    if (!fichaBase) {
      return res.status(404).json({ error: "Ficha no encontrada" })
    }

    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("*")
      .eq("ficha_id", fichaBase.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (secError) throw secError

    const seccionIds = (secciones || []).map(s => s.id)

    let piezas = []
    if (seccionIds.length) {
      const { data: piezasData, error: piezasError } = await supabase
        .from("fichas_piezas")
        .select("*")
        .in("seccion_id", seccionIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (piezasError) throw piezasError
      piezas = piezasData || []
    }

    const piezaIds = piezas.map(p => p.id)

    let materiales = []
    if (piezaIds.length) {
      const { data: materialesData, error: materialesError } = await supabase
        .from("fichas_materiales")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (materialesError) throw materialesError
      materiales = materialesData || []
    }

    let operaciones = []
    if (piezaIds.length) {
      const { data: operacionesData, error: operacionesError } = await supabase
        .from("fichas_operaciones")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (operacionesError) throw operacionesError
      operaciones = operacionesData || []
    }

    const { data: imagenes, error: imagenesError } = await supabase
      .from("fichas_imagenes")
      .select("*")
      .eq("ficha_id", fichaBase.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (imagenesError) throw imagenesError

    const ficha = {
      ...fichaBase,
      imagenes: imagenes || [],
      secciones: (secciones || []).map(seccion => {
        const piezasDeSeccion = piezas.filter(p => p.seccion_id === seccion.id)

        const piezasConDetalle = piezasDeSeccion.map(pieza => {
          const materialesDePieza = materiales.filter(m => m.pieza_id === pieza.id)
          const operacionesDePieza = operaciones.filter(o => o.pieza_id === pieza.id)

          return {
            ...pieza,
            materiales: materialesDePieza,
            operaciones: operacionesDePieza
          }
        })

        return {
          ...seccion,
          piezas: piezasConDetalle,
          materiales: piezasConDetalle.flatMap(p => p.materiales || []),
          operaciones: piezasConDetalle.flatMap(p => p.operaciones || []),
          imagenes: (imagenes || []).filter(img => img.seccion_id === seccion.id)
        }
      })
    }

    res.json(ficha)
  } catch (err) {
    console.error("Error en /api/fichas-operario/:id:", err)
    res.status(500).json({ error: "Error cargando detalle de ficha operario" })
  }
})

app.use("/api", authMiddleware, fichasRoutes);
console.log("✅ montando rutas sacabocados en /api")
app.use("/api", authMiddleware, sacabocadosRoutes);
app.get("/api/produccion/resumen", async (req, res) => {

const { data, error } = await supabase.rpc("produccion_resumen")

  if(error){
    return res.status(500).json({ error })
  }

  res.json(data)

})

// =======================
// CONFIGURAR SUBIDA ARCHIVOS
// =======================

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"))
  },

  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }

})

const upload = multer({ storage })


// =======================
// CREAR MODELO
// =======================

app.post(
  "/api/modelos",
  upload.fields([
    { name: "ficha" },
    { name: "imagen" }
  ]),
  async (req, res) => {

    try {

      const { marca, codigo, nombre, descripcion } = req.body

      const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

      let ficha = null
      let imagen = null

      if (req.files["ficha"]) {
        ficha = req.files["ficha"][0].filename
      }

      if (req.files["imagen"]) {
        imagen = req.files["imagen"][0].filename
      }

      const { error } = await supabase
        .from("modelos")
        .insert([
          {
            marca,
            codigo,
            nombre,
            descripcion,
            ficha_pdf: ficha,
            imagen,
            empresa_id: empresaId
          }
        ])

      if (error) throw error

      res.json({ message: "Modelo guardado correctamente" })

    } catch (err) {

      console.log(err)
      res.status(500).json({ message: "Error al guardar modelo" })

    }

  }
)


// 🔎 PROBAR CONEXION A SUPABASE
const probarConexion = async () => {

  const { data, error } = await supabase
    .from("puestos")
    .select("*")

  if (error) {
    console.log("❌ Error conexión:", error)
  } else {
    console.log("✅ Conectado a Supabase")
    console.log(data)
  }

}

probarConexion()


// 🟢 RUTA PRINCIPAL
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../frontend/login.html"))
})

// 📦 ordenes DE EJEMPLO
const ordenes= [

{
numero:"5556-1",
marca:"Amerika SB",
modelo:"Tora Azabache",
pares:120,
talles:[
{talle:39,plan:10},
{talle:40,plan:15},
{talle:41,plan:20},
{talle:42,plan:20},
{talle:43,plan:15},
{talle:44,plan:10}
]
},

{
numero:"5556-2",
marca:"Amerika SB",
modelo:"Tora Azabache",
pares:60,
talles:[
{talle:39,plan:5},
{talle:40,plan:10},
{talle:41,plan:10},
{talle:42,plan:15},
{talle:43,plan:10},
{talle:44,plan:10}
]
}

]


// 🔎 BUSCAR TAREA
app.get("/api/tarea/:numero", async (req, res) => {
  try {
    const numero = req.params.numero
    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data: orden, error: errorOrden } = await supabase
      .from("ordenes")
      .select(`
        id,
        numero_tarea,
        pares_plan,
        modelo_id,
        modelos (
          nombre,
          marca,
          codigo
        )
      `)
      .eq("numero_tarea", numero)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (errorOrden) throw errorOrden

    if (!orden) {
      return res.status(404).json({ error: "Tarea no encontrada" })
    }

    const { data: talles, error: errorTalles } = await supabase
      .from("orden_talles")
      .select("talle, cantidad")
      .eq("orden_id", orden.id)
      .eq("empresa_id", empresaId)
      .order("talle", { ascending: true })

    if (errorTalles) throw errorTalles

    res.json({
      id: orden.id,
      numero: orden.numero_tarea,
      marca: orden.modelos?.marca || "-",
      modelo: orden.modelos?.nombre || "-",
      pares: orden.pares_plan || 0,
      talles: (talles || []).map(t => ({
        talle: t.talle,
        plan: t.cantidad
      }))
    })
  } catch (err) {
    console.error("Error en /api/tarea/:numero:", err)
    res.status(500).json({ error: "Error servidor" })
  }
})

// 📊 GUARDAR PRODUCCION (MEMORIA LOCAL)
app.post("/api/produccion-local", (req, res) => {

  const registro = req.body

  registrosProduccion.push(registro)

  res.json({
    mensaje:"Produccion guardada",
    registro
  })

})


// 📊 VER REGISTROS
app.get("/api/registros", (req, res) => {

  res.json(registrosProduccion)

})

// ==========================
// VERIFICAR PRODUCCION EXISTENTE
// ==========================

app.get("/api/produccion/check/:numero", async (req, res) => {
  try {
    const numero = req.params.numero
    const puestoId = Number(req.query.puesto)
    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    if (!puestoId) {
      return res.json({
        registrado: false,
        habilitado: false,
        siguiente_sector: null
      })
    }

    // 1. Buscar orden
    const { data: tarea, error: errTarea } = await supabase
      .from("ordenes")
      .select("id, numero_tarea, estado")
      .eq("empresa_id", empresaId)
      .eq("numero_tarea", numero)
      .maybeSingle()

    if (errTarea) throw errTarea

    if (!tarea) {
      return res.json({
        registrado: false,
        habilitado: false,
        siguiente_sector: null
      })
    }

    // 2. Buscar puesto
    const { data: puesto, error: errPuesto } = await supabase
      .from("puestos")
      .select("id, nombre, sector_id, orden")
      .eq("id", puestoId)
      .maybeSingle()

    if (errPuesto) throw errPuesto

    if (!puesto || !puesto.sector_id) {
      return res.json({
        registrado: false,
        habilitado: false,
        siguiente_sector: null
      })
    }

    // 3. Verificar si ya registró ese puesto
    const { data: prodExistente, error: errProd } = await supabase
      .from("produccion")
      .select("id")
      .eq("orden_id", tarea.id)
      .eq("puesto_id", puestoId)
      .eq("empresa_id", empresaId)

    if (errProd) throw errProd

    const registrado = Array.isArray(prodExistente) && prodExistente.length > 0

    // 4. Traer recorrido de sectores
    const { data: recorrido, error: errRecorrido } = await supabase
      .from("ordenes_sector")
      .select(`
        id,
        sector_id,
        estado,
        sectores (
          id,
          nombre,
          orden
        )
      `)
      .eq("orden_id", tarea.id)
      .eq("empresa_id", empresaId)

    if (errRecorrido) throw errRecorrido

    const recorridoOrdenado = [...(recorrido || [])].sort((a, b) => {
      const ordenA = a?.sectores?.orden ?? 9999
      const ordenB = b?.sectores?.orden ?? 9999
      return ordenA - ordenB
    })

    const siguientePendiente = recorridoOrdenado.find(r => r.estado !== "completado")

    const habilitado =
      !!siguientePendiente &&
      Number(siguientePendiente.sector_id) === Number(puesto.sector_id)

    res.json({
      registrado,
      habilitado,
      siguiente_sector: siguientePendiente?.sectores?.nombre || null,
      orden_estado: tarea.estado || "pendiente"
    })
  } catch (err) {
    console.error("Error en /api/produccion/check/:numero:", err)
    res.json({
      registrado: false,
      habilitado: false,
      siguiente_sector: null
    })
  }
})
//🏭
app.post("/api/produccion", async (req, res) => {
  try {
    const { orden_id, puesto_id, cantidad } = req.body
    const usuario = req.user
    const empresaId = usuario?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    if (!orden_id || !puesto_id || !cantidad) {
      return res.status(400).json({
        error: "Datos incompletos"
      })
    }

    if (Number(cantidad) <= 0) {
      return res.status(400).json({
        error: "Cantidad inválida"
      })
    }

    // 1. Validar orden
    const { data: orden, error: errorOrden } = await supabase
      .from("ordenes")
      .select("id, numero_tarea, estado")
      .eq("id", orden_id)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (errorOrden) throw errorOrden

    if (!orden) {
      return res.status(404).json({
        error: "Orden no encontrada"
      })
    }

    // 2. Validar puesto y obtener su sector
    const { data: puesto, error: errorPuesto } = await supabase
      .from("puestos")
      .select("id, nombre, sector_id, orden")
      .eq("id", puesto_id)
      .maybeSingle()

    if (errorPuesto) throw errorPuesto

    if (!puesto) {
      return res.status(404).json({
        error: "Puesto no encontrado"
      })
    }

    if (!puesto.sector_id) {
      return res.status(400).json({
        error: "El puesto no tiene sector asignado"
      })
    }

    // 3. Verificar si ya existe producción en ese mismo puesto para esta orden
    const { data: existente, error: errorExistente } = await supabase
      .from("produccion")
      .select("id")
      .eq("orden_id", orden_id)
      .eq("puesto_id", puesto_id)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (errorExistente) throw errorExistente

    if (existente) {
      return res.status(400).json({
        error: "Esta tarea ya tiene producción registrada en este sector"
      })
    }

    // 4. Traer recorrido de sectores de la orden
    const { data: recorrido, error: errorRecorrido } = await supabase
      .from("ordenes_sector")
      .select(`
        id,
        sector_id,
        estado,
        sectores (
          id,
          nombre,
          orden
        )
      `)
      .eq("orden_id", orden_id)
      .eq("empresa_id", empresaId)

    if (errorRecorrido) throw errorRecorrido

    if (!Array.isArray(recorrido) || recorrido.length === 0) {
      return res.status(400).json({
        error: "La orden no tiene recorrido de sectores definido"
      })
    }

    const recorridoOrdenado = [...recorrido].sort((a, b) => {
      const ordenA = a?.sectores?.orden ?? 9999
      const ordenB = b?.sectores?.orden ?? 9999
      return ordenA - ordenB
    })

    const siguientePendiente = recorridoOrdenado.find(r => r.estado !== "completado")

    if (!siguientePendiente) {
      return res.status(400).json({
        error: "La orden ya completó todo su recorrido"
      })
    }

    // 5. Validar cadena: el puesto actual debe pertenecer al siguiente sector habilitado
    if (Number(siguientePendiente.sector_id) !== Number(puesto.sector_id)) {
      return res.status(400).json({
        error: `Esta tarea todavía no está habilitada para este sector. Primero debe registrar ${siguientePendiente?.sectores?.nombre || "el sector anterior"}.`
      })
    }

    // 6. Guardar producción
    const { data, error } = await supabase
      .from("produccion")
      .insert([
        {
          orden_id,
          puesto_id,
          cantidad: Number(cantidad),
          usuario: usuario?.nombre || "sistema",
          empresa_id: empresaId
        }
      ])
      .select()

    if (error) {
      console.log("❌ Error guardando producción:", error)
      return res.status(500).json({
        error: error.message
      })
    }

    // 7. Marcar sector actual como completado
    const { error: errorActualizarSector } = await supabase
      .from("ordenes_sector")
      .update({ estado: "completado" })
      .eq("id", siguientePendiente.id)
      .eq("empresa_id", empresaId)

    if (errorActualizarSector) throw errorActualizarSector

    // 8. Verificar si quedan sectores pendientes
    const { data: pendientesPost, error: errorPendientesPost } = await supabase
      .from("ordenes_sector")
      .select("id, estado")
      .eq("orden_id", orden_id)
      .eq("empresa_id", empresaId)
      .neq("estado", "completado")

    if (errorPendientesPost) throw errorPendientesPost

    const estadoFinalOrden =
      Array.isArray(pendientesPost) && pendientesPost.length === 0
        ? "terminada"
        : "en_proceso"

    const { error: errorActualizarOrden } = await supabase
      .from("ordenes")
      .update({ estado: estadoFinalOrden })
      .eq("id", orden_id)
      .eq("empresa_id", empresaId)

    if (errorActualizarOrden) throw errorActualizarOrden

    res.json({
      mensaje: "Producción guardada",
      data,
      estado_orden: estadoFinalOrden
    })
  } catch (err) {
    console.error("💥 Error en POST /api/produccion:", err)
    res.status(500).json({
      error: err.message || "Error guardando producción"
    })
  }
})
// ============================
// CREAR ADMIN (NUEVO SISTEMA)
// ============================
app.post("/api/usuarios/admin", async (req,res)=>{
  try{

    const { nombre, email, password, rol } = req.body

    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        error: "Faltan datos obligatorios"
      })
    }

    const emailLimpio = email.trim().toLowerCase()
    const nombreLimpio = nombre.trim()

    // 1. crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailLimpio,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error("❌ Error creando usuario en Auth:", authError)
      return res.status(400).json({
        error: authError.message
      })
    }

    const authUser = authData?.user

    if (!authUser?.id) {
      return res.status(500).json({
        error: "No se pudo obtener auth_id del usuario creado"
      })
    }

    // 2. guardar perfil en tabla usuarios
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{
        nombre: nombreLimpio,
        email: emailLimpio,
        auth_id: authUser.id,
        rol,
        activo: true,
        empresa_id: empresaId,
        tipo_login: "admin"
      }])
      .select()
      .single()

    if (error) {
      console.error("❌ Error guardando usuario en tabla usuarios:", error)

      // rollback básico: borrar usuario auth si falló tabla usuarios
      await supabase.auth.admin.deleteUser(authUser.id)

      return res.status(500).json({
        error: error.message
      })
    }

    res.json({
      mensaje: "Admin creado correctamente",
      usuario: data
    })

  }catch(err){

    console.error("❌ Error creando admin:", err)

    res.status(500).json({
      error: "Error creando admin"
    })

  }
})

// ============================
// CREAR OPERARIO
// ============================
app.post("/api/usuarios/operario", async (req,res)=>{
  try{

    const { nombre, codigo_acceso, pin, puesto_id } = req.body

    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    if (!nombre || !codigo_acceso || !pin || !puesto_id) {
      return res.status(400).json({
        error: "Faltan datos obligatorios"
      })
    }

    const codigoLimpio = codigo_acceso.trim().toUpperCase()
    const nombreLimpio = nombre.trim()

    const { data: existe, error: errorExiste } = await supabase
      .from("usuarios")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("codigo_acceso", codigoLimpio)
      .maybeSingle()

    if (errorExiste) {
      return res.status(500).json({ error: errorExiste.message })
    }

    if (existe) {
      return res.status(400).json({
        error: "Ya existe un operario con ese código"
      })
    }

    const pin_hash = await bcrypt.hash(pin, 10)

    const { data, error } = await supabase
      .from("usuarios")
      .insert([{
        nombre: nombreLimpio,
        codigo_acceso: codigoLimpio,
        pin_hash,
        puesto_id,
        rol: "operario",
        activo: true,
        empresa_id: empresaId,
        tipo_login: "operario"
      }])
      .select()
      .single()

    if (error) {
      console.error("❌ Error guardando operario:", error)
      return res.status(500).json({
        error: error.message
      })
    }

    res.json({
      mensaje: "Operario creado correctamente",
      usuario: data
    })

  }catch(err){

    console.error("❌ Error creando operario:", err)

    res.status(500).json({
      error: "Error creando operario"
    })

  }
})

// ===============
// API DASHBOARD 
// ===============

app.get("/api/dashboard", async (req,res)=>{

try{

const hoy = new Date().toISOString().slice(0,10)

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

// obtener produccion con sector
const { data:produccion, error:errProd } = await supabase
.from("produccion")
.select(`
cantidad,
puestos(
sector_id,
sectores(nombre)
)
`)
.eq("empresa_id", empresaId)

if(errProd) throw errProd

// obtener objetivos del dia
const { data:objetivos, error:errObj } = await supabase
.from("objetivos_sector")
.select(`
objetivo,
sectores(nombre)
`)
.eq("fecha",hoy)
.eq("empresa_id", empresaId)

if(errObj) throw errObj

// agrupar produccion por sector
const sectores = {}

produccion.forEach(p=>{

const nombre = p.puestos?.sectores?.nombre
if(!nombre) return

if(!sectores[nombre]){

sectores[nombre] = {
nombre,
produccion:0,
objetivo:0
}

}

sectores[nombre].produccion += p.cantidad || 0

})

// agregar objetivos
objetivos.forEach(o=>{

const nombre = o.sectores.nombre

if(!sectores[nombre]){

sectores[nombre] = {
nombre,
produccion:0,
objetivo:o.objetivo
}

}else{

sectores[nombre].objetivo = o.objetivo

}

})

res.json(Object.values(sectores))

}catch(err){

console.error("Error dashboard:",err)

res.status(500).json({
error:"error dashboard"
})

}

})

app.get("/api/dashboard/ordenes", async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data: ordenes, error: errorOrdenes } = await supabase
      .from("ordenes")
      .select(`
        id,
        numero_tarea,
        pares_plan,
        estado,
        modelo_id,
        modelos (
          nombre,
          marca,
          codigo
        )
      `)
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false })

    if (errorOrdenes) throw errorOrdenes

    if (!ordenes || ordenes.length === 0) {
      return res.json([])
    }

    const ordenIds = ordenes.map(o => o.id)

    const { data: recorrido, error: errorRecorrido } = await supabase
      .from("ordenes_sector")
      .select(`
        id,
        orden_id,
        estado,
        sector_id,
        sectores (
          id,
          nombre,
          orden
        )
      `)
      .in("orden_id", ordenIds)
      .eq("empresa_id", empresaId)

    if (errorRecorrido) throw errorRecorrido

    const recorridoPorOrden = {}

    ;(recorrido || []).forEach(r => {
      if (!recorridoPorOrden[r.orden_id]) {
        recorridoPorOrden[r.orden_id] = []
      }
      recorridoPorOrden[r.orden_id].push(r)
    })

    const resultado = ordenes.map(orden => {
      const pasos = (recorridoPorOrden[orden.id] || []).sort((a, b) => {
        const ordenA = a?.sectores?.orden ?? 9999
        const ordenB = b?.sectores?.orden ?? 9999
        return ordenA - ordenB
      })

      const completados = pasos.filter(p => p.estado === "completado")
      const pendientes = pasos.filter(p => p.estado !== "completado")

      const ultimoCompletado =
        completados.length > 0
          ? completados[completados.length - 1]?.sectores?.nombre || "-"
          : "-"

      const sectorActual =
        pendientes.length > 0
          ? pendientes[0]?.sectores?.nombre || "-"
          : "Finalizada"

      return {
        id: orden.id,
        numero: orden.numero_tarea,
        modelo: orden.modelos?.nombre || "-",
        marca: orden.modelos?.marca || "-",
        pares: orden.pares_plan || 0,
        estado: orden.estado || "pendiente",
        ultimo_sector: ultimoCompletado,
        sector_actual: sectorActual
      }
    })

    res.json(resultado)
  } catch (err) {
    console.error("Error en /api/dashboard/ordenes:", err)
    res.status(500).json({ error: "error dashboard ordenes" })
  }
})

// =======================
// LISTAR MODELOS
// =======================

app.get("/api/modelos", async (req, res) => {

  const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

  const { data, error } = await supabase
    .from("modelos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("id", { ascending: false })

  if (error) {
    console.log(error)
    return res.status(500).json(error)
  }

  res.json(data)

})

// ==========================
// modelos y curvas
// ==========================

app.get("/api/modelos/:id/curva", async (req, res) => {
  try {

    const modeloId = req.params.id

    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data: modelo, error: errorModelo } = await supabase
      .from("modelos")
      .select("id, nombre, marca, tipo_curva")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (errorModelo) throw errorModelo

    if (!modelo) {
      return res.status(404).json({ error: "Modelo no encontrado" })
    }

    if (!modelo.marca || !modelo.tipo_curva) {
      return res.json([])
    }

    const { data, error } = await supabase
      .from("curvas_talles")
      .select("talle, porcentaje, pares")
      .eq("marca", modelo.marca)
      .eq("tipo_curva", modelo.tipo_curva)
      .eq("empresa_id", empresaId)
      .order("talle", { ascending: true })

    if (error) throw error

    console.log("MODELO CURVA:", modelo)
    console.log("CURVA RECIBIDA:", data)

    res.json(data)

  } catch (err) {
    console.error("Error obteniendo curva:", err)
    res.status(500).json({ error: "Error obteniendo curva" })
  }
})

// ==========================
// CREAR TAREA (ORDEN PRODUCCION)
// ==========================

app.post("/api/ordenes", async (req, res) => {
  
  try {
    console.log("BODY ORDEN:", req.body)

    const { numero, modelo_id, total_pares, talles, usuario_id } = req.body

    const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

    if (!numero || !numero.trim()) {
      return res.status(400).json({ mensaje: "Falta número de tarea" })
    }

    if (!modelo_id) {
      return res.status(400).json({ mensaje: "Falta modelo" })
    }

    if (!total_pares || Number(total_pares) <= 0) {
      return res.status(400).json({ mensaje: "Total de pares inválido" })
    }

    if (!Array.isArray(talles) || talles.length === 0) {
      return res.status(400).json({ mensaje: "No hay talles calculados" })
    }

    if (!usuario_id) {
  return res.status(400).json({ mensaje: "Falta usuario_id" })
}

console.log("usuario_id recibido:", usuario_id)

const { data: usuarioDb, error: errorUsuario } = await supabase
  .from("usuarios")
  .select("empresa_id")
  .eq("id", usuario_id)
  .single()

if (errorUsuario) {
  return res.status(400).json({ mensaje: "No se pudo obtener empresa_id del usuario" })
}

    const { data: existente, error: errorExistente } = await supabase
      .from("ordenes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("numero_tarea", numero)
      .maybeSingle()

    if (errorExistente) throw errorExistente

    if (existente) {
      return res.status(400).json({ mensaje: "Ya existe una orden con ese número de tarea" })
    }

console.log("Insertando orden...")

    const { data: tarea, error: errorTarea } = await supabase
  .from("ordenes")
  .insert([{
    numero_tarea: numero,
    modelo_id: modelo_id,
    pares_plan: Number(total_pares),
    estado: "pendiente",
    fecha: new Date().toISOString(),
    prioridad: "media",
    empresa_id: empresaId
  }])
      .select()
      .single()

    if (errorTarea) throw errorTarea

const { data: sectores, error: errorSectores } = await supabase
  .from("sectores")
  .select("id, nombre, orden")
  .eq("empresa_id", empresaId)
  .order("orden", { ascending: true })

if (errorSectores) throw errorSectores

if (sectores && sectores.length > 0) {
  const sectoresInsert = sectores.map(s => ({
    orden_id: tarea.id,
    sector_id: s.id,
    estado: "pendiente",
    empresa_id: empresaId
  }))

  console.log("Insertando sectores ordenados...", sectoresInsert)

  const { error: errorInsertSectores } = await supabase
    .from("ordenes_sector")
    .insert(sectoresInsert)

  if (errorInsertSectores) throw errorInsertSectores
}

    const tallesInsert = talles
  .filter(t => Number(t.cantidad) > 0)
  .map(t => ({
    orden_id: tarea.id,
    talle: Number(t.talle),
    cantidad: Number(t.cantidad),
    empresa_id: empresaId
  }))

if (tallesInsert.length === 0) {
  return res.status(400).json({ mensaje: "No hay talles válidos para guardar" })
}

console.log("Insertando talles...", tallesInsert)

const { data: dataTalles, error: errorTalles } = await supabase
  .from("orden_talles")
  .insert(tallesInsert)
  .select()

console.log("resultado insert talles:", dataTalles)
console.log("error insert talles:", errorTalles)

if (errorTalles) throw errorTalles

    res.json({
      mensaje: "Orden creada correctamente"
    })

  } catch (err) {
    console.error("ERROR CREANDO TAREA:", err)

    res.status(500).json({
      mensaje: "Error creando tarea",
      detalle: err.message,
      full: err
    })
  }
})

// ==========================
// LISTAR ORDENES
// ==========================

app.get("/api/ordenes", async (req,res)=>{

try{

  const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

const { data, error } = await supabase
.from("ordenes")
.select(`
id,
numero_tarea,
pares_plan,
estado,
fecha_entrega,
prioridad,
modelos(nombre, marca, codigo)
`)
.eq("empresa_id", empresaId)
.order("id",{ascending:false})

if(error) throw error

const resultado = data.map(o => ({
id: o.id,
numero: o.numero_tarea,
modelo: o.modelos?.nombre || "-",
pares: o.pares_plan,
estado: o.estado || "pendiente",
fecha: o.fecha || o.fecha_entrega || "-",
prioridad: o.prioridad || "normal"
}))

res.json(resultado)

}catch(err){

console.error(err)
res.status(500).json({error:"error ordenes"})

}

})

// ==========================
// VER UNA ORDEN
// ==========================
app.get("/api/ordenes/:id", async (req, res) => {
  try {
    const id = req.params.id

    const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

    // 1. traer orden
    const { data: orden, error: errorOrden } = await supabase
     .from("ordenes")
.select(`
  *,
  modelos (
    nombre,
    marca,
    codigo
  )
`)
.eq("id", id)
.eq("empresa_id", empresaId)
.maybeSingle()


    if (errorOrden) {
      console.error("❌ error orden:", errorOrden)
      return res.status(500).json({ error: errorOrden.message })
    }

    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" })
    }

console.log("🔎 ORDEN CARGADA", {
  id: orden.id,
  numero_tarea: orden.numero_tarea,
  modelo_id: orden.modelo_id,
  empresa_id: empresaId,
  modelo_relacion: orden.modelos
})

    // 2. traer talles
    let talles = []

    const { data: tallesData, error: errorTalles } = await supabase
      .from("orden_talles")
      .select("talle, cantidad")
      .eq("orden_id", id)
      .eq("empresa_id", empresaId)
      .order("talle", { ascending: true })

    if (!errorTalles) {
      talles = tallesData || []
    } else {
      console.warn("⚠️ no se pudieron cargar talles:", errorTalles.message)
    }

    // 3. inicializar ficha
    let ficha = null

    // 4. parche temporal por si la orden no tiene modelo_id pero sí modelo texto
    if (!orden.modelo_id && orden.modelo) {
      const { data: modeloEncontrado, error: errorModelo } = await supabase
        .from("modelos")
        .select("id")
        .eq("nombre", orden.modelo)
        .eq("empresa_id", empresaId)
        .maybeSingle()

      if (!errorModelo && modeloEncontrado?.id) {
        orden.modelo_id = modeloEncontrado.id
      }
    }

    console.log("🔎 BUSCANDO FICHA", {
  modelo_id: orden.modelo_id,
  empresa_id: empresaId
})

   // 5. buscar ficha por modelo_id
if (orden.modelo_id) {
  const { data: fichaBase, error: errorFichaBase } = await supabase
    .from("fichas_tecnicas")
    .select("*")
    .eq("modelo_id", orden.modelo_id)
    .eq("empresa_id", empresaId)
    .maybeSingle()

  console.log("🔎 RESULTADO fichaBase", {
    fichaBase,
    errorFichaBase: errorFichaBase?.message || null
  })

  if (!errorFichaBase && fichaBase?.id) {
    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("*")
      .eq("ficha_id", fichaBase.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (secError) {
      console.warn("⚠️ error secciones:", secError.message)
    }

    const seccionIds = (secciones || []).map(s => s.id)

    let piezas = []
    if (seccionIds.length > 0) {
      const { data: piezasData, error: piezasError } = await supabase
        .from("fichas_piezas")
        .select("*")
        .in("seccion_id", seccionIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (piezasError) {
        console.warn("⚠️ error piezas:", piezasError.message)
      } else {
        piezas = piezasData || []
      }
    }

    const piezaIds = piezas.map(p => p.id)

    let materiales = []
    if (piezaIds.length > 0) {
      const { data: materialesData, error: matError } = await supabase
        .from("fichas_materiales")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (matError) {
        console.warn("⚠️ error materiales:", matError.message)
      } else {
        materiales = materialesData || []
      }
    }

    let operaciones = []
    if (piezaIds.length > 0) {
      const { data: operacionesData, error: opError } = await supabase
        .from("fichas_operaciones")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true })

      if (opError) {
        console.warn("⚠️ error operaciones:", opError.message)
      } else {
        operaciones = operacionesData || []
      }
    }

    const { data: imagenes, error: imgError } = await supabase
      .from("fichas_imagenes")
      .select("*")
      .eq("ficha_id", fichaBase.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (imgError) {
      console.warn("⚠️ error imagenes:", imgError.message)
    }

    ficha = {
  ...fichaBase,
  imagenes: imagenes || [],
  secciones: (secciones || []).map(seccion => {
    const piezasDeSeccion = piezas.filter(p => p.seccion_id === seccion.id)

    const piezasConDetalle = piezasDeSeccion.map(pieza => {
      const materialesDePieza = materiales.filter(m => m.pieza_id === pieza.id)
      const operacionesDePieza = operaciones.filter(o => o.pieza_id === pieza.id)

      return {
        ...pieza,
        materiales: materialesDePieza,
        operaciones: operacionesDePieza
      }
    })

    const materialesSeccion = piezasConDetalle.flatMap(p => p.materiales || [])
    const operacionesSeccion = piezasConDetalle.flatMap(p => p.operaciones || [])

    return {
      ...seccion,
      imagenes: (imagenes || []).filter(img => img.seccion_id === seccion.id),
      piezas: piezasConDetalle,
      materiales: materialesSeccion,
      operaciones: operacionesSeccion
    }
  })
}
  }
}
    // 5.1 traer patrón del modelo
    let patron = []

    if (orden.modelo_id) {
      const { data: patronesData, error: patronesError } = await supabase
        .from("patrones")
        .select("id, ficha_material_id, um, t_tarea")
        .eq("modelo_id", orden.modelo_id)
        .eq("empresa_id", empresaId)

        console.log("🧪 PATRONES DATA:", patronesData)

      if (patronesError) {
        console.warn("⚠️ error patrones:", patronesError.message)
      } else {
        const patronesMap = new Map(
          (patronesData || []).map(p => [p.ficha_material_id, p])
        )

        const patronAgrupado = []

        console.log("🧪 PATRON AGRUPADO FINAL:", patronAgrupado)

        if (ficha?.secciones?.length) {
          const normalizarTexto = (valor = "") =>
            String(valor || "")
              .trim()
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")

          const obtenerBloquePatron = (nombreSeccion, nombrePieza) => {
            const seccion = normalizarTexto(nombreSeccion)
            const pieza = normalizarTexto(nombrePieza)

            if (seccion === "SECCION N° 6" || seccion === "SECCION N° 6".normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
              return "CORTE REFUERZO"
            }

            if (seccion === "SECCION N° 1" || seccion === "SECCION N° 1".normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
              const piezasForro = [
                "FORRO",
                "LENGUA",
                "FORRO CAÑA/CUELLO",
                "FORRO CAPELLADA",
                "FORRO LENGUA"
              ].map(normalizarTexto)

              const piezasRefuerzo = [
                "RELLENO CAÑA",
                "RELLENO DE CAÑA",
                "RELLENO CUELLO",
                "RELLENO DE CUELLO",
                "RELLENO LENGUA",
                "RELLENO DE LENGUA"
              ].map(normalizarTexto)

              if (piezasForro.includes(pieza)) return "CORTE FORRO"
              if (piezasRefuerzo.includes(pieza)) return "CORTE REFUERZO"

              return "CORTE CAPELLADA"
            }

            return null
          }

          const bloquesMap = new Map()

          ficha.secciones.forEach(seccion => {
            ;(seccion.piezas || []).forEach(pieza => {
              ;(pieza.materiales || []).forEach(material => {
                const bloque = obtenerBloquePatron(seccion.nombre, pieza.nombre)
                if (!bloque) return

                const patronGuardado = patronesMap.get(material.id)

                if (!patronGuardado) return

                if (!bloquesMap.has(bloque)) {
                  bloquesMap.set(bloque, [])
                }

                bloquesMap.get(bloque).push({
                  pieza: pieza.nombre || "-",
                  material: material.material || "-",
                  color: material.color || material.especificacion || "-",
                  um: patronGuardado.um || "-",
                  t_tarea: patronGuardado.t_tarea ?? "-"
                })
              })
            })
          })

          patronAgrupado.push(
            ...Array.from(bloquesMap.entries()).map(([bloque, items]) => ({
              bloque,
              items
            }))
          )
        }

        patron = patronAgrupado
      }
    }

    // debug temporal
    console.log("✅ orden cargada:", orden.id)
    console.log("✅ modelo_id:", orden.modelo_id)
    console.log("✅ ficha encontrada:", !!ficha)

    // 6. responder todo junto
   res.json({
  ...orden,
  numero: orden.numero_tarea || "-",
  numero_tarea: orden.numero_tarea || "-",
  modelo_nombre: orden.modelos?.nombre || orden.modelo || "-",
  marca: orden.modelos?.marca || orden.marca || "-",
  codigo: orden.modelos?.codigo || orden.codigo || "-",
  talles,
  ficha,
  patron
})

  } catch (err) {
    console.error("💥 ERROR GENERAL /api/ordenes/:id:", err)
    res.status(500).json({ error: err.message })
  }
})
// ==========================
//  PRODUCCION.admin
// ==========================

app.get("/api/produccion/tarea/:numero", async (req,res)=>{

  try{

const numero = req.params.numero

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}


// traer tarea
const { data:tarea, error:errTarea } = await supabase
.from("ordenes")
.select(`
  *,
  modelos (
    nombre,
    marca,
    codigo
  )
`)
.eq("numero_tarea", numero)
.eq("empresa_id", empresaId)
.single()

if(errTarea) throw errTarea

// traer produccion + nombre del puesto
const { data:produccion, error:errProd } = await supabase
.from("produccion")
.select(`
id,
cantidad,
puesto_id,
puestos(nombre,orden)
`)
.eq("orden_id", tarea.id)
.eq("empresa_id", empresaId)

if(errProd) throw errProd

res.json({
  ...tarea,
  modelo_nombre: tarea.modelos?.nombre || "-",
  marca: tarea.modelos?.marca || "-",
  codigo: tarea.modelos?.codigo || "-",
  produccion
})

}catch(err){

console.error(err)
res.status(500).json({error:"error produccion tarea"})

}

})

// ==========================
// EDITOR DE PRODUCCION.admin
// ==========================

app.put("/api/produccion", async (req,res)=>{

const registros = req.body

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

const registrosConEmpresa = Array.isArray(registros)
  ? registros.map(r => ({ ...r, empresa_id: empresaId }))
  : []

const {data,error} = await supabase
.from("produccion")
.upsert(registrosConEmpresa)

if(error){
console.log(error)
return res.status(500).json(error)
}

res.json({ok:true})

})

// ==========================
// LISTAR PUESTOS
// ==========================

app.get("/api/puestos", async (req, res) => {
  try {
    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data, error } = await supabase
      .from("puestos")
      .select("id, nombre, sector_id, orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (error) throw error

    res.json(data || [])
  } catch (err) {
    console.error("Error obteniendo puestos:", err)
    res.status(500).json({ error: "error puestos" })
  }
})

// ==========================
// LISTAR USUARIOS
// ==========================
app.get("/api/usuarios", async (req,res)=>{

  try{

    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id,
        nombre,
        email,
        rol,
        tipo_login,
        codigo_acceso,
        puesto_id,
        puestos(nombre)
      `)
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false })

    if(error) throw error

    const usuarios = data.map(u => ({
      id: u.id,
      nombre: u.nombre,
      tipo_login: u.tipo_login || "-",
      rol: u.rol || "-",
      acceso: u.tipo_login === "operario"
        ? (u.codigo_acceso || "-")
        : (u.email || "-"),
      puesto: u.puestos?.nombre || "-"
    }))

    res.json(usuarios)

  }catch(err){

    console.error("Error obteniendo usuarios:",err)

    res.status(500).json({
      error:"error usuarios"
    })

  }

})


// ==========================
//  DASHBOARD PRODUCCION
// ==========================
app.get("/api/dashboard/sectores", async (req,res)=>{

try{

 const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
} 

const {data,error} = await supabase
.from("sectores")
.select(`
id,
nombre,
objetivo_diario,
produccion (
cantidad
)
`)
.eq("empresa_id", empresaId)

if(error) return res.json({ok:false})

res.json(data)

}catch(err){

res.json({ok:false})

}

})

// ============================
// GUARDAR OBJETIVO POR SECTOR
// ============================

app.post("/api/sector/objetivo", async (req,res)=>{

try{

const {sector,objetivo} = req.body

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

// buscar id del sector
const {data:sec,error:err1} = await supabase
.from("sectores")
.select("id")
.eq("nombre",sector)
.eq("empresa_id", empresaId)
.single()

if(err1) throw err1

// guardar objetivo del día
const {error:err2} = await supabase
.from("objetivos_sector")
.upsert({
sector_id: sec.id,
objetivo: objetivo,
fecha: new Date().toISOString().slice(0,10),
empresa_id: empresaId
})

if(err2) throw err2

res.json({ok:true})

}catch(err){

console.error(err)
res.status(500).json({ok:false})

}

})

// ============================
//  API OBJETIVO DEL DIA
// ============================

app.get("/api/objetivos", async (req,res)=>{

try{

const hoy = new Date().toISOString().slice(0,10)

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

const { data, error } = await supabase
.from("objetivos_sector")
.select(`
objetivo,
sector_id,
sectores(nombre)
`)
.eq("fecha",hoy)
.eq("empresa_id", empresaId)

if(error) throw error

const resultado = data.map(o=>({
nombre: o.sectores.nombre,
objetivo: o.objetivo
}))

res.json(resultado)

}catch(err){

console.error(err)
res.status(500).json({error:"error objetivos"})

}

})

app.get("/api/patrones/generar-desde-ficha/:modelo_id", async (req, res) => {
  const { modelo_id } = req.params
  const empresaId = req.user?.empresa_id

  if (!modelo_id) {
    return res.status(400).json({ error: "modelo_id requerido" })
  }

  if (!empresaId) {
    return res.status(401).json({ error: "Empresa no identificada" })
  }

  try {
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("id, modelo_id, codigo, nombre, marca, horma, temporada, detalle_general")
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)
      .maybeSingle()

    if (fichaError) {
      console.error("Error buscando ficha técnica:", fichaError)
      return res.status(500).json({ error: "Error buscando ficha técnica" })
    }

    if (!ficha) {
      return res.status(404).json({ error: "Este modelo no tiene ficha técnica cargada" })
    }

    const { data: secciones, error: seccionesError } = await supabase
      .from("fichas_secciones")
      .select("id, nombre, orden, titulo_impresion, tipo_seccion")
      .eq("ficha_id", ficha.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (seccionesError) {
      console.error("Error buscando secciones:", seccionesError)
      return res.status(500).json({ error: "Error buscando secciones de ficha" })
    }

   const SECCIONES_VALIDAS_PATRON = [
  "SECCION N° 1",
  "SECCIÓN N° 1",
  "SECCION N° 6",
  "SECCIÓN N° 6"
]

const seccionesPatron = (secciones || []).filter(s => {
  const nombre = (s.nombre || "").trim().toUpperCase()
  return SECCIONES_VALIDAS_PATRON.includes(nombre)
})

const seccionIds = seccionesPatron.map(s => s.id)

    if (!seccionIds.length) {
      return res.json({
        modelo_id: Number(modelo_id),
        ficha_id: ficha.id,
        cabecera: ficha,
        bloques: []
      })
    }

    const { data: piezas, error: piezasError } = await supabase
      .from("fichas_piezas")
      .select("id, seccion_id, nombre, orden, tipo_pieza")
      .in("seccion_id", seccionIds)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (piezasError) {
      console.error("Error buscando piezas:", piezasError)
      return res.status(500).json({ error: "Error buscando piezas de ficha" })
    }

    const piezaIds = (piezas || []).map(p => p.id)

    if (!piezaIds.length) {
      return res.json({
        modelo_id: Number(modelo_id),
        ficha_id: ficha.id,
        cabecera: ficha,
        bloques: []
      })
    }

    const { data: materiales, error: materialesError } = await supabase
      .from("fichas_materiales")
      .select("id, pieza_id, material, especificacion, color, unidad_medida, consumo, orden, categoria")
      .in("pieza_id", piezaIds)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })

    if (materialesError) {
      console.error("Error buscando materiales:", materialesError)
      return res.status(500).json({ error: "Error buscando materiales de ficha" })
    }

    const materialIds = (materiales || []).map(m => m.id)

    let patronesGuardados = []
    if (materialIds.length) {
      const { data: patrones, error: patronesError } = await supabase
        .from("patrones")
        .select("id, ficha_material_id, um, t_tarea")
        .eq("modelo_id", modelo_id)
        .eq("empresa_id", empresaId)
        .in("ficha_material_id", materialIds)

      if (patronesError) {
        console.error("Error buscando patrones guardados:", patronesError)
        return res.status(500).json({ error: "Error buscando patrón guardado" })
      }

      patronesGuardados = patrones || []
    }

    const patronesMap = new Map(
      patronesGuardados.map(p => [p.ficha_material_id, p])
    )

    const materialesPorPieza = new Map()

    for (const material of materiales || []) {
      if (!materialesPorPieza.has(material.pieza_id)) {
        materialesPorPieza.set(material.pieza_id, [])
      }
      materialesPorPieza.get(material.pieza_id).push(material)
    }

    function normalizarTexto(valor = "") {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function obtenerBloquePatron(nombreSeccion, nombrePieza) {
  const seccion = normalizarTexto(nombreSeccion)
  const pieza = normalizarTexto(nombrePieza)

  if (seccion === "SECCION N° 6" || seccion === "SECCION N° 6".normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    return "CORTE REFUERZO"
  }

  if (seccion === "SECCION N° 1" || seccion === "SECCION N° 1".normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    const piezasForro = [
      "FORRO",
      "LENGUA",
      "FORRO CAÑA/CUELLO",
      "FORRO CAPELLADA",
      "FORRO LENGUA"
    ].map(normalizarTexto)

    const piezasRefuerzo = [
      "RELLENO CAÑA",
      "RELLENO DE CAÑA",
      "RELLENO CUELLO",
      "RELLENO DE CUELLO",
      "RELLENO LENGUA",
      "RELLENO DE LENGUA"
    ].map(normalizarTexto)

    if (piezasForro.includes(pieza)) {
      return "CORTE FORRO"
    }

    if (piezasRefuerzo.includes(pieza)) {
      return "CORTE REFUERZO"
    }

    return "CORTE CAPELLADA"
  }

  return null
}

const bloquesMap = new Map()

for (const seccion of seccionesPatron) {
  const piezasDeSeccion = (piezas || []).filter(p => p.seccion_id === seccion.id)

  for (const pieza of piezasDeSeccion) {
    const mats = materialesPorPieza.get(pieza.id) || []

    for (const mat of mats) {
      const bloqueNombre = obtenerBloquePatron(seccion.nombre, pieza.nombre)

      if (!bloqueNombre) continue

      if (!bloquesMap.has(bloqueNombre)) {
        bloquesMap.set(bloqueNombre, {
          bloque: bloqueNombre,
          items: []
        })
      }

      const patronGuardado = patronesMap.get(mat.id)

      bloquesMap.get(bloqueNombre).items.push({
        ficha_material_id: mat.id,
        pieza: pieza.nombre || "",
        material: mat.material || "",
        especificacion: mat.especificacion || "",
        color: mat.color || "",
        um: patronGuardado?.um || "",
        t_tarea: patronGuardado?.t_tarea ?? null,
        orden_pieza: pieza.orden ?? 0,
        orden_material: mat.orden ?? 0
      })
    }
  }
}

const ordenBloques = {
  "CORTE REFUERZO": 1,
  "CORTE FORRO": 2,
  "CORTE CAPELLADA": 3
}

const bloques = Array.from(bloquesMap.values())
  .map(b => ({
    ...b,
    items: b.items.sort((a, b) => {
      if ((a.orden_pieza || 0) !== (b.orden_pieza || 0)) {
        return (a.orden_pieza || 0) - (b.orden_pieza || 0)
      }
      return (a.orden_material || 0) - (b.orden_material || 0)
    })
  }))
  .sort((a, b) => (ordenBloques[a.bloque] || 99) - (ordenBloques[b.bloque] || 99))

    return res.json({
      modelo_id: Number(modelo_id),
      ficha_id: ficha.id,
      cabecera: {
        codigo: ficha.codigo || "",
        nombre: ficha.nombre || "",
        marca: ficha.marca || "",
        horma: ficha.horma || "",
        temporada: ficha.temporada || "",
        detalle_general: ficha.detalle_general || ""
      },
      bloques
    })
  } catch (error) {
    console.error("Error general generando patrón desde ficha:", error)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/patrones", async (req, res) => {
  const empresaId = req.user?.empresa_id
  const { modelo_id, items } = req.body

  if (!empresaId) {
    return res.status(401).json({ error: "Empresa no identificada" })
  }

  if (!modelo_id) {
    return res.status(400).json({ error: "modelo_id requerido" })
  }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items debe ser un array" })
  }

  try {
    const rows = items
      .filter(item => item?.ficha_material_id)
      .map(item => ({
        modelo_id: Number(modelo_id),
        ficha_material_id: Number(item.ficha_material_id),
        um: item.um?.trim() || null,
        t_tarea:
          item.t_tarea !== "" &&
          item.t_tarea !== null &&
          item.t_tarea !== undefined
            ? Number(item.t_tarea)
            : null,
        empresa_id: empresaId
      }))

    const { error: deleteError } = await supabase
      .from("patrones")
      .delete()
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)

    if (deleteError) {
      console.error("Error borrando patrón anterior:", deleteError)
      return res.status(500).json({ error: "Error limpiando patrón anterior" })
    }

    if (!rows.length) {
      return res.json({ ok: true, message: "Patrón vacío guardado" })
    }

    const { error: insertError } = await supabase
      .from("patrones")
      .insert(rows)

    if (insertError) {
      console.error("Error guardando patrón:", insertError)
      return res.status(500).json({ error: "Error guardando patrón" })
    }

    return res.json({ ok: true, message: "Patrón guardado correctamente" })
  } catch (error) {
    console.error("Error general guardando patrón:", error)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
})

app.post("/api/patrones/calcular", async (req, res) => {
  try {

    const { modelo_id, cantidad } = req.body

    const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

    const { data, error } = await supabase
      .from("patrones")
      .select("*")
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)

    if (error) throw error

    const resultado = {}

    data.forEach(p => {

      const bloque = p.bloque || "GENERAL"

      if (!resultado[bloque]) {
        resultado[bloque] = {}
      }

      const key = `${p.material}-${p.color}-${p.unidad}`

      if (!resultado[bloque][key]) {
        resultado[bloque][key] = {
          material: p.material,
          color: p.color,
          unidad: p.unidad,
          total: 0
        }
      }

      resultado[bloque][key].total += p.consumo_por_par * cantidad

    })

    // convertir a array
    const salida = []

    Object.keys(resultado).forEach(bloque => {

      salida.push({
        bloque,
        items: Object.values(resultado[bloque])
      })

    })

    res.json(salida)

  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Error calculando" })
  }
})


// 🚀 INICIAR SERVIDOR
app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
