const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { supabase } = require("../../config/supabase");

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

// CREAR FICHA
router.post("/fichas", async (req, res) => {
  const {
    modelo_id,
    codigo,
    nombre,
    marca,
    horma,
    temporada,
    detalle_general,
    observaciones_generales,
    imagen_modelo_url,
    pdf_url,
    fuente,
    secciones = [],
    imagenes = []
  } = req.body;

  const tieneSecciones = Array.isArray(secciones) && secciones.length > 0;
  const tienePDF = !!pdf_url;

  if (!modelo_id) {
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
    const { data: modelo, error: modeloError } = await supabase
      .from("modelos")
      .select("id, empresa_id, nombre")
      .eq("id", modelo_id)
      .single();

    if (modeloError || !modelo) {
      throw new Error("Modelo no encontrado");
    }

    const empresa_id = modelo.empresa_id;

    const { data: fichaExistente } = await supabase
      .from("fichas_tecnicas")
      .select("id")
      .eq("modelo_id", modelo_id)
      .maybeSingle();

    if (fichaExistente) {
      return res.status(400).json({
        ok: false,
        error: "Ya existe una ficha técnica para este modelo"
      });
    }

    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .insert([{
        modelo_id,
        codigo: codigo || "",
        nombre: nombre || modelo.nombre || "",
        marca: marca || "",
        horma: horma || "",
        temporada: temporada || "",
        detalle_general: detalle_general || "",
        observaciones_generales: observaciones_generales || "",
        imagen_modelo_url: imagen_modelo_url || "",
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
          const { data: piezaData, error: piezaError } = await supabase
            .from("fichas_piezas")
            .insert([{
              seccion_id,
              nombre: pieza.nombre?.trim() || `Pieza ${piezaIndex + 1}`,
              orden: pieza.orden || piezaIndex + 1,
              observacion: pieza.observacion || "",
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
  const { modelo_id } = req.params;

  try {
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_tecnicas")
      .select("*")
      .eq("modelo_id", modelo_id)
      .single();

    if (fichaError) throw fichaError;

    const { data: secciones, error: secError } = await supabase
      .from("fichas_secciones")
      .select("*")
      .eq("ficha_id", ficha.id)
      .order("orden", { ascending: true });

    if (secError) throw secError;

    const seccionIds = (secciones || []).map(s => s.id);

    let piezas = [];
    if (seccionIds.length > 0) {
      const { data: piezasData, error: piezasError } = await supabase
        .from("fichas_piezas")
        .select("*")
        .in("seccion_id", seccionIds)
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
        .order("orden", { ascending: true });

      if (opError) throw opError;
      operaciones = operacionesData || [];
    }

    const { data: imagenes, error: imgError } = await supabase
      .from("fichas_imagenes")
      .select("*")
      .eq("ficha_id", ficha.id)
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

// LISTAR FICHAS
router.get("/fichas", async (req, res) => {
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

module.exports = router;