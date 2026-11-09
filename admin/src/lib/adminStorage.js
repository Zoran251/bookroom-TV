import { supabase } from './supabase.js'

function getAdminIdentity(username) {
  const normalizedUsername = username.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername)) {
    throw new Error('Korisničko ime mora imati 3-32 znaka: slova, brojevi, tačka, crtica ili donja crta.')
  }
  return `${normalizedUsername}@admins.bookroom.local`
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function assertSupabaseConfig() {
  if (!supabase) {
    throw new Error('Supabase konfiguracija nije validna. Provjeri VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY u .env datoteci.')
  }
}

function getTvPairingCode() {
  const bridge = typeof window !== 'undefined' ? window.HotelTvAndroid : null
  if (!bridge || typeof bridge.getPairingCode !== 'function') return null

  const code = bridge.getPairingCode().trim().toLowerCase()
  return /^[0-9a-f]{32}$/.test(code) ? code : null
}

async function hashTvPairingCode(code) {
  const bytes = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

let tvConsoleDataCache = null
let tvConsoleDataCacheTime = 0

async function loadTvConsoleData() {
  assertSupabaseConfig()
  const code = getTvPairingCode()
  if (!code) throw new Error('TV nije uparen. Unesite kod za uparivanje na TV-u.')

  if (tvConsoleDataCache && Date.now() - tvConsoleDataCacheTime < 5000) {
    return tvConsoleDataCache
  }

  const codeHash = await hashTvPairingCode(code)
  const { data, error } = await supabase.rpc('get_tv_console_data', {
    pairing_code_hash: codeHash,
  })
  if (error || !data || !data.hotel) {
    const bridge = typeof window !== 'undefined' ? window.HotelTvAndroid : null
    bridge?.showPairingError?.('TV nije povezan s hotelskim podacima. Provjeri internet, kod za uparivanje i Supabase migraciju.')
    throw error || new Error('Kod za uparivanje nije važeći ili je opozvan.')
  }

  tvConsoleDataCache = data
  tvConsoleDataCacheTime = Date.now()
  return data
}

function generateTvPairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export async function createTvPairing(roomNumber) {
  assertSupabaseConfig()
  const room = roomNumber.trim()
  if (!room) throw new Error('Broj sobe je obavezan.')

  const hotelId = await getHotelId()
  const code = generateTvPairingCode()
  const codeHash = await hashTvPairingCode(code.toLowerCase())
  const { data, error } = await supabase
    .from('tv_console_pairings')
    .insert({
      hotel_id: hotelId,
      room_number: room,
      code_hash: codeHash,
    })
    .select('id, room_number, created_at')
    .single()

  if (error) throw error
  return { ...data, code }
}

export async function loadTvPairings() {
  assertSupabaseConfig()
  const hotelId = await getHotelId()
  const { data, error } = await supabase
    .from('tv_console_pairings')
    .select('id, room_number, created_at, revoked_at')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function revokeTvPairing(pairingId) {
  assertSupabaseConfig()
  const hotelId = await getHotelId()
  const { error } = await supabase
    .from('tv_console_pairings')
    .update({ revoked_at: new Date().toISOString() })
    .eq('hotel_id', hotelId)
    .eq('id', pairingId)
    .is('revoked_at', null)

  if (error) throw error
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
  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return data.hotel
  }

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
  assertSupabaseConfig()

  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return (data.entries || [])
      .filter((entry) => entry.module_name === moduleName)
      .map((row) => ({
        id: row.id,
        title: row.title || '',
        subtitle: row.subtitle || '',
        description: row.description || '',
        image: row.image_url || '',
        images: Array.isArray(row.images) ? row.images : (row.image_url ? [row.image_url] : []),
        location: row.location || '',
        links: Array.isArray(row.links) ? row.links : [],
        name: row.name || '',
        value: row.value || '',
        created_at: row.created_at,
      }))
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
    images: Array.isArray(row.images) ? row.images : (row.image_url ? [row.image_url] : []),
    location: row.location || '',
    links: Array.isArray(row.links) ? row.links : [],
    name: row.name || '',
    value: row.value || '',
    created_at: row.created_at,
  }))
}

export async function saveModuleEntries(moduleName, entries) {
  assertSupabaseConfig()

  const hotelId = await getHotelId()

  const currentRows = await supabase
    .from('admin_form_entries')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('module_name', moduleName)

  if (currentRows.error) throw currentRows.error

  const ids = currentRows.data.map((row) => row.id)

  const upserts = entries.map((entry, index) => ({
    id: isUuid(entry.id) ? entry.id : crypto.randomUUID(),
    hotel_id: hotelId,
    module_name: moduleName,
    title: entry.title || null,
    subtitle: entry.subtitle || null,
    description: entry.description || null,
    image_url: entry.image || (Array.isArray(entry.images) ? entry.images[0] : null) || null,
    images: Array.isArray(entry.images) ? entry.images : (entry.image ? [entry.image] : []),
    location: entry.location || null,
    links: Array.isArray(entry.links) ? entry.links : [],
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
  assertSupabaseConfig()

  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return data.booking ? [{
      id: data.booking.id,
      guestName: data.booking.guest_name,
      room: data.booking.room,
      checkIn: data.booking.check_in,
      checkOut: data.booking.check_out,
      status: data.booking.status,
    }] : []
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
  assertSupabaseConfig()

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
