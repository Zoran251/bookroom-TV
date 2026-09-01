import { createClient } from '@supabase/supabase-js'

const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.__SUPABASE_URL__ || import.meta.env.VITE_SUPABASE_URL || ''
  }

  return import.meta.env.VITE_SUPABASE_URL || ''
}

const getSupabaseAnonKey = () => {
  if (typeof window !== 'undefined') {
    return window.__SUPABASE_ANON_KEY__ || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  }

  return import.meta.env.VITE_SUPABASE_ANON_KEY || ''
}

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null
