const express = require("express")
const router = express.Router()

const { supabase } = require("../../config/supabase")

// 📊 OBTENER PROGRAMACION 🔥🔥🔥
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("programacion")
      .select("*")
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

   const dataInsert = items.map((item) => ({
  marca: item.MARCA ?? item.marca ?? null,
  estado: item.ESTADO ?? item.estado ?? "pendiente",
  fecha: item["FECHA DE INGRESO"] ?? item.fecha ?? item.Fecha ?? null,
  numero_tarea: item["Nº DE TAREA"] ?? item["N° DE TAREA"] ?? item.numero_tarea ?? null,
  curva: item.CURVA ?? item.curva ?? null,
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
  try {
    const { data: programaciones, error } = await supabase
      .from("programacion")
      .select("*")
      .neq("estado", "generado")

    if (error) throw error

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

        // 4. BUSCAR MODELO: exacto primero, parcial después
        let modelo = null

        const { data: modeloExacto, error: errorModeloExacto } = await supabase
          .from("modelos")
          .select("id, nombre, marca")
          .eq("nombre", p.modelo)
          .maybeSingle()

        if (errorModeloExacto) throw errorModeloExacto

        if (modeloExacto) {
          modelo = modeloExacto
        } else {
          const { data: modelosParecidos, error: errorModeloParecido } = await supabase
            .from("modelos")
            .select("id, nombre, marca")
            .ilike("nombre", `%${p.modelo}%`)

          if (errorModeloParecido) throw errorModeloParecido

          if (!modelosParecidos || modelosParecidos.length === 0) {
            errores.push({
              fila: p.id,
              numero_tarea: numeroTarea,
              modelo: p.modelo,
              error: `Modelo no encontrado en tabla modelos`
            })
            continue
          }

          if (modelosParecidos.length > 1) {
            errores.push({
              fila: p.id,
              numero_tarea: numeroTarea,
              modelo: p.modelo,
              error: `Modelo ambiguo: se encontraron ${modelosParecidos.length} coincidencias`
            })
            continue
          }

          modelo = modelosParecidos[0]
        }

        console.log("✅ Modelo resuelto:", {
          programacion_id: p.id,
          modelo_programacion: p.modelo,
          modelo_id: modelo.id,
          modelo_nombre: modelo.nombre
        })

        // 5. BUSCAR CURVA DEL MODELO
        const { data: curva, error: errorCurva } = await supabase
          .from("curvas_talles")
          .select("talle, porcentaje")
          .eq("modelo_id", modelo.id)
          .order("talle", { ascending: true })

        if (errorCurva) throw errorCurva

        if (!curva || curva.length === 0) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            modelo_id: modelo.id,
            curva_programacion: p.curva || null,
            error: `El modelo no tiene curva cargada en curvas_talles`
          })
          continue
        }

        // 6. VALIDAR SUMA DE CURVA (acepta 1 o 100)
        const sumaPorcentajes = curva.reduce((acc, c) => acc + Number(c.porcentaje || 0), 0)

        const sumaValida =
          Math.abs(sumaPorcentajes - 1) <= 0.001 ||
          Math.abs(sumaPorcentajes - 100) <= 0.001

        if (!sumaValida) {
          errores.push({
            fila: p.id,
            numero_tarea: numeroTarea,
            modelo: p.modelo,
            modelo_id: modelo.id,
            suma_porcentajes: sumaPorcentajes,
            error: `La curva tiene suma inválida`
          })
          continue
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
  empresa_id: "a7e6f147-9c5f-4f69-8a67-355cb2xxxxxx"
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

        for (let i = 0; i < curva.length; i++) {
          const item = curva[i]
          const porcentajeNormalizado = usaPorcentajeEntero
            ? Number(item.porcentaje) / 100
            : Number(item.porcentaje)

          let cantidadTalle

          if (i === curva.length - 1) {
            cantidadTalle = totalPares - acumulado
          } else {
            cantidadTalle = Math.round(totalPares * porcentajeNormalizado)
            acumulado += cantidadTalle
          }

          tallesCalculados.push({
            orden_id: orden.id,
            talle: item.talle,
            cantidad: cantidadTalle,
            empresa_id: "00000000-0000-0000-0000-000000000000"
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
            estado: "pendiente"
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

