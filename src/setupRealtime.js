// setupRealtime.js - запустіть цей файл один раз через Node.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = 'sb_secret_7Go2_JTq3FE7B7JP9coHgQ_A0z0OwTA' // НЕ anon key!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupRealtime() {
    try {
        // Додаємо таблицю до realtime публікації
        const { data, error } = await supabase.rpc('add_table_to_realtime', {
            table_name: 'cutting_jobs'
        })

        if (error) {
            console.error('Error:', error)
        } else {
            console.log('Success:', data)
        }
    } catch (err) {
        console.error('Exception:', err)
    }
}

setupRealtime()