const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl) {
  throw new Error("Falta SUPABASE_URL")
}

if (!supabaseKey) {
  throw new Error("Falta SUPABASE_SECRET_KEY")
}

console.log("SUPABASE_URL OK:", !!supabaseUrl)
console.log("SUPABASE_SECRET_KEY OK:", !!supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = { supabase }