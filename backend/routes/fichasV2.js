const express = require("express");
const router = express.Router();
const { supabase } = require("../../config/supabase");

const ESTADOS = ["borrador", "vigente", "historica", "archivada"];
const SISTEMAS = ["vulcanizado", "pegado"];

function empresa(req, res) {
  const empresaId = req.user?.empresa_id;
  if (!empresaId) {
    res.status(401).json({ ok: false, error: "Empresa no identificada" });
    return null;
  }
  return empresaId;
}

async function obtenerArticulo(articuloId, empresaId) {
  const { data, error } = await supabase
    .from("articulos")
    .select("id, empresa_id, modelo_id, codigo, color, activo, modelos(id, nombre, marca)")
    .eq("id", articuloId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function obtenerFicha(fichaId, empresaId) {
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select("*")
    .eq("id", fichaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function obtenerEstructura(ficha, empresaId) {
  const { data: secciones, error: secError } = await supabase
    .from("fichas_secciones")
    .select("*")
    .eq("ficha_id", ficha.id)
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true });
  if (secError) throw secError;

  const seccionIds = (secciones || []).map(s => s.id);
  let piezas = [];
  if (seccionIds.length) {
    const r = await supabase.from("fichas_piezas").select("*")
      .in("seccion_id", seccionIds).eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (r.error) throw r.error;
    piezas = r.data || [];
  }

  const piezaIds = piezas.map(p => p.id);
  let materiales = [];
  let operaciones = [];
  if (piezaIds.length) {
    const [mats, ops] = await Promise.all([
      supabase.from("fichas_materiales").select("*").in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId).order("orden", { ascending: true }),
      supabase.from("fichas_operaciones").select("*").in("pieza_id", piezaIds)
        .eq("empresa_id", empresaId).order("orden", { ascending: true })
    ]);
    if (mats.error) throw mats.error;
    if (ops.error) throw ops.error;
    materiales = mats.data || [];
    operaciones = ops.data || [];
  }

  const imgs = await supabase.from("fichas_imagenes").select("*")
    .eq("ficha_id", ficha.id).eq("empresa_id", empresaId)
    .order("orden", { ascending: true });
  if (imgs.error) throw imgs.error;
  const imagenes = imgs.data || [];

  return {
    ...ficha,
    imagenes,
    secciones: (secciones || []).map(s => ({
      ...s,
      imagenes: imagenes.filter(i => i.seccion_id === s.id),
      piezas: piezas.filter(p => p.seccion_id === s.id).map(p => ({
        ...p,
        materiales: materiales.filter(m => m.pieza_id === p.id),
        operaciones: operaciones.filter(o => o.pieza_id === p.id)
      }))
    }))
  };
}

async function copiarEstructura(origen, destinoId, empresaId) {
  const estructura = await obtenerEstructura(origen, empresaId);
  const seccionMap = new Map();

  for (const s of estructura.secciones || []) {
    const { data: ns, error } = await supabase.from("fichas_secciones").insert([{
      ficha_id: destinoId, nombre: s.nombre, orden: s.orden, sector: s.sector,
      observaciones: s.observaciones, titulo_impresion: s.titulo_impresion,
      tipo_seccion: s.tipo_seccion, empresa_id: empresaId,
      es_estructura_base: s.es_estructura_base === true
    }]).select().single();
    if (error) throw error;
    seccionMap.set(s.id, ns.id);

    for (const p of s.piezas || []) {
      const { data: np, error: pe } = await supabase.from("fichas_piezas").insert([{
        seccion_id: ns.id, nombre: p.nombre, orden: p.orden, observacion: p.observacion,
        tipo_pieza: p.tipo_pieza, sacabocado_id: p.sacabocado_id, empresa_id: empresaId,
        es_estructura_base: p.es_estructura_base === true
      }]).select().single();
      if (pe) throw pe;

      if (p.materiales?.length) {
        const { error: me } = await supabase.from("fichas_materiales").insert(
          p.materiales.map(m => ({
            pieza_id: np.id, material: m.material, especificacion: m.especificacion,
            color: m.color, unidad_medida: m.unidad_medida, consumo: m.consumo,
            orden: m.orden, observacion: m.observacion, categoria: m.categoria,
            empresa_id: empresaId
          }))
        );
        if (me) throw me;
      }

      if (p.operaciones?.length) {
        const { error: oe } = await supabase.from("fichas_operaciones").insert(
          p.operaciones.map(o => ({
            pieza_id: np.id, tipo: o.tipo, detalle: o.detalle,
            orden: o.orden, observacion: o.observacion,
            valor_tecnico: o.valor_tecnico, empresa_id: empresaId
          }))
        );
        if (oe) throw oe;
      }
    }
  }

  if (estructura.imagenes?.length) {
    const { error } = await supabase.from("fichas_imagenes").insert(
      estructura.imagenes.map(i => ({
        ficha_id: destinoId,
        seccion_id: i.seccion_id ? seccionMap.get(i.seccion_id) || null : null,
        url: i.url, tipo: i.tipo, descripcion: i.descripcion,
        orden: i.orden, empresa_id: empresaId
      }))
    );
    if (error) throw error;
  }
}

// Listado V2 por artículo. Las legacy quedan disponibles en /api/fichas.
router.get("/fichas-v2", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const { data, error } = await supabase
      .from("fichas_tecnicas")
      .select("id, articulo_id, version, estado, sistema_constructivo, vigente_desde, vigente_hasta, version_anterior_id, created_at, updated_at, articulos(id, codigo, color, activo, modelos(id, nombre, marca))")
      .eq("empresa_id", empresaId)
      .not("articulo_id", "is", null)
      .order("articulo_id", { ascending: true })
      .order("version", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, fichas: data || [] });
  } catch (e) {
    console.error("Error listando fichas V2:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Historial de versiones de un artículo.
router.get("/fichas-v2/articulo/:articulo_id", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const articulo = await obtenerArticulo(req.params.articulo_id, empresaId);
    if (!articulo) return res.status(404).json({ ok: false, error: "Artículo no encontrado" });

    const { data, error } = await supabase.from("fichas_tecnicas")
      .select("*").eq("empresa_id", empresaId).eq("articulo_id", articulo.id)
      .order("version", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, articulo, versiones: data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Detalle por ID de ficha/version.
router.get("/fichas-v2/id/:ficha_id", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const ficha = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!ficha || !ficha.articulo_id) {
      return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    }
    res.json({ ok: true, ficha: await obtenerEstructura(ficha, empresaId) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Crea exclusivamente V1 borrador. Nunca crea Modelo ni Artículo.
router.post("/fichas-v2", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  const { articulo_id, sistema_constructivo = "vulcanizado", detalle_general = "",
    observaciones_generales = "", pdf_url = "", fuente = "MANUAL" } = req.body || {};

  if (!articulo_id) return res.status(400).json({ ok: false, error: "articulo_id obligatorio" });
  if (!SISTEMAS.includes(sistema_constructivo)) {
    return res.status(400).json({ ok: false, error: "Sistema constructivo inválido" });
  }

  try {
    const articulo = await obtenerArticulo(articulo_id, empresaId);
    if (!articulo) return res.status(404).json({ ok: false, error: "Artículo no encontrado en tu empresa" });
    if (articulo.activo === false) return res.status(409).json({ ok: false, error: "El artículo está archivado" });

    const { data: previa, error: previaError } = await supabase.from("fichas_tecnicas")
      .select("id").eq("empresa_id", empresaId).eq("articulo_id", articulo.id).limit(1);
    if (previaError) throw previaError;
    if (previa?.length) {
      return res.status(409).json({ ok: false, error: "El artículo ya tiene ficha. Usa Nueva versión." });
    }

    const modelo = articulo.modelos || {};
    const { data: ficha, error } = await supabase.from("fichas_tecnicas").insert([{
      articulo_id: articulo.id,
      modelo_id: articulo.modelo_id,
      version: 1,
      estado: "borrador",
      sistema_constructivo,
      tipo_calzado: sistema_constructivo,
      codigo: articulo.codigo,
      nombre: modelo.nombre || "",
      marca: modelo.marca || "",
      detalle_general,
      observaciones_generales,
      pdf_url,
      fuente,
      empresa_id: empresaId,
      created_by_usuario_id: req.user?.id || null
    }]).select().single();

    if (error) throw error;

    const { error: estructuraError } = await supabase.rpc("asegurar_estructura_base_ficha", {
      p_ficha_id: ficha.id,
      p_empresa_id: empresaId
    });
    if (estructuraError) throw estructuraError;

    res.status(201).json({ ok: true, message: "Ficha V1 creada como borrador con estructura base protegida", ficha });
  } catch (e) {
    console.error("Error creando ficha V2:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Solo borradores son editables. La estructura técnica se incorporará en el siguiente paso de UI/API.
router.patch("/fichas-v2/:ficha_id", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const ficha = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!ficha || !ficha.articulo_id) return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    if (ficha.estado !== "borrador") {
      return res.status(409).json({ ok: false, error: "Solo una ficha en borrador puede editarse" });
    }

    const cambios = {};
    for (const campo of ["detalle_general", "observaciones_generales", "pdf_url", "fuente", "imagen_modelo_url", "imagen_secundaria_url", "logo_marca_url"]) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, campo)) cambios[campo] = req.body[campo] ?? "";
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sistema_constructivo")) {
      if (!SISTEMAS.includes(req.body.sistema_constructivo)) {
        return res.status(400).json({ ok: false, error: "Sistema constructivo inválido" });
      }
      cambios.sistema_constructivo = req.body.sistema_constructivo;
      cambios.tipo_calzado = req.body.sistema_constructivo;
    }
    cambios.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from("fichas_tecnicas").update(cambios)
      .eq("id", ficha.id).eq("empresa_id", empresaId).select().single();
    if (error) throw error;
    res.json({ ok: true, message: "Borrador actualizado", ficha: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Reemplaza la estructura completa de un BORRADOR en una sola transacción PostgreSQL.
// Si cualquier validación/insert falla, PostgreSQL revierte TODO el cambio.
router.put("/fichas-v2/:ficha_id/estructura", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  const { secciones = [], imagenes = [] } = req.body || {};

  if (!Array.isArray(secciones) || !Array.isArray(imagenes)) {
    return res.status(400).json({ ok: false, error: "secciones e imagenes deben ser arrays" });
  }

  try {
    const ficha = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!ficha || !ficha.articulo_id) {
      return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    }
    if (ficha.estado !== "borrador") {
      return res.status(409).json({ ok: false, error: "La estructura solo puede editarse mientras la ficha está en borrador" });
    }

    const { error: rpcError } = await supabase.rpc("guardar_estructura_ficha_v2", {
      p_ficha_id: ficha.id,
      p_empresa_id: empresaId,
      p_secciones: secciones,
      p_imagenes: imagenes
    });
    if (rpcError) throw rpcError;

    const actualizada = await obtenerFicha(ficha.id, empresaId);
    return res.json({
      ok: true,
      message: "Estructura del borrador guardada atómicamente",
      ficha: await obtenerEstructura(actualizada, empresaId)
    });
  } catch (e) {
    console.error("Error guardando estructura ficha V2:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Publicar vuelve vigente el borrador y cierra la versión vigente anterior.
router.post("/fichas-v2/:ficha_id/publicar", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const ficha = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!ficha || !ficha.articulo_id) return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    if (ficha.estado !== "borrador") {
      return res.status(409).json({ ok: false, error: "Solo un borrador puede publicarse" });
    }

    const ahora = new Date().toISOString();
    const { data: vigente, error: ve } = await supabase.from("fichas_tecnicas")
      .select("id").eq("empresa_id", empresaId).eq("articulo_id", ficha.articulo_id)
      .eq("estado", "vigente").maybeSingle();
    if (ve) throw ve;

    if (vigente) {
      const { error } = await supabase.from("fichas_tecnicas").update({
        estado: "historica", vigente_hasta: ahora, updated_at: ahora
      }).eq("id", vigente.id).eq("empresa_id", empresaId);
      if (error) throw error;
    }

    const { data, error } = await supabase.from("fichas_tecnicas").update({
      estado: "vigente", vigente_desde: ahora, vigente_hasta: null,
      publicada_por_usuario_id: req.user?.id || null, updated_at: ahora
    }).eq("id", ficha.id).eq("empresa_id", empresaId).select().single();
    if (error) throw error;

    res.json({ ok: true, message: `Ficha V${data.version} publicada`, ficha: data });
  } catch (e) {
    console.error("Error publicando ficha V2:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Nueva versión: copia cabecera + estructura y nace como borrador.
router.post("/fichas-v2/:ficha_id/nueva-version", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const origen = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!origen || !origen.articulo_id) return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    if (!["vigente", "historica"].includes(origen.estado)) {
      return res.status(409).json({ ok: false, error: "La nueva versión debe partir de una ficha vigente o histórica" });
    }

    const { data: borrador, error: be } = await supabase.from("fichas_tecnicas")
      .select("id").eq("empresa_id", empresaId).eq("articulo_id", origen.articulo_id)
      .eq("estado", "borrador").maybeSingle();
    if (be) throw be;
    if (borrador) return res.status(409).json({ ok: false, error: "Ya existe un borrador para este artículo" });

    const { data: ultimas, error: ue } = await supabase.from("fichas_tecnicas")
      .select("version").eq("empresa_id", empresaId).eq("articulo_id", origen.articulo_id)
      .order("version", { ascending: false }).limit(1);
    if (ue) throw ue;
    const nuevaVersion = Number(ultimas?.[0]?.version || 0) + 1;

    const { data: nueva, error } = await supabase.from("fichas_tecnicas").insert([{
      articulo_id: origen.articulo_id, modelo_id: origen.modelo_id,
      version: nuevaVersion, estado: "borrador",
      sistema_constructivo: origen.sistema_constructivo || origen.tipo_calzado || "vulcanizado",
      tipo_calzado: origen.sistema_constructivo || origen.tipo_calzado || "vulcanizada",
      codigo: origen.codigo, nombre: origen.nombre, marca: origen.marca,
      horma: origen.horma, temporada: origen.temporada,
      detalle_general: origen.detalle_general,
      observaciones_generales: origen.observaciones_generales,
      imagen_modelo_url: origen.imagen_modelo_url,
      imagen_secundaria_url: origen.imagen_secundaria_url,
      logo_marca_url: origen.logo_marca_url, pdf_url: origen.pdf_url,
      fuente: origen.fuente, empresa_id: empresaId,
      version_anterior_id: origen.id,
      created_by_usuario_id: req.user?.id || null
    }]).select().single();
    if (error) throw error;

    await copiarEstructura(origen, nueva.id, empresaId);
    res.status(201).json({ ok: true, message: `Ficha V${nuevaVersion} creada como borrador`, ficha: nueva });
  } catch (e) {
    console.error("Error creando nueva versión:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Archivar conserva toda la historia; nunca borra físicamente.
router.post("/fichas-v2/:ficha_id/archivar", async (req, res) => {
  const empresaId = empresa(req, res); if (!empresaId) return;
  try {
    const ficha = await obtenerFicha(req.params.ficha_id, empresaId);
    if (!ficha || !ficha.articulo_id) return res.status(404).json({ ok: false, error: "Ficha V2 no encontrada" });
    const ahora = new Date().toISOString();
    const { data, error } = await supabase.from("fichas_tecnicas").update({
      estado: "archivada",
      vigente_hasta: ficha.estado === "vigente" ? ahora : ficha.vigente_hasta,
      updated_at: ahora
    }).eq("id", ficha.id).eq("empresa_id", empresaId).select().single();
    if (error) throw error;
    res.json({ ok: true, message: "Ficha archivada sin eliminar historial", ficha: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
