const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log("URL:", supabaseUrl)
console.log("KEY:", supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = { supabase }