import { supabase } from './supabase.js'

const STORAGE_KEYS = {
  module: 'tile:',
  bookings: 'bookings',
}

function getAdminIdentity(username) {
  const normalizedUsername = username.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername)) {
    throw new Error('Korisničko ime mora imati 3-32 znaka: slova, brojevi, tačka, crtica ili donja crta.')
  }
  return `${normalizedUsername}@admins.bookroom.local`
}

function assertSupabaseConfig() {
  if (!supabase) {
    throw new Error('Supabase konfiguracija nije validna. Provjeri VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY u .env datoteci.')
  }
}

export async function signInAdmin(username, pin) {
  assertSupabaseConfig()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: getAdminIdentity(username),
    password: pin,
  })
  if (error) throw error
  return data.user
}

export async function signUpAdmin({ username, pin, hotelName, city }) {
  assertSupabaseConfig()

  const { data, error } = await supabase.auth.signUp({
    email: getAdminIdentity(username),
    password: pin,
    options: {
      data: {
        admin_username: username.trim().toLowerCase(),
        hotel_name: hotelName,
        hotel_city: city || null,
      },
    },
  })
  if (error) throw error
  if (!data.user) throw new Error('Registracija nije uspjela.')

  if (data.session) await supabase.auth.signOut()

  return { user: data.user }
}

export async function signOutAdmin() {
  if (supabase) await supabase.auth.signOut()
}

export async function getAdminContext() {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('admin_hotel_accounts')
    .select('hotel_id, username, hotel_name, city, hotels(id, name, city)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data ? { user, hotelId: data.hotel_id, hotel: data.hotels } : null
}

export async function loadHotelHeader() {
  if (!supabase) return null
  const hotelId = await getHotelId()
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, city, welcome_text, phone, email')
    .eq('id', hotelId)
    .single()
  if (error) throw error

  const { error: accountError } = await supabase
    .from('admin_hotel_accounts')
    .update({ hotel_name: data.name, city: data.city })
    .eq('hotel_id', hotelId)
  if (accountError) throw accountError

  return data
}

export async function saveHotelHeader(values) {
  if (!supabase) throw new Error('Supabase nije podešen.')
  const hotelId = await getHotelId()
  const { data, error } = await supabase
    .from('hotels')
    .update({
      name: values.name,
      city: values.city || null,
      welcome_text: values.welcomeText || null,
      phone: values.phone || null,
      email: values.email || null,
    })
    .eq('id', hotelId)
    .select('id, name, city, welcome_text, phone, email')
    .single()
  if (error) throw error
  return data
}

async function getHotelId() {
  const context = await getAdminContext()
  if (!context) throw new Error('Admin nalog nije povezan s hotelom.')
  return context.hotelId
}

function getFallbackStorage() {
  return {
    async get(key) {
      try {
        const value = localStorage.getItem(key)
        return value === null ? { value: null } : { value }
      } catch (error) {
        return { value: null }
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value)
        return true
      } catch (error) {
        return false
      }
    },
  }
}

const storage = window.storage || getFallbackStorage()

export function getStorageApi() {
  return storage
}

export async function sendPowerTvCommand(roomNumber) {
  if (!supabase) throw new Error('Supabase nije podešen.')

  const hotelId = await getHotelId()
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('room_number', roomNumber)
    .maybeSingle()

  if (roomError) throw roomError
  if (!room) throw new Error('Za ovu sobu nije pronađena konfiguracija.')

  const { data: device, error: deviceError } = await supabase
    .from('tv_devices')
    .select('id, device_id, status, last_seen_at')
    .eq('hotel_id', hotelId)
    .eq('room_id', room.id)
    .maybeSingle()

  if (deviceError) throw deviceError
  if (!device) throw new Error('Za ovu sobu nije povezan TV.')

  const lastSeen = device.last_seen_at ? Date.parse(device.last_seen_at) : 0
  const isRecentlySeen = lastSeen > Date.now() - 120000
  if (device.status === 'offline' || !isRecentlySeen) throw new Error('TV trenutno nije povezan.')

  const { data: command, error: commandError } = await supabase
    .from('tv_commands')
    .insert({
      hotel_id: hotelId,
      tv_device_id: device.id,
      command_type: 'OPEN_POWER_TV',
      payload: {},
      status: 'pending',
      sent_by: 'admin-web',
    })
    .select('id, status')
    .single()

  if (commandError) throw commandError
  return { ...command, deviceId: device.device_id }
}

