const crypto = require("crypto")

function getSecret() {
  const secret = process.env.OPERARIO_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error("Falta OPERARIO_TOKEN_SECRET o SUPABASE_SECRET_KEY")
  return secret
}

function crearTokenOperario(operario) {
  const payload = Buffer.from(JSON.stringify({
    sub: operario.id,
    empresa_id: operario.empresa_id,
    puesto_id: operario.puesto_id,
    tipo: "operario",
    exp: Date.now() + (8 * 60 * 60 * 1000)
  })).toString("base64url")

  const firma = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url")
  return payload + "." + firma
}

function validarTokenOperario(token) {
  const partes = String(token || "").split(".")
  if (partes.length !== 2) throw new Error("Token inválido")
  const [payload, firma] = partes
  const esperada = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url")
  const a = Buffer.from(firma)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Firma inválida")
  const sesion = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  if (sesion.tipo !== "operario" || !sesion.sub || !sesion.empresa_id || !sesion.exp || Date.now() > sesion.exp) {
    throw new Error("Sesión inválida o vencida")
  }
  return sesion
}

module.exports = { crearTokenOperario, validarTokenOperario }
