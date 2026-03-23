const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

console.log("URL:", supabaseUrl)
console.log("KEY:", supabaseKey)
console.log("KEY TYPE:", typeof supabaseKey)
console.log("KEY LENGTH:", supabaseKey ? supabaseKey.length : "NULL")

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = { supabase }