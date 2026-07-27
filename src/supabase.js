import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://gtmtpdurtczjeowztdhk.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bXRwZHVydGN6amVvd3p0ZGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDMxNjIsImV4cCI6MjEwMDM3OTE2Mn0.-uXd_6zzT8O2hKIEJc8jsgcRFzqOgY_tlH91m3wwVZw"


export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)