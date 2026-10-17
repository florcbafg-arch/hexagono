const express = require("express")
const router = express.Router()
const { supabase } = require("../../config/supabase")

function empresa(req,res){
  const id=req.user?.empresa_id
  if(!id){res.status(401).json({ok:false,error:"Empresa no identificada"});return null}
  return id
}
const texto=v=>String(v??"").trim()

router.get("/", async (req,res)=>{
  const empresaId=empresa(req,res); if(!empresaId)return
  try{
    const {data,error}=await supabase.from("materiales_maestro")
      .select("id,nombre,familia,origen,unidad_sugerida,activo")
      .eq("empresa_id",empresaId).eq("activo",true).order("nombre")
    if(error)throw error
    res.json({ok:true,materiales:data||[]})
  }catch(err){console.error("Error materiales maestro:",err);res.status(500).json({ok:false,error:"Error cargando materiales"})}
})

router.post("/", async (req,res)=>{
  const empresaId=empresa(req,res); if(!empresaId)return
  try{
    const nombre=texto(req.body?.nombre)
    if(!nombre)return res.status(400).json({ok:false,error:"El nombre del material es obligatorio"})
    const origen=texto(req.body?.origen).toLowerCase()||null
    if(origen && !["natural","artificial","otro"].includes(origen))return res.status(400).json({ok:false,error:"Origen de material inválido"})
    const payload={empresa_id:empresaId,nombre:nombre.toUpperCase(),familia:texto(req.body?.familia).toUpperCase()||null,origen,unidad_sugerida:texto(req.body?.unidad_sugerida).toUpperCase()||null,activo:true}
    const {data,error}=await supabase.from("materiales_maestro").insert(payload).select("id,nombre,familia,origen,unidad_sugerida,activo").single()
    if(error){
      if(error.code==="23505")return res.status(409).json({ok:false,error:"Ese material ya existe en el Maestro de Materiales"})
      throw error
    }
    res.status(201).json({ok:true,material:data})
  }catch(err){console.error("Error creando material:",err);res.status(500).json({ok:false,error:"Error creando material"})}
})

module.exports=router
