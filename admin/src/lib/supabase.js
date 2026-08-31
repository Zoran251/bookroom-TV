const hasSupabaseGlobal = typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function'

export const supabase = hasSupabaseGlobal
  ? window.supabase.createClient(
      window.__SUPABASE_URL__ || '',
      window.__SUPABASE_ANON_KEY__ || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )
  : null
