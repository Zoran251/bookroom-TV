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

export const supabase =
  supabaseUrl && supabaseAnonKey && createClient
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null
