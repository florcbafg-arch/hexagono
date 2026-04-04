const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

async function obtenerOCrearModelo({ empresaId, nombreModelo, marca = null, codigo = null }) {
  const normalizarTexto = (valor) =>
    String(valor || "")
      .trim()
      .replace(/\s+/g, " ")

  const nombreLimpio = normalizarTexto(nombreModelo)
  const marcaLimpia = normalizarTexto(marca) || null
  const codigoLimpio = normalizarTexto(codigo) || null

  if (!empresaId) {
    throw new Error("Empresa no identificada")
  }

  if (!nombreLimpio) {
    throw new Error("Nombre de modelo vacío")
  }

  // 1. Traer modelos de la empresa y comparar en memoria de forma exacta, ignorando mayúsculas
  const { data: modelosEmpresa, error: errorBuscar } = await supabase
    .from("modelos")
    .select("id, nombre, marca, codigo, tipo_curva")
    .eq("empresa_id", empresaId)

  if (errorBuscar) {
    throw errorBuscar
  }

  const nombreNormalizado = nombreLimpio.toLowerCase()

  const modeloExistente = (modelosEmpresa || []).find(
    (m) => normalizarTexto(m.nombre).toLowerCase() === nombreNormalizado
  )

  if (modeloExistente?.id) {
    return modeloExistente
  }

  // 2. Crear si no existe
  const { data: modeloNuevo, error: errorCrear } = await supabase
  .from("modelos")
  .insert([{
    empresa_id: empresaId,
    nombre: nombreLimpio,
    marca: marcaLimpia,
    codigo: codigoLimpio,
    descripcion: "Modelo creado automáticamente desde programación"
  }])
  .select("id, nombre, marca, codigo, tipo_curva")
  .single()

  if (errorCrear) {
    throw errorCrear
  }

  return modeloNuevo
}

// 📊 OBTENER PROGRAMACION 🔥🔥🔥
router.get("/", async (req, res) => {
  try {

    console.log("REQ.USER PROGRAMACION:", req.user)

    const empresaId = req.user?.empresa_id

    if (!empresaId) {
      return res.status(401).json({ error: "Empresa no identificada" })
    }

    const { data, error } = await supabase
      .from("programacion")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })

    if (error) {
      console.error("ERROR SUPABASE:", error)
      return res.status(500).json({ error: "Error al obtener programación" })
    }

    res.json(data)
  } catch (err) {
    console.error("ERROR SERVER:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// 📥 IMPORTAR PROGRAMACIÓN
router.post("/importar", async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No se recibieron items válidos" })
    }

    console.log("📥 Items recibidos:", items.length)
    console.log("📌 Primer item:", items[0])

    const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

   const dataInsert = items.map((item) => ({
  empresa_id: empresaId, 
  marca: item.MARCA ?? item.marca ?? null,
  estado: item.ESTADO ?? item.estado ?? "pendiente",
  fecha: item["FECHA DE INGRESO"] ?? item.fecha ?? item.Fecha ?? null,
  numero_tarea: item["Nº DE TAREA"] ?? item["N° DE TAREA"] ?? item.numero_tarea ?? null,
  curva: item.CURVA ?? item.curva ?? null,
  tipo_curva: item["TIPO CURVA"] ?? item.tipo_curva ?? null,
  modelo: item.MODELO ?? item.Modelo ?? item.modelo ?? null,
  codigo: item.CODIGO ?? item.codigo ?? null,
  v_p: item["V/P"] ?? item.v_p ?? null,
  horma: item.HORMA ?? item.horma ?? null,
  cantidad: Number(item.PARES ?? item.Cantidad ?? item.cantidad ?? 0),
  pares_remitidos: Number(item["PARES REMITADOS"] ?? item.pares_remitidos ?? 0),
  pedido: item.PEDIDO ?? item.pedido ?? null,
  comentario: item.COMENTARIO ?? item.comentario ?? null,
  mes_entrega: item["MES ENTREGA"] ?? item.mes_entrega ?? null,
  prioridad: item.Prioridad ?? item.prioridad ?? "media"
}))
   const validos = dataInsert.filter(
  (x) => x.modelo && x.cantidad > 0
)

    if (validos.length === 0) {
      return res.status(400).json({
        error: "No hay datos válidos para importar"
      })
    }

    console.log("⚠️ Filas ignoradas:", dataInsert.length - validos.length)

    const chunkSize = 200

    for (let i = 0; i < validos.length; i += chunkSize) {
      const chunk = validos.slice(i, i + chunkSize)

      console.log(`🚀 Insertando bloque ${i} - ${i + chunk.length}`)

      const { error } = await supabase
        .from("programacion")
        .insert(chunk)

      if (error) {
        console.error("❌ Error en bloque:", error)
        return res.status(500).json({
          error: error.message,
          bloque: i
        })
      }
    }

    res.json({ ok: true, total: validos.length })
  } catch (error) {
    console.error("❌ Error al importar programación:", error)
    res.status(500).json({
      error: error.message || "Error al importar programación"
    })
  }
})

