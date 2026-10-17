const express=require("express")
const router=express.Router()
const {supabase}=require("../../config/supabase")
function empresa(req,res){const id=req.user?.empresa_id;if(!id){res.status(401).json({ok:false,error:"Empresa no identificada"});return null}return id}
const texto=v=>String(v??"").trim()
router.get("/",async(req,res)=>{const empresaId=empresa(req,res);if(!empresaId)return;try{const {data,error}=await supabase.from("patron_grupos").select("id,nombre,orden,activo").eq("empresa_id",empresaId).eq("activo",true).order("orden").order("nombre");if(error)throw error;res.json({ok:true,grupos:data||[]})}catch(e){console.error(e);res.status(500).json({ok:false,error:"Error cargando grupos del patrón"})}})
router.post("/",async(req,res)=>{const empresaId=empresa(req,res);if(!empresaId)return;try{const nombre=texto(req.body?.nombre).toUpperCase();if(!nombre)return res.status(400).json({ok:false,error:"El nombre del grupo es obligatorio"});const {data,error}=await supabase.from("patron_grupos").insert({empresa_id:empresaId,nombre,orden:Number(req.body?.orden)||100,activo:true}).select("id,nombre,orden,activo").single();if(error){if(error.code==="23505")return res.status(409).json({ok:false,error:"Ese grupo/sección ya existe"});throw error}res.status(201).json({ok:true,grupo:data})}catch(e){console.error(e);res.status(500).json({ok:false,error:"Error creando grupo/sección"})}})
module.exports=router
