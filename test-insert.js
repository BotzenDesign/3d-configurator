import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const data = {
    id: "test_material_" + Date.now(),
    label: "Test Material",
    type: "FDM",
    price_label: "",
    colors: ["Black"],
    is_active: true,
    spool_cost: 40,
    spool_quantity: 1000,
    cost_per_gram: null
  }
  
  const { data: result, error } = await supabase.from('materials').insert([data]).select()
  if (error) {
    console.error("Error:", JSON.stringify(error, null, 2))
  } else {
    console.log("Success:", result)
  }
}

test()
