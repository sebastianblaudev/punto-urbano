
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gxevfegraewgyuravnbp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZXZmZWdyYWV3Z3l1cmF2bmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI1NzMsImV4cCI6MjA4NjkwODU3M30.ChQNooeJvbBZF4qOpOJtB92tfYszRJiRay8G_W0nnhI'

export const supabase = createClient(supabaseUrl, supabaseKey)
