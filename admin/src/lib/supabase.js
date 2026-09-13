const viteEnv = import.meta.env || {}
const createClient = globalThis.supabase?.createClient

const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.__SUPABASE_URL__ || viteEnv.VITE_SUPABASE_URL || ''
  }

  return viteEnv.VITE_SUPABASE_URL || ''
}

const getSupabaseAnonKey = () => {
  if (typeof window !== 'undefined') {
    return window.__SUPABASE_ANON_KEY__ || viteEnv.VITE_SUPABASE_ANON_KEY || ''
  }

  return viteEnv.VITE_SUPABASE_ANON_KEY || ''
}

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

const publicSupabaseUrl = supabaseUrl || 'https://uldstujbduldbutjgksd.supabase.co'
const publicSupabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1bGRzdHVqamJkdWxkYnV0amdrc2QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4ODAzNTcwMSwiZXhwIjoyMTAzNjExNzAxfQ.IAfSJwcDHOUXe7Yolu3_-HJW8tJrzZjLPY-7xE'

export const supabase =
  createClient
    ? createClient(publicSupabaseUrl, publicSupabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null
