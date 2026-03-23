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
      modelo: item.modelo ?? item.Modelo ?? null,
      cantidad: Number(item.cantidad ?? item.Cantidad ?? 0),
      fecha: item.fecha ?? item.Fecha ?? null,
      prioridad: item.prioridad ?? item.Prioridad ?? "normal",
      estado: "pendiente"
    }))

    const validos = dataInsert.filter(
      (x) => x.modelo && x.cantidad > 0 && x.fecha
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
        if (!p.numero_tarea || !p.modelo || !p.cantidad) {
          errores.push(`Fila ${p.id}: faltan datos básicos`)
          continue
        }

        // 2. EVITAR DUPLICADOS
        const { data: existe, error: errorExiste } = await supabase
          .from("ordenes")
          .select("id")
          .eq("numero_tarea", p.numero_tarea)
          .maybeSingle()

        if (errorExiste) throw errorExiste

        if (existe) {
          saltadas++
          continue
        }

        // 3. BUSCAR MODELO
        const { data: modelo, error: errorModelo } = await supabase
          .from("modelos")
          .select("id, nombre")
          .ilike("nombre", `%${p.modelo}%`)
          .maybeSingle()

        if (errorModelo) throw errorModelo

        if (!modelo) {
          errores.push(`Fila ${p.id}: modelo no encontrado (${p.modelo})`)
          continue
        }

        // 4. BUSCAR CURVA DEL MODELO
        const { data: curva, error: errorCurva } = await supabase
          .from("curvas_talles")
          .select("talle, porcentaje")
          .eq("modelo_id", modelo.id)
          .order("talle", { ascending: true })

        if (errorCurva) throw errorCurva

        if (!curva || curva.length === 0) {
          errores.push(`Fila ${p.id}: el modelo ${modelo.nombre} no tiene curva cargada`)
          continue
        }

        // 5. VALIDAR QUE LA CURVA SUME 1
        const sumaPorcentajes = curva.reduce((acc, c) => acc + Number(c.porcentaje), 0)

        if (Math.abs(sumaPorcentajes - 1) > 0.001) {
          errores.push(`Fila ${p.id}: la curva del modelo ${modelo.nombre} no suma 1.00`)
          continue
        }

        // 6. CREAR ORDEN
        const { data: orden, error: errorOrden } = await supabase
          .from("ordenes")
          .insert([{
            numero_tarea: p.numero_tarea,
            modelo_id: modelo.id,
            pares_plan: p.cantidad,
            fecha: p.fecha || new Date().toISOString(),
            estado: "pendiente",
            origen: "programacion",
            programacion_id: p.id
          }])
          .select()
          .single()

        if (errorOrden) throw errorOrden

        // 7. REPARTIR TOTALES SEGÚN CURVA
        const totalPares = Number(p.cantidad)
        let tallesCalculados = []
        let acumulado = 0

        for (let i = 0; i < curva.length; i++) {
          const item = curva[i]

          let cantidadTalle

          if (i === curva.length - 1) {
            // último talle: absorbe diferencia por redondeo
            cantidadTalle = totalPares - acumulado
          } else {
            cantidadTalle = Math.round(totalPares * Number(item.porcentaje))
            acumulado += cantidadTalle
          }

          tallesCalculados.push({
            tarea_id: orden.id,
            talle: item.talle,
            cantidad: cantidadTalle
          })
        }

        // 8. INSERTAR TALLES
        const { error: errorTalles } = await supabase
          .from("tarea_talles")
          .insert(tallesCalculados)

        if (errorTalles) throw errorTalles

        // 9. CREAR SECTORES AUTOMÁTICOS
        const { data: sectores, error: errorSectores } = await supabase
          .from("sectores")
          .select("id")

        if (errorSectores) throw errorSectores

        if (sectores && sectores.length > 0) {
          const sectoresInsert = sectores.map(s => ({
            orden_id: orden.id,
            sector_id: s.id,
            estado: "pendiente"
          }))

          const { error: errorOrdenesSector } = await supabase
            .from("ordenes_sector")
            .insert(sectoresInsert)

          if (errorOrdenesSector) throw errorOrdenesSector
        }

        // 10. MARCAR PROGRAMACIÓN COMO GENERADA
        const { error: errorUpdate } = await supabase
          .from("programacion")
          .update({ estado: "generado" })
          .eq("id", p.id)

        if (errorUpdate) throw errorUpdate

        creadas++

      } catch (errInterno) {
        console.error("Error en fila de programación:", p.id, errInterno)
        errores.push(`Fila ${p.id}: ${errInterno.message}`)
      }
    }

    res.json({
      ok: true,
      creadas,
      saltadas,
      errores,
      mensaje: `Órdenes generadas: ${creadas}, omitidas: ${saltadas}`
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

module.exports = router