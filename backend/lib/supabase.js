const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = supabase
