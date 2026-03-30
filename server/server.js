if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const { supabase } = require("../config/supabase")
const multer = require("multer")

const { authMiddleware } = require("../backend/middlewares/authMiddleware") // ✅ SOLO UNA VEZ

const fichasRoutes = require("../backend/routes/fichas");
const programacionRoutes = require("../backend/routes/programacion");
const authRoutes = require("../backend/routes/auth");

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

app.use("/api", authMiddleware, fichasRoutes);

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
app.get("/api/tarea/:numero", async (req,res)=>{

try{

const numero=req.params.numero

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

const {data,error}=await supabase
.from("ordenes")
.select(`
id,
numero_tarea,
pares_plan,
modelo_id
`)
.eq("numero_tarea",numero)
.eq("empresa_id", empresaId)
.single()
.maybeSingle()

if(error || !data){
return res.status(404).send("no encontrada")
}

// obtener talles de la tarea

const {data:talles,error:errorTalles} = await supabase
.from("tarea_talles")
.select("talle,cantidad")
.eq("tarea_id",data.id)
.eq("empresa_id", empresaId)

if(errorTalles){
throw errorTalles
}

res.json({
id:data.id,
numero:data.numero_tarea,
marca:"Arcana",
modelo:"Air Runner Pro",
pares:data.pares_plan,
talles: talles.map(t => ({
talle: t.talle,
plan: t.cantidad
}))
})

}catch(err){

console.log(err)
res.status(500).send("error servidor")

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

app.get("/api/produccion/check/:numero", async (req,res)=>{

try{

const numero = req.params.numero
const puesto = req.query.puesto

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

if(!puesto){
 return res.json({registrado:false})
}

// buscar id de tarea
const {data:tarea,error:errTarea} = await supabase
.from("ordenes")
.select("id")
.eq("empresa_id", empresaId)
.eq("numero_tarea", numero)
.single()

if(errTarea || !tarea){
return res.json({registrado:false})
}

// buscar produccion en ese puesto
const {data,error} = await supabase
.from("produccion")
.select("*")
.eq("orden_id", tarea.id)
.eq("puesto_id", puesto)
.eq("empresa_id", empresaId)

if(error){
console.log(error)
return res.json({registrado:false})
}

res.json({
registrado: data.length > 0
})

}catch(err){

console.log(err)
res.json({registrado:false})

}

})

// 🏭 GUARDAR PRODUCCION EN SUPABASE
app.post("/api/produccion", async (req, res) => {

  const { orden_id, puesto_id, cantidad } = req.body
  const usuario = req.user

  // VALIDACIONES
  if(!orden_id || !puesto_id || !cantidad){
    return res.status(400).json({
      error:"Datos incompletos"
    })
  }

  if(cantidad <= 0){
    return res.status(400).json({
      error:"Cantidad inválida"
    })
  }

  // INSERT EN SUPABASE
  const { data, error } = await supabase
    .from("produccion")
    .insert([
      {
        orden_id,
        puesto_id,
        cantidad,
        usuario: usuario?.nombre || "sistema",
        empresa_id: usuario?.empresa_id || null
      }
    ])

  if (error) {
    console.log("❌ Error guardando producción:", error)
    return res.status(500).json({
      error: error.message
    })
  }

  console.log("✅ Producción guardada:", data)

  res.json({
    mensaje: "Producción guardada",
    data
  })

})


// ============================
// CREAR USUARIO (ADMIN)
// ============================

app.post("/api/usuarios", async (req,res)=>{

try{

const {nombre,username,password,puesto_id} = req.body

const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

// 🔒 VALIDAR DATOS
if(!nombre || !username || !password || !puesto_id){

 return res.status(400).json({
  error:"Datos incompletos"
 })

}


const {data,error} = await supabase
.from("usuarios")
.insert([
{
nombre,
username,
password,
puesto_id,
activo:true,
empresa_id: empresaId
}
])

if(error){
 console.log(error)
 return res.status(500).json(error)
}

res.json({
 mensaje:"Usuario creado correctamente",
 data
})

}catch(err){

console.error(err)

res.status(500).json({
 error:"Error creando usuario"
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

    const { data, error } = await supabase
      .from("curvas_talles")
      .select("talle, porcentaje")
      .eq("modelo_id", modeloId)
      .eq("empresa_id", empresaId)
      .order("talle", { ascending: true })

    if (error) throw error

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
      .select("id,nombre")

    if (errorSectores) throw errorSectores

    if (sectores && sectores.length > 0) {
      const sectoresInsert = sectores.map(s => ({
  orden_id: tarea.id,
  sector_id: s.id,
  estado: "pendiente",
  empresa_id: empresaId
}))

      console.log("Insertando sectores...")

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
        .select("id")
        .eq("modelo_id", orden.modelo_id)
        .eq("empresa_id", empresaId)
        .maybeSingle()

        console.log("🔎 RESULTADO fichaBase", {
  fichaBase,
  errorFichaBase: errorFichaBase?.message || null
})

      if (!errorFichaBase && fichaBase?.id) {
        const { data: fichaCompleta, error: errorFichaCompleta } = await supabase
          .from("fichas_tecnicas")
          .select(`
            *,
            ficha_secciones (
              *,
              ficha_materiales (*),
              ficha_operaciones (*),
              ficha_piezas (*),
              ficha_imagenes (*)
            )
          `)
          .eq("id", fichaBase.id)
          .eq("empresa_id", empresaId)
          .single()

          console.log("🔎 RESULTADO fichaCompleta", {
  fichaCompleta: !!fichaCompleta,
  errorFichaCompleta: errorFichaCompleta?.message || null
})

        if (!errorFichaCompleta && fichaCompleta) {
          ficha = fichaCompleta
        } else {
          console.warn("⚠️ no se pudo cargar ficha completa:", errorFichaCompleta?.message)
        }
      }
    }

    // debug temporal
    console.log("✅ orden cargada:", orden.id)
    console.log("✅ modelo_id:", orden.modelo_id)
    console.log("✅ ficha encontrada:", !!ficha)

    // 6. responder todo junto
    res.json({
  ...orden,
  modelo_nombre: orden.modelos?.nombre || orden.modelo || "-",
  marca: orden.modelos?.marca || orden.marca || "-",
  codigo: orden.modelos?.codigo || orden.codigo || "-",
  talles,
  ficha
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

app.get("/api/puestos", async (req,res)=>{

try{

const { data, error } = await supabase
.from("puestos")
.select("id,nombre")
.order("orden",{ascending:true})

if(error) throw error

res.json(data)

}catch(err){

console.error("Error obteniendo puestos:",err)
res.status(500).json({error:"error puestos"})

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
username,
puesto_id,
puestos(nombre)
`)
.eq("empresa_id", empresaId)

if(error) throw error

const usuarios = data.map(u => ({
id: u.id,
nombre: u.nombre,
username: u.username,
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

// ============================
// OBTENER OBJETIVOS
// ============================
app.get("/api/objetivos", async (req,res)=>{

try{

  const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

const {data,error} = await supabase
.from("sectores")
.select("nombre,objetivo_diario")
.eq("empresa_id", empresaId)

if(error) throw error

res.json(data)

}catch(err){

console.error(err)
res.status(500).json({error:"error objetivos"})

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

app.post("/api/patrones", async (req, res) => {
  try {

    const { modelo_id, patrones } = req.body

    const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

    if (!modelo_id || !patrones) {
      return res.status(400).json({ error: "Datos incompletos" })
    }

    // borrar anteriores (opcional pero recomendado)
    await supabase
      .from("patrones")
      .delete()
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)

    const dataInsert = patrones.map(p => ({
      empresa_id: empresaId,
      modelo_id,
      bloque: p.bloque || null,
      pieza: p.pieza,
      material: p.material,
      color: p.color || null,
      unidad: p.unidad,
      consumo_por_par: p.consumo
    }))

    const { error } = await supabase
      .from("patrones")
      .insert(dataInsert)

    if (error) throw error

    res.json({ ok: true })

  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Error guardando patrones" })
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