export async function subscribeToCommand(commandId, onChange) {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`tv-command-${commandId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tv_commands',
      filter: `id=eq.${commandId}`,
    }, (payload) => onChange(payload.new))

  await channel.subscribe()
  return () => supabase.removeChannel(channel)
}

export async function loadModuleEntries(moduleName) {
  if (!supabase) {
    const data = await storage.get(`${STORAGE_KEYS.module}${moduleName}`, true)
    return data && data.value ? JSON.parse(data.value) : []
  }

  const hotelId = await getHotelId()

  const { data, error } = await supabase
    .from('admin_form_entries')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('module_name', moduleName)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    description: row.description || '',
    image: row.image_url || '',
    name: row.name || '',
    value: row.value || '',
    created_at: row.created_at,
  }))
}

export async function saveModuleEntries(moduleName, entries) {
  if (!supabase) {
    await storage.set(`${STORAGE_KEYS.module}${moduleName}`, JSON.stringify(entries), true)
    return
  }

  const hotelId = await getHotelId()

  const currentRows = await supabase
    .from('admin_form_entries')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('module_name', moduleName)

  if (currentRows.error) throw currentRows.error

  const ids = currentRows.data.map((row) => row.id)

  const upserts = entries.map((entry, index) => ({
    id: entry.id || crypto.randomUUID(),
    hotel_id: hotelId,
    module_name: moduleName,
    title: entry.title || null,
    subtitle: entry.subtitle || null,
    description: entry.description || null,
    image_url: entry.image || null,
    name: entry.name || null,
    value: entry.value || null,
    sort_order: index,
  }))

  if (upserts.length) {
    const { error } = await supabase.from('admin_form_entries').upsert(upserts, { onConflict: 'id' })
    if (error) throw error
  }

  for (const oldId of ids) {
    if (!entries.some((entry) => entry.id === oldId)) {
      const { error } = await supabase.from('admin_form_entries').delete().eq('id', oldId)
      if (error) throw error
    }
  }
}

export async function loadBookings() {
  if (!supabase) {
    const data = await storage.get(STORAGE_KEYS.bookings, true)
    return data && data.value ? JSON.parse(data.value) : []
  }

  const hotelId = await getHotelId()

  const { data, error } = await supabase
    .from('guest_bookings')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('check_in', { ascending: true })

  if (error) throw error

  return (data || []).map((row) => ({
    id: row.id,
    guestName: row.guest_name,
    room: row.room,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
  }))
}

export async function saveBookings(entries) {
  if (!supabase) {
    await storage.set(STORAGE_KEYS.bookings, JSON.stringify(entries), true)
    return
  }

  const hotelId = await getHotelId()

  const existing = await supabase.from('guest_bookings').select('id').eq('hotel_id', hotelId)
  if (existing.error) throw existing.error

  const ids = existing.data.map((row) => row.id)

  const upserts = entries.map((entry) => ({
    id: entry.id || crypto.randomUUID(),
    hotel_id: hotelId,
    guest_name: entry.guestName,
    room: entry.room,
    check_in: entry.checkIn,
    check_out: entry.checkOut,
    status: entry.status || 'upcoming',
  }))

  if (upserts.length) {
    const { error } = await supabase.from('guest_bookings').upsert(upserts, { onConflict: 'id' })
    if (error) throw error
  }

  for (const oldId of ids) {
    if (!entries.some((entry) => entry.id === oldId)) {
      const { error } = await supabase.from('guest_bookings').delete().eq('id', oldId)
      if (error) throw error
    }
  }
}