// 🚀 GENERAR ÓRDENES
router.post("/generar", async (req, res) => {

  const empresaId = req.user?.empresa_id

if (!empresaId) {
  return res.status(401).json({ error: "Empresa no identificada" })
}

  try {
    const { data: programaciones, error } = await supabase
  .from("programacion")
  .select("*")
  .eq("empresa_id", empresaId)
  .neq("estado", "generado")

    if (error) throw error

    if (!programaciones || programaciones.length === 0) {

      console.log("ℹ️ No hay programaciones pendientes para generar")

  return res.json({
    ok: true,
    creadas: 0,
    saltadas: 0,
    errores: [],
    mensaje: "No hay programaciones pendientes para generar"
  })
}

    let creadas = 0
    let saltadas = 0
    let errores = []

    for (const p of programaciones) {
      try {
        // 1. VALIDACIONES BÁSICAS
        if (!p.modelo || !p.cantidad) {
          errores.push({
            fila: p.id,
            numero_tarea: p.numero_tarea || null,
            modelo: p.modelo || null,
            error: "Faltan modelo o cantidad"
          })
          continue
        }

        // 2. ARMAR NÚMERO DE TAREA
        const numeroTarea = p.numero_tarea || `PG-${String(p.id).padStart(6, "0")}`

        console.log("🟡 Procesando programación:", {
          id: p.id,
          numero_tarea: numeroTarea,
          modelo: p.modelo,
          curva: p.curva,
          cantidad: p.cantidad
        })

        // 3. EVITAR DUPLICADOS
        const { data: existe, error: errorExiste } = await supabase
          .from("ordenes")
          .select("id, numero_tarea")
          .eq("empresa_id", empresaId)
          .eq("numero_tarea", numeroTarea)
          .maybeSingle()

        if (errorExiste) throw errorExiste

        if (existe) {
          saltadas++
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            error: `Orden ya existente para numero_tarea ${numeroTarea}`
          })
          continue
        }

        // 4. BUSCAR O CREAR MODELO
const modelo = await obtenerOCrearModelo({
  empresaId,
  nombreModelo: p.modelo,
  marca: p.marca || null,
  codigo: p.codigo || null
})

        console.log("✅ Modelo resuelto:", {
          programacion_id: p.id,
          modelo_programacion: p.modelo,
          modelo_id: modelo.id,
          modelo_nombre: modelo.nombre
        })

        // 5. BUSCAR CURVA DEL MODELO
      // 5. BUSCAR CURVA POR MARCA + TIPO_CURVA
const marcaModelo = modelo.marca || p.marca || null
const tipoCurvaModelo = modelo.tipo_curva || null

if (!marcaModelo || !tipoCurvaModelo) {
  errores.push({
    fila: p.id,
    numero_tarea: numeroTarea,
    modelo: p.modelo,
    error: "El modelo no tiene marca o tipo_curva definido"
  })
  continue
}

const { data: curva, error: errorCurva } = await supabase
  .from("curvas_talles")
  .select("talle, porcentaje, pares")
  .eq("marca", marcaModelo)
  .eq("tipo_curva", tipoCurvaModelo)
  .eq("empresa_id", empresaId)
  .order("talle", { ascending: true })

if (errorCurva) throw errorCurva

        // 6. VALIDAR SUMA DE CURVA (acepta 1 o 100)
        const sumaPorcentajes = curvaFinal.reduce((acc, c) => acc + Number(c.porcentaje || 0), 0)

        const sumaValida =
          Math.abs(sumaPorcentajes - 1) <= 0.001 ||
          Math.abs(sumaPorcentajes - 100) <= 0.001

        if (!sumaValida) {
  console.warn("⚠️ Curva inválida, usando fallback automático")

  curvaFinal = [
    { talle: 39, porcentaje: 0.15 },
    { talle: 40, porcentaje: 0.20 },
    { talle: 41, porcentaje: 0.25 },
    { talle: 42, porcentaje: 0.20 },
    { talle: 43, porcentaje: 0.10 },
    { talle: 44, porcentaje: 0.10 }
  ]
}

        const usaPorcentajeEntero = Math.abs(sumaPorcentajes - 100) <= 0.001

        console.log("📏 Curva encontrada:", {
          programacion_id: p.id,
          modelo_id: modelo.id,
          suma_porcentajes: sumaPorcentajes,
          usa_porcentaje_entero: usaPorcentajeEntero,
          talles: curva
        })

        // 7. CREAR ORDEN
        const { data: orden, error: errorOrden } = await supabase
          .from("ordenes")
          .insert([{
  numero_tarea: numeroTarea,
  modelo: p.modelo || modelo.nombre,
  marca: p.marca || modelo.marca || null,
  pares_plan: Number(p.cantidad),
  fecha: p.fecha || new Date().toISOString().slice(0, 10),
  modelo_id: modelo.id,
  codigo: p.codigo || null,
  horma: p.horma || null,
  pedido: p.pedido || null,
  comentario: p.comentario || null,
  prioridad: p.prioridad || "normal",
  estado: "pendiente",
  id_programacion: p.id,

  // 🔥 CLAVE PARA QUE NO ROMPA
  empresa_id: empresaId
}])
          .select()
          .single()

        if (errorOrden) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            error: `Error insertando orden: ${errorOrden.message}`
          })
          continue
        }

        console.log("🧾 Orden creada:", {
          orden_id: orden.id,
          numero_tarea: orden.numero_tarea
        })

        // 8. CALCULAR TALLES POR CURVA
        const totalPares = Number(p.cantidad)
        const tallesCalculados = []
        let acumulado = 0

        for (let i = 0; i < curvaFinal.length; i++) {
          const item = curvaFinal[i]
          const porcentajeNormalizado = usaPorcentajeEntero
            ? Number(item.porcentaje) / 100
            : Number(item.porcentaje)

          let cantidadTalle

          if (i === curvaFinal.length - 1) {
            cantidadTalle = totalPares - acumulado
          } else {
            cantidadTalle = Math.round(totalPares * porcentajeNormalizado)
            acumulado += cantidadTalle
          }

          tallesCalculados.push({
            orden_id: orden.id,
            talle: item.talle,
            cantidad: cantidadTalle,
            empresa_id: empresaId
          })
        }

        console.log("👟 Talles calculados:", tallesCalculados)

        // 9. INSERTAR TALLES
        const { error: errorTalles } = await supabase
          .from("orden_talles")
          .insert(tallesCalculados)

        if (errorTalles) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            orden_id: orden.id,
            error: `Error insertando orden_talles: ${errorTalles.message}`
          })
          continue
        }

        // 10. CREAR SECTORES AUTOMÁTICOS
        const { data: sectores, error: errorSectores } = await supabase
  .from("sectores")
  .select("id")
  .eq("empresa_id", empresaId)

        if (errorSectores) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            orden_id: orden.id,
            error: `Error leyendo sectores: ${errorSectores.message}`
          })
          continue
        }

        if (sectores && sectores.length > 0) {
          const sectoresInsert = sectores.map(s => ({
            orden_id: orden.id,
            sector_id: s.id,
            estado: "pendiente",
            empresa_id: empresaId
          }))

          const { error: errorOrdenesSector } = await supabase
            .from("ordenes_sector")
            .insert(sectoresInsert)

          if (errorOrdenesSector) {
            errores.push({
              fila: p.id,
              numero_tarea: numeroTarea,
              modelo: p.modelo,
              orden_id: orden.id,
              error: `Error insertando ordenes_sector: ${errorOrdenesSector.message}`
            })
            continue
          }
        }

        // 11. MARCAR PROGRAMACIÓN COMO GENERADA
        const { error: errorUpdate } = await supabase
          .from("programacion")
          .update({ estado: "generado" })
          .eq("id", p.id)
          .eq("empresa_id", empresaId)

        if (errorUpdate) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            orden_id: orden.id,
            error: `Orden creada pero no se pudo marcar programación como generada: ${errorUpdate.message}`
          })
          continue
        }

        creadas++

      } catch (errInterno) {
        console.error("❌ Error en fila de programación:", p.id, errInterno)
        errores.push({
          fila: p.id,
          numero_tarea: p.numero_tarea || null,
          modelo: p.modelo || null,
          error: errInterno.message
        })
      }
    }

    res.json({
      ok: creadas > 0,
      creadas,
      saltadas,
      errores,
      mensaje: `Órdenes generadas: ${creadas}, omitidas: ${saltadas}, errores: ${errores.length}`
    })

  } catch (err) {
    console.error("❌ ERROR GENERANDO ÓRDENES:", err)
    res.status(500).json({
      ok: false,
      error: "Error generando órdenes"
    })
  }
})

module.exports = router

