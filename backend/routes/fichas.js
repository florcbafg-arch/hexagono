const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const tiposPermitidos = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(new Error("Solo imágenes JPG, PNG o WEBP"));
    }

    cb(null, true);
  }
});
const { supabase } = require("../../config/supabase");
const BUCKET = "fichas-tecnicas";

function limpiarNombre(nombre = "") {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase();
}

function carpetaPorTipo(tipo = "") {
  const t = tipo.toLowerCase();

  if (t === "modelo") return "modelos";
  if (t === "secundaria") return "secundarias";
  if (t === "logo") return "logos";

  return "general";
}

const uploadDir = path.join(__dirname, "../../uploads/fichas");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se permite PDF"));
    }
    cb(null, true);
  }
});

// SUBIR PDF
router.post("/fichas/upload-pdf", upload.single("pdf"), async (req, res) => {

  const empresaId = req.user?.empresa_id;

if (!empresaId) {
  return res.status(401).json({
    ok: false,
    error: "Empresa no identificada"
  });
}

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No se recibió ningún archivo PDF"
      });
    }

    const fileUrl = `/uploads/fichas/${req.file.filename}`;

    res.json({
      ok: true,
      url: fileUrl
    });
  } catch (error) {
    console.error("Error subiendo PDF:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// SUBIR IMAGEN A SUPABASE STORAGE
router.post("/fichas/upload-imagen", uploadImage.single("imagen"), async (req, res) => {
  const empresaId = req.user?.empresa_id;

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    });
  }

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No se recibió imagen"
      });
    }

    const tipo = req.body?.tipo || "general";
    const carpeta = carpetaPorTipo(tipo);

    const extension = req.file.originalname.split(".").pop();
    const nombreLimpio = limpiarNombre(
      req.file.originalname.replace(/\.[^/.]+$/, "")
    );

    const nombreFinal = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${nombreLimpio}.${extension}`;

    const path = `${carpeta}/${empresaId}/${nombreFinal}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return res.json({
      ok: true,
      url: data.publicUrl,
      path,
      tipo
    });

  } catch (error) {
    console.error("ERROR SUBIENDO IMAGEN:", error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// CREAR FICHA
router.post("/fichas", async (req, res) => {
 const {
  modelo_id,
  modelo,
  codigo,
  nombre,
  marca,
  horma,
  temporada,
  detalle_general,
  observaciones_generales,
  tipo_calzado,
  imagen_modelo_url,
  imagen_secundaria_url,
  logo_marca_url,
  pdf_url,
  fuente,
  secciones = [],
  imagenes = []
} = req.body;

const empresaIdUsuario = req.user?.empresa_id;

if (!empresaIdUsuario) {
  return res.status(401).json({
    ok: false,
    error: "Empresa no identificada"
  });
}

console.log("BODY /api/fichas:", req.body);
console.log("MODELO_ID /api/fichas:", req.body.modelo_id);
console.log("MODELO /api/fichas:", req.body.modelo);
console.log("REQ.USER /api/fichas:", req.user);
console.log("VALIDANDO MODELO...", {
  modelo_id,
  modelo
});

  const tieneSecciones = Array.isArray(secciones) && secciones.length > 0;
  const tienePDF = !!pdf_url;

  if (!modelo_id && !modelo) {
  return res.status(400).json({
    ok: false,
    error: "Modelo obligatorio"
  });
}

  if (!tieneSecciones && !tienePDF) {
    return res.status(400).json({
      ok: false,
      error: "Debes cargar una ficha manual o subir un PDF"
    });
  }

  try {
    let modeloData = null;
let modeloIdFinal = null;
let empresa_id = null;

// ✅ Caso 1: viene modelo_id (compatibilidad con flujo viejo)
if (modelo_id) {
  const { data, error } = await supabase
    .from("modelos")
    .select("id, empresa_id, nombre, marca, codigo")
    .eq("id", modelo_id)
    .eq("empresa_id", empresaIdUsuario)
    .single();

  if (error || !data) {
    throw new Error("Modelo no encontrado");
  }

  modeloData = data;
  modeloIdFinal = data.id;
  empresa_id = data.empresa_id;
}

// ✅ Caso 2: viene modelo por nombre (flujo nuevo)
if (!modeloData && modelo) {
  if (!empresaIdUsuario) {
    throw new Error("No se pudo determinar la empresa del usuario");
  }

  const nombreModelo = String(modelo).trim();

  const { data: existente, error: existenteError } = await supabase
    .from("modelos")
    .select("id, empresa_id, nombre, marca, codigo")
    .eq("empresa_id", empresaIdUsuario)
    .ilike("nombre", nombreModelo)
    .maybeSingle();

  if (existenteError) throw existenteError;

  if (existente) {
    modeloData = existente;
    modeloIdFinal = existente.id;
    empresa_id = existente.empresa_id;
  } else {
    const { data: nuevoModelo, error: nuevoModeloError } = await supabase
      .from("modelos")
      .insert([{
        nombre: nombreModelo,
        marca: marca || "",
        codigo: codigo || "",
        empresa_id: empresaIdUsuario
      }])
      .select("id, empresa_id, nombre, marca, codigo")
      .single();

    if (nuevoModeloError) throw nuevoModeloError;

    modeloData = nuevoModelo;
    modeloIdFinal = nuevoModelo.id;
    empresa_id = nuevoModelo.empresa_id;
  }
}

if (!modeloIdFinal || !empresa_id) {
  throw new Error("No se pudo resolver el modelo");
}

const { data: fichaExistente, error: fichaExistenteError } = await supabase
  .from("fichas_tecnicas")
  .select("id")
  .eq("modelo_id", modeloIdFinal)
  .eq("empresa_id", empresa_id)
  .maybeSingle();

if (fichaExistenteError) throw fichaExistenteError;

if (fichaExistente) {
  return res.status(400).json({
    ok: false,
    error: "Ya existe una ficha técnica para este modelo"
  });
}

    const { data: ficha, error: fichaError } = await supabase
  .from("fichas_tecnicas")
  .insert([{
    modelo_id: modeloIdFinal,
    codigo: codigo || modeloData.codigo || "",
    nombre: nombre || modeloData.nombre || "",
    marca: marca || "",
    horma: horma || "",
    temporada: temporada || "",
    detalle_general: detalle_general || "",
    observaciones_generales: observaciones_generales || "",
    tipo_calzado: tipo_calzado || "vulcanizada",
    imagen_modelo_url: imagen_modelo_url || "",
    imagen_secundaria_url: imagen_secundaria_url || "",
    logo_marca_url: logo_marca_url || "",
    pdf_url: pdf_url || "",
    fuente: fuente || (tienePDF ? "PDF" : "MANUAL"),
    empresa_id
  }])
  .select()
  .single();

    if (fichaError) throw fichaError;

    const ficha_id = ficha.id;

    // SI VIENEN SECCIONES, GUARDAR ESTRUCTURA COMPLETA
    if (tieneSecciones) {
      for (const [index, seccion] of secciones.entries()) {
        const { data: sec, error: secError } = await supabase
          .from("fichas_secciones")
.insert([{
  ficha_id,
  nombre: seccion.nombre?.trim() || `Sección ${index + 1}`,
  orden: seccion.orden || index + 1,
  sector: seccion.sector || "",
  tipo_seccion: seccion.tipo_seccion || "proceso",
  titulo_impresion: seccion.titulo_impresion || seccion.nombre || "",
  observaciones: seccion.observaciones || "",
  empresa_id
}])
          .select()
          .single();

        if (secError) throw secError;

        const seccion_id = sec.id;
        const piezas = Array.isArray(seccion.piezas) ? seccion.piezas : [];

        for (const [piezaIndex, pieza] of piezas.entries()) {

          console.log("PIEZA A GUARDAR:", pieza)

          const { data: piezaData, error: piezaError } = await supabase
            .from("fichas_piezas")
            .insert([{
            seccion_id,
            nombre: pieza.nombre?.trim() || `Pieza ${piezaIndex + 1}`,
            tipo_pieza: pieza.tipo_pieza || "estructural",
            orden: pieza.orden || piezaIndex + 1,
            observacion: pieza.observacion || "",
            sacabocado_id: pieza.sacabocado_id || null,
            empresa_id
          }])
            .select()
            .single();

          if (piezaError) throw piezaError;

          const pieza_id = piezaData.id;

          if (Array.isArray(pieza.materiales) && pieza.materiales.length > 0) {
            const materialesInsert = pieza.materiales.map((m, matIndex) => ({
  pieza_id,
  material: m.material || "",
  especificacion: m.especificacion || "",
  color: m.color || "",
  categoria: m.categoria || "materia_prima",
  unidad_medida: m.unidad_medida || "",
  consumo: m.consumo ?? null,
  orden: m.orden || matIndex + 1,
  observacion: m.observacion || "",
  empresa_id
}));

            const { error: matError } = await supabase
              .from("fichas_materiales")
              .insert(materialesInsert);

            if (matError) throw matError;
          }

          if (Array.isArray(pieza.operaciones) && pieza.operaciones.length > 0) {
            const operacionesInsert = pieza.operaciones.map((o, opIndex) => ({
  pieza_id,
  tipo: o.tipo || "",
  detalle: o.detalle || "",
  valor_tecnico: o.valor_tecnico || "",
  orden: o.orden || opIndex + 1,
  observacion: o.observacion || "",
  empresa_id
}));

            const { error: opError } = await supabase
              .from("fichas_operaciones")
              .insert(operacionesInsert);

            if (opError) throw opError;
          }
        }
      }
    }

    // IMÁGENES OPCIONALES
    if (Array.isArray(imagenes) && imagenes.length > 0) {
      const imagenesInsert = imagenes.map((img, imgIndex) => ({
        ficha_id,
        seccion_id: img.seccion_id ?? null,
        url: img.url || "",
        tipo: img.tipo || "referencia",
        descripcion: img.descripcion || "",
        orden: img.orden || imgIndex + 1,
        empresa_id
      }));

      const { error: imgError } = await supabase
        .from("fichas_imagenes")
        .insert(imagenesInsert);

      if (imgError) throw imgError;
    }

    res.json({
      ok: true,
      message: "Ficha creada correctamente",
      ficha_id
    });

  } catch (error) {
    console.error("Error creando ficha:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// TRAER FICHA POR MODELO
router.get("/fichas/:modelo_id", async (req, res) => {

  const empresaId = req.user?.empresa_id;

if (!empresaId) {
  return res.status(401).json({
    ok: false,
    error: "Empresa no identificada"
  });
}

  const { modelo_id } = req.params;

  try {
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("*")
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)
      .single();

    if (fichaError) throw fichaError;

    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("*")
      .eq("ficha_id", ficha.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });

    if (secError) throw secError;

    const seccionIds = (secciones || []).map(s => s.id);

    let piezas = [];
    if (seccionIds.length > 0) {
      const { data: piezasData, error: piezasError } = await supabase
        .from("fichas_piezas")
        .select("*")
        .in("seccion_id", seccionIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true });

      if (piezasError) throw piezasError;
      piezas = piezasData || [];
    }

    const piezaIds = piezas.map(p => p.id);

    let materiales = [];
    if (piezaIds.length > 0) {
      const { data: materialesData, error: matError } = await supabase
        .from("fichas_materiales")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true });

      if (matError) throw matError;
      materiales = materialesData || [];
    }

    let operaciones = [];
    if (piezaIds.length > 0) {
      const { data: operacionesData, error: opError } = await supabase
        .from("fichas_operaciones")
        .select("*")
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true });

      if (opError) throw opError;
      operaciones = operacionesData || [];
    }

    const { data: imagenes, error: imgError } = await supabase
      .from("fichas_imagenes")
      .select("*")
      .eq("ficha_id", ficha.id)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });

    if (imgError) throw imgError;

    const resultado = {
      ...ficha,
      imagenes: imagenes || [],
      secciones: (secciones || []).map(seccion => ({
        ...seccion,
        imagenes: (imagenes || []).filter(img => img.seccion_id === seccion.id),
        piezas: piezas
          .filter(p => p.seccion_id === seccion.id)
          .map(pieza => ({
            ...pieza,
            materiales: materiales.filter(m => m.pieza_id === pieza.id),
            operaciones: operaciones.filter(o => o.pieza_id === pieza.id)
          }))
      }))
    };

    res.json({
      ok: true,
      ficha: resultado
    });

  } catch (error) {
    console.error("Error obteniendo ficha:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ELIMINAR FICHA POR MODELO
router.delete("/fichas/:modelo_id", async (req, res) => {
  const empresaId = req.user?.empresa_id;
  const { modelo_id } = req.params;

  if (!empresaId) {
    return res.status(401).json({
      ok: false,
      error: "Empresa no identificada"
    });
  }

  try {
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("id")
      .eq("modelo_id", modelo_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (fichaError) throw fichaError;

    if (!ficha) {
      return res.status(404).json({
        ok: false,
        error: "Ficha no encontrada"
      });
    }

    const fichaId = ficha.id;

    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("id")
      .eq("ficha_id", fichaId)
      .eq("empresa_id", empresaId);

    if (secError) throw secError;

    const seccionIds = (secciones || []).map(s => s.id);

    let piezaIds = [];
    if (seccionIds.length > 0) {
      const { data: piezas, error: piezasError } = await supabase
        .from("fichas_piezas")
        .select("id")
        .in("seccion_id", seccionIds)
        .eq("empresa_id", empresaId);

      if (piezasError) throw piezasError;
      piezaIds = (piezas || []).map(p => p.id);
    }

    if (piezaIds.length > 0) {
      const { error: matError } = await supabase
        .from("fichas_materiales")
        .delete()
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId);

      if (matError) throw matError;

      const { error: opError } = await supabase
        .from("fichas_operaciones")
        .delete()
        .in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId);

      if (opError) throw opError;
    }

    if (seccionIds.length > 0) {
      const { error: piezasDeleteError } = await supabase
        .from("fichas_piezas")
        .delete()
        .in("seccion_id", seccionIds)
        .eq("empresa_id", empresaId);

      if (piezasDeleteError) throw piezasDeleteError;
    }

    const { error: imgError } = await supabase
      .from("fichas_imagenes")
      .delete()
      .eq("ficha_id", fichaId)
      .eq("empresa_id", empresaId);

    if (imgError) throw imgError;

    const { error: secDeleteError } = await supabase
      .from("fichas_secciones")
      .delete()
      .eq("ficha_id", fichaId)
      .eq("empresa_id", empresaId);

    if (secDeleteError) throw secDeleteError;

    const { error: fichaDeleteError } = await supabase
      .from("fichas_tecnicas")
      .delete()
      .eq("id", fichaId)
      .eq("empresa_id", empresaId);

    if (fichaDeleteError) throw fichaDeleteError;

    return res.json({
      ok: true,
      message: "Ficha eliminada correctamente"
    });

  } catch (error) {
    console.error("Error eliminando ficha:", error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// LISTAR FICHAS
router.get("/fichas", async (req, res) => {

  const empresaId = req.user?.empresa_id;

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" });
}

  try {
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
        pdf_url,
        fuente,
        modelos(nombre)
      `)
      .eq("empresa_id", empresaId)
      .order("id", { ascending: false });

    if (error) throw error;

    const resultado = (data || []).map(f => ({
      ...f,
      modelo_nombre: f.modelos?.nombre || "-"
    }));

    res.json(resultado);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "error fichas" });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        ok: false,
        error: "Máximo 5MB"
      });
    }
  }

  return res.status(400).json({
    ok: false,
    error: err.message || "Error archivo"
  });
});

module.exports = router;