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
          errores.push(`Fila ${p.id}: faltan modelo o cantidad`)
          continue
        }

        // 2. ARMAR NÚMERO DE TAREA
        // Como Programación hoy no guarda numero_tarea,
        // generamos uno estable desde el id de programación.
        const numeroTarea = p.numero_tarea || `PG-${String(p.id).padStart(6, "0")}`

        // 3. EVITAR DUPLICADOS
        const { data: existe, error: errorExiste } = await supabase
          .from("ordenes")
          .select("id")
          .eq("numero_tarea", numeroTarea)
          .maybeSingle()

        if (errorExiste) throw errorExiste

        if (existe) {
          saltadas++
          continue
        }

        // 4. BUSCAR MODELO
        const { data: modelo, error: errorModelo } = await supabase
          .from("modelos")
          .select("id, nombre, marca")
          .ilike("nombre", `%${p.modelo}%`)
          .maybeSingle()

        if (errorModelo) throw errorModelo

        if (!modelo) {
          errores.push(`Fila ${p.id}: modelo no encontrado (${p.modelo})`)
          continue
        }

        // 5. BUSCAR CURVA DEL MODELO
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

        // 6. VALIDAR SUMA DE CURVA
        const sumaPorcentajes = curva.reduce((acc, c) => acc + Number(c.porcentaje), 0)

        if (Math.abs(sumaPorcentajes - 1) > 0.001) {
          errores.push(`Fila ${p.id}: la curva del modelo ${modelo.nombre} no suma 1.00`)
          continue
        }

        // 7. CREAR ORDEN (usando columnas reales)
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
    id_programacion: p.id
  }])
          .select()
          .single()

        if (errorOrden) throw errorOrden

        // 8. CALCULAR TALLES POR CURVA
        const totalPares = Number(p.cantidad)
        const tallesCalculados = []
        let acumulado = 0

        for (let i = 0; i < curva.length; i++) {
          const item = curva[i]

          let cantidadTalle

          if (i === curva.length - 1) {
            cantidadTalle = totalPares - acumulado
          } else {
            cantidadTalle = Math.round(totalPares * Number(item.porcentaje))
            acumulado += cantidadTalle
          }

          tallesCalculados.push({
            orden_id: orden.id,
            talle: item.talle,
            cantidad: cantidadTalle,
            empresa_id: "00000000-0000-0000-0000-000000000000"
          })
        }

        // 9. INSERTAR TALLES EN TABLA REAL
        const { error: errorTalles } = await supabase
          .from("orden_talles")
          .insert(tallesCalculados)

        if (errorTalles) throw errorTalles

        // 10. CREAR SECTORES AUTOMÁTICOS
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

        // 11. MARCAR PROGRAMACIÓN COMO GENERADA
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
      ok: creadas > 0,
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

