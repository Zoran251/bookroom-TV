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

const publicSupabaseUrl = supabaseUrl
const publicSupabaseAnonKey = supabaseAnonKey

const hasSupabaseConfig = Boolean(publicSupabaseUrl && publicSupabaseAnonKey)

if (!hasSupabaseConfig && typeof window !== 'undefined') {
  console.warn('Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting the admin app.')
}

export const supabase =
  hasSupabaseConfig && createClient
    ? createClient(publicSupabaseUrl, publicSupabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null
