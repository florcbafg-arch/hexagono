const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

console.log("URL:", supabaseUrl)
console.log("KEY:", supabaseKey ? "OK" : "FALTA")

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = { supabase }