// تحديث اسم الملعب الثالث (multi) إلى "السلة"
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// قراءة .env.local يدوياً
const envContent = readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function updateVenueName() {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'venue_3_name', value: 'السلة' }, { onConflict: 'key' })

  if (error) {
    console.error('❌ خطأ:', error.message)
    process.exit(1)
  }

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['venue_1_name', 'venue_2_name', 'venue_3_name'])

  console.log('✅ تم التحديث — الأسماء الحالية:')
  data?.forEach(r => console.log(`  ${r.key}: ${r.value}`))
}

updateVenueName()
