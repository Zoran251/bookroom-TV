import { supabase } from './supabase.js'

const LOCAL_STORE_KEY = 'bookroom_tv_local_store_v1'
const TRANSLATION_BACKUP_KEY = 'bookroom_tv_translations_backup_v1'
const SYNC_CHANNEL_NAME = 'bookroom-tv-sync'
let memoryStore = null

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function todayIso(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000)
  return date.toISOString().slice(0, 10)
}

function notifyTvSync(reason = 'update') {
  if (typeof window === 'undefined') return
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
      channel.postMessage({ reason, timestamp: Date.now() })
      channel.close()
    }
  } catch {
    // ignore BroadcastChannel failures
  }
  try {
    window.localStorage?.setItem('bookroom_tv_last_sync', String(Date.now()))
  } catch {
    // ignore storage errors
  }
}

function readTranslationBackup() {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    const raw = window.localStorage.getItem(TRANSLATION_BACKUP_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeTranslationBackup(key, translations) {
  if (typeof window === 'undefined' || !window.localStorage || !key || !translations) return
  try {
    const current = readTranslationBackup()
    current[key] = translations
    window.localStorage.setItem(TRANSLATION_BACKUP_KEY, JSON.stringify(current))
  } catch {
    // ignore quota errors
  }
}

function computeTranslationSignature(fields) {
  const normalized = {}
  for (const key of Object.keys(fields).sort()) {
    const val = typeof fields[key] === 'string' ? fields[key].trim() : ''
    if (val) normalized[key] = val
  }
  return JSON.stringify(normalized)
}

function hasCompleteTranslations(translations, sig) {
  if (!translations || typeof translations !== 'object') return false
  if (translations._source !== sig) return false
  return Boolean(translations.en && translations.de && translations.it)
}

function extractHotelTranslatableFields(values) {
  const fields = {}
  if (typeof values.welcomeText === 'string' && values.welcomeText.trim()) {
    fields.welcome_text = values.welcomeText.trim()
  } else if (typeof values.welcome_text === 'string' && values.welcome_text.trim()) {
    fields.welcome_text = values.welcome_text.trim()
  }
  if (typeof values.city === 'string' && values.city.trim()) {
    fields.city = values.city.trim()
  }
  return fields
}

function extractEntryTranslatableFields(moduleName, entry) {
  const fields = {}
  if (moduleName === 'tv' || moduleName === 'radio') {
    if (typeof entry.value === 'string' && entry.value.trim() && !/^\d+$/.test(entry.value.trim())) {
      fields.value = entry.value.trim()
    }
    return fields
  }

  for (const key of ['title', 'subtitle', 'description', 'location', 'notes']) {
    if (typeof entry[key] === 'string' && entry[key].trim()) {
      fields[key] = entry[key].trim()
    }
  }
  return fields
}

export async function translateBatch(items) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || `Prevod nije uspio (HTTP ${response.status}).`)
  }
  if (!Array.isArray(payload.translations)) {
    throw new Error('Server nije vratio validan prevod.')
  }
  return payload.translations
}

export async function translateEntriesOnDemand(items) {
  const results = await translateBatch(items)
  return results
}

function createDefaultLocalStore() {
  const hotelId = 'hotel-villa-aura'
  const accountId = 'admin-villa-aura'
  return {
    sessionUserId: null,
    activeHotelId: hotelId,
    hotels: [
      {
        id: hotelId,
        name: 'Villa Aura',
        city: 'Sarajevo',
        welcome_text: 'Dobrodošli u Villa Aura — želimo vam ugodan boravak.',
        phone: '+387 33 555 210',
        email: 'info@villaaura.ba',
        translations: {
          _source: '{"city":"Sarajevo","welcome_text":"Dobrodošli u Villa Aura — želimo vam ugodan boravak."}',
          en: { city: 'Sarajevo', welcome_text: 'Welcome to Villa Aura — we wish you a pleasant stay.' },
          de: { city: 'Sarajevo', welcome_text: 'Willkommen in der Villa Aura — wir wünschen Ihnen einen angenehmen Aufenthalt.' },
          it: { city: 'Sarajevo', welcome_text: 'Benvenuti a Villa Aura — vi auguriamo un piacevole soggiorno.' },
        },
      },
    ],
    accounts: [
      {
        id: accountId,
        username: 'villaaura',
        pin: '123456',
        hotelId,
      },
    ],
    entries: {
      [hotelId]: {
        hotelinfo: [
          {
            id: createId(),
            title: 'Recepcija i boravak',
            subtitle: 'Prijava od 14:00 • Odjava do 11:00',
            description: 'Recepcija je dostupna 24 sata dnevno na lokalu 9. Besplatan Wi-Fi je aktivan u cijelom hotelu.',
            image: '',
            images: [],
            location: 'Glavni lobi, prizemlje',
            links: [],
            translations: {
              _source: '{"description":"Recepcija je dostupna 24 sata dnevno na lokalu 9. Besplatan Wi-Fi je aktivan u cijelom hotelu.","location":"Glavni lobi, prizemlje","subtitle":"Prijava od 14:00 • Odjava do 11:00","title":"Recepcija i boravak"}',
              en: {
                title: 'Reception & Stay',
                subtitle: 'Check-in from 14:00 • Check-out until 11:00',
                description: 'Reception is available 24 hours a day on extension 9. Free Wi-Fi is active throughout the hotel.',
                location: 'Main lobby, ground floor',
              },
              de: {
                title: 'Rezeption & Aufenthalt',
                subtitle: 'Check-in ab 14:00 • Check-out bis 11:00',
                description: 'Die Rezeption ist rund um die Uhr unter der Durchwahl 9 erreichbar. Kostenloses WLAN steht im gesamten Hotel zur Verfügung.',
                location: 'Hauptlobby, Erdgeschoss',
              },
              it: {
                title: 'Reception e Soggiorno',
                subtitle: 'Check-in dalle 14:00 • Check-out fino alle 11:00',
                description: 'La reception è disponibile 24 ore su 24 all\'interno 9. Il Wi-Fi gratuito è attivo in tutto l\'hotel.',
                location: 'Lobby principale, piano terra',
              },
            },
          },
        ],
        marketing: [
          {
            id: createId(),
            title: 'Wellness vikend ponuda',
            subtitle: 'Image',
            description: 'Rezervišite paket masaže i saune uz 20% popusta za goste hotela.',
            image: '',
            images: [],
            location: '',
            links: [],
            mediaType: 'Image',
            url: '',
            notes: 'Rezervišite paket masaže i saune uz 20% popusta za goste hotela.',
            translations: {
              _source: '{"description":"Rezervišite paket masaže i saune uz 20% popusta za goste hotela.","notes":"Rezervišite paket masaže i saune uz 20% popusta za goste hotela.","subtitle":"Image","title":"Wellness vikend ponuda"}',
              en: {
                title: 'Wellness Weekend Offer',
                subtitle: 'Image',
                description: 'Book a massage and sauna package with a 20% discount for hotel guests.',
                notes: 'Book a massage and sauna package with a 20% discount for hotel guests.',
              },
              de: {
                title: 'Wellness-Wochenendangebot',
                subtitle: 'Image',
                description: 'Buchen Sie ein Massage- und Saunapaket mit 20 % Rabatt für Hotelgäste.',
                notes: 'Buchen Sie ein Massage- und Saunapaket mit 20 % Rabatt für Hotelgäste.',
              },
              it: {
                title: 'Offerta Weekend Benessere',
                subtitle: 'Image',
                description: 'Prenota un pacchetto massaggio e sauna con il 20% di sconto per gli ospiti dell\'hotel.',
                notes: 'Prenota un pacchetto massaggio e sauna con il 20% di sconto per gli ospiti dell\'hotel.',
              },
            },
          },
        ],
        restorani: [
          {
            id: createId(),
            title: 'Restoran Panorama',
            subtitle: 'Otvoreno 07:00 – 22:30',
            description: 'Doručak na bazi švedskog stola i večernja ponuda domaćih i internacionalnih specijaliteta.',
            image: '',
            images: [],
            location: 'Krovna terasa, 5. sprat',
            links: [],
            translations: {
              _source: '{"description":"Doručak na bazi švedskog stola i večernja ponuda domaćih i internacionalnih specijaliteta.","location":"Krovna terasa, 5. sprat","subtitle":"Otvoreno 07:00 – 22:30","title":"Restoran Panorama"}',
              en: {
                title: 'Panorama Restaurant',
                subtitle: 'Open 07:00 – 22:30',
                description: 'Buffet breakfast and an evening selection of local and international specialties.',
                location: 'Rooftop terrace, 5th floor',
              },
              de: {
                title: 'Restaurant Panorama',
                subtitle: 'Geöffnet 07:00 – 22:30',
                description: 'Frühstücksbuffet und abendliche Auswahl an lokalen und internationalen Spezialitäten.',
                location: 'Dachterrasse, 5. Etage',
              },
              it: {
                title: 'Ristorante Panorama',
                subtitle: 'Aperto 07:00 – 22:30',
                description: 'Colazione a buffet e proposta serale di specialità locali e internazionali.',
                location: 'Terrazza panoramica, 5° piano',
              },
            },
          },
        ],
        wellness: [
          {
            id: createId(),
            title: 'Aura Spa & Sauna',
            subtitle: 'Svaki dan 09:00 – 21:00',
            description: 'Finska sauna, parna kupelj i personalizovani tretmani opuštanja.',
            image: '',
            images: [],
            location: 'Nivo -1',
            links: [],
            translations: {
              _source: '{"description":"Finska sauna, parna kupelj i personalizovani tretmani opuštanja.","location":"Nivo -1","subtitle":"Svaki dan 09:00 – 21:00","title":"Aura Spa & Sauna"}',
              en: {
                title: 'Aura Spa & Sauna',
                subtitle: 'Daily 09:00 – 21:00',
                description: 'Finnish sauna, steam bath, and personalized relaxation treatments.',
                location: 'Level -1',
              },
              de: {
                title: 'Aura Spa & Sauna',
                subtitle: 'Täglich 09:00 – 21:00',
                description: 'Finnische Sauna, Dampfbad und personalisierte Entspannungsbehandlungen.',
                location: 'Ebene -1',
              },
              it: {
                title: 'Aura Spa & Sauna',
                subtitle: 'Tutti i giorni 09:00 – 21:00',
                description: 'Sauna finlandese, bagno turco e trattamenti di relax personalizzati.',
                location: 'Livello -1',
              },
            },
          },
        ],
        sport: [
          {
            id: createId(),
            title: 'Fitness studio & Bicikli',
            subtitle: '24/7 pristup karticom sobe',
            description: 'Moderna teretana i mogućnost iznajmljivanja gradskih bicikala na recepciji.',
            image: '',
            images: [],
            location: 'Nivo -1',
            links: [],
            translations: {
              _source: '{"description":"Moderna teretana i mogućnost iznajmljivanja gradskih bicikala na recepciji.","location":"Nivo -1","subtitle":"24/7 pristup karticom sobe","title":"Fitness studio & Bicikli"}',
              en: {
                title: 'Fitness Studio & Bicycles',
                subtitle: '24/7 access with room key card',
                description: 'Modern gym and city bicycle rentals available at reception.',
                location: 'Level -1',
              },
              de: {
                title: 'Fitnessstudio & Fahrräder',
                subtitle: '24/7 Zugang mit Zimmerkarte',
                description: 'Modernes Fitnessstudio und Fahrradverleih an der Rezeption.',
                location: 'Ebene -1',
              },
              it: {
                title: 'Centro Fitness e Biciclette',
                subtitle: 'Accesso 24/7 con tessera della camera',
                description: 'Palestra moderna e noleggio biciclette da città presso la reception.',
                location: 'Livello -1',
              },
            },
          },
        ],
        okolica: [
          {
            id: createId(),
            title: 'Stari grad i žičara',
            subtitle: '10 minuta šetnje od hotela',
            description: 'Istražite historijsku jezgru grada, lokalne zanatske radnje i panoramski pogled s Trebevića.',
            image: '',
            images: [],
            location: 'Centar grada',
            links: [],
            translations: {
              _source: '{"description":"Istražite historijsku jezgru grada, lokalne zanatske radnje i panoramski pogled s Trebevića.","location":"Centar grada","subtitle":"10 minuta šetnje od hotela","title":"Stari grad i žičara"}',
              en: {
                title: 'Old Town & Cable Car',
                subtitle: '10 minutes walk from the hotel',
                description: 'Explore the historic city center, local artisan shops, and panoramic views from Trebević.',
                location: 'City center',
              },
              de: {
                title: 'Altstadt & Seilbahn',
                subtitle: '10 Gehminuten vom Hotel entfernt',
                description: 'Entdecken Sie die historische Altstadt, lokale Handwerksläden und den Panoramablick vom Trebević.',
                location: 'Stadtzentrum',
              },
              it: {
                title: 'Centro Storico e Funivia',
                subtitle: '10 minuti a piedi dall\'hotel',
                description: 'Esplorate il centro storico della città, le botteghe artigiane locali e la vista panoramica dal Trebević.',
                location: 'Centro città',
              },
            },
          },
        ],
        tv: [
          { id: createId(), name: 'BHT 1', value: '1', links: [], images: [] },
          { id: createId(), name: 'FTV', value: '2', links: [], images: [] },
          { id: createId(), name: 'N1', value: '3', links: [], images: [] },
          { id: createId(), name: 'Eurosport 1', value: '4', links: [], images: [] },
        ],
        radio: [
          {
            id: createId(),
            name: 'Naxi Cafe',
            value: 'Online stream',
            image: '',
            images: [],
            links: ['https://naxidigital-cafe128.streaming.rs:8022/'],
            translations: {
              _source: '{"value":"Online stream"}',
              en: { value: 'Online stream' },
              de: { value: 'Online-Stream' },
              it: { value: 'Streaming online' },
            },
          },
        ],
      },
    },
    bookings: {
      [hotelId]: [
        {
          id: createId(),
          guestName: 'Ana Petrović',
          room: '204',
          checkIn: todayIso(0),
          checkOut: todayIso(3),
          status: 'active',
        },
        {
          id: createId(),
          guestName: 'Marko Šimić',
          room: '315',
          checkIn: todayIso(2),
          checkOut: todayIso(5),
          status: 'upcoming',
        },
      ],
    },
    pairings: {
      [hotelId]: [],
    },
  }
}

function readLocalStore() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.hotels)) {
          memoryStore = parsed
          return parsed
        }
      }
    } catch {
      // ignore storage errors and fall back to memoryStore
    }
  }
  if (!memoryStore) {
    memoryStore = createDefaultLocalStore()
    writeLocalStore(memoryStore)
  }
  return memoryStore
}

function writeLocalStore(nextStore) {
  memoryStore = nextStore
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(nextStore))
    } catch {
      // ignore quota/private mode errors
    }
  }
}

function getLocalHotelId(store) {
  if (store.sessionUserId) {
    const account = store.accounts.find((item) => item.id === store.sessionUserId)
    if (account) return account.hotelId
  }
  return store.activeHotelId || store.hotels[0]?.id || null
}

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

const WEB_PAIRING_CODE_KEY = 'bookroom_tv_pairing_code'

function normalizePairingCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isValidPairingCode(value) {
  const normalized = normalizePairingCode(value)
  return normalized.length >= 4 && normalized.length <= 64
}

function normalizeRoomNumber(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isSupabaseConfigured() {
  return Boolean(supabase)
}

export function hasAndroidTvBridge() {
  const bridge = typeof window !== 'undefined' ? window.HotelTvAndroid : null
  return Boolean(bridge && typeof bridge.getPairingCode === 'function')
}

export function setWebTvPairingCode(code) {
  const normalized = normalizePairingCode(code)
  if (!isValidPairingCode(normalized)) {
    throw new Error('Lozinka / kod za uparivanje mora imati između 4 i 64 znaka.')
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(WEB_PAIRING_CODE_KEY, normalized)
  }
  tvConsoleDataCache = null
  tvConsoleDataCacheCode = ''
  tvConsoleDataCacheTime = 0
  return normalized
}

export function clearWebTvPairingCode() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(WEB_PAIRING_CODE_KEY)
  }
  tvConsoleDataCache = null
  tvConsoleDataCacheCode = ''
  tvConsoleDataCacheTime = 0
}

function getTvPairingCode() {
  if (typeof window === 'undefined') return null

  const bridge = window.HotelTvAndroid
  if (bridge && typeof bridge.getPairingCode === 'function') {
    const code = normalizePairingCode(bridge.getPairingCode())
    return isValidPairingCode(code) ? code : null
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('pairing') || params.get('code') || ''
    if (isValidPairingCode(fromUrl)) {
      const normalized = normalizePairingCode(fromUrl)
      window.localStorage?.setItem(WEB_PAIRING_CODE_KEY, normalized)
      params.delete('pairing')
      params.delete('code')
      const nextUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}${window.location.hash}`
      window.history?.replaceState?.({}, '', nextUrl)
      return normalized
    }
  } catch {
    // ignore URL / storage failures
  }

  try {
    const stored = normalizePairingCode(window.localStorage?.getItem(WEB_PAIRING_CODE_KEY) || '')
    return isValidPairingCode(stored) ? stored : null
  } catch {
    return null
  }
}

export function getCurrentTvPairingCode() {
  return getTvPairingCode()
}

async function hashTvPairingCode(code) {
  const bytes = new TextEncoder().encode(normalizePairingCode(code))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

let tvConsoleDataCache = null
let tvConsoleDataCacheCode = ''
let tvConsoleDataCacheTime = 0

function formatTvPairingErrorMessage(error, data) {
  const raw = String(error?.message || error?.details || '').toLowerCase()
  if (raw.includes('invalid or revoked tv pairing code') || raw.includes('invalid tv pairing code')) {
    return 'Kod ili lozinka za uparivanje nije ispravna ili je opozvana.'
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return 'Nema konekcije sa bazom podataka. Provjerite internet vezu na TV-u.'
  }
  if (raw.includes('function') && raw.includes('get_tv_console_data')) {
    return 'U Supabase bazi nedostaje migracija za TV uparivanje (get_tv_console_data).'
  }
  if (!error && (!data || !data.hotel)) {
    return 'Hotel za ovaj kod nije pronađen u bazi.'
  }
  return 'TV nije povezan s hotelskim podacima. Provjeri internet, kod za uparivanje i Supabase migraciju.'
}

async function loadTvConsoleData(forceRefresh = false, { silentOnError = false } = {}) {
  const code = getTvPairingCode()
  if (!code) throw new Error('TV nije uparen. Unesite kod ili lozinku za uparivanje na TV-u.')

  if (!supabase) {
    const store = readLocalStore()
    const codeHash = await hashTvPairingCode(code)
    for (const [hotelId, list] of Object.entries(store.pairings || {})) {
      const pairing = list.find((item) => item.code_hash === codeHash && !item.revoked_at)
      if (pairing) {
        const hotel = store.hotels.find((h) => h.id === hotelId) || null
        const entriesByMod = store.entries[hotelId] || {}
        const entries = Object.entries(entriesByMod).flatMap(([moduleName, rows]) =>
          rows.map((row) => ({ ...row, module_name: moduleName })),
        )
        const today = todayIso(0)
        const booking = (store.bookings[hotelId] || []).find(
          (b) =>
            normalizeRoomNumber(b.room) === normalizeRoomNumber(pairing.room_number) &&
            b.checkIn <= today &&
            b.checkOut >= today,
        ) || null
        return { room: pairing.room_number, hotel, entries, booking }
      }
    }
    const msg = 'Kod ili lozinka za uparivanje nije važeća ili je opozvana.'
    if (!silentOnError) {
      const bridge = typeof window !== 'undefined' ? window.HotelTvAndroid : null
      bridge?.showPairingError?.(msg)
    }
    throw new Error(msg)
  }

  if (
    !forceRefresh &&
    tvConsoleDataCache &&
    tvConsoleDataCacheCode === code &&
    Date.now() - tvConsoleDataCacheTime < 4000
  ) {
    return tvConsoleDataCache
  }

  const codeHash = await hashTvPairingCode(code)
  const { data, error } = await supabase.rpc('get_tv_console_data', {
    pairing_code_hash: codeHash,
  })
  if (error || !data || !data.hotel) {
    const friendlyMessage = formatTvPairingErrorMessage(error, data)
    const raw = String(error?.message || '').toLowerCase()
    const isCodeInvalid = raw.includes('invalid or revoked tv pairing code') || raw.includes('invalid tv pairing code')
    if (!silentOnError || isCodeInvalid) {
      const bridge = typeof window !== 'undefined' ? window.HotelTvAndroid : null
      bridge?.showPairingError?.(friendlyMessage)
    }
    throw new Error(friendlyMessage)
  }

  tvConsoleDataCache = data
  tvConsoleDataCacheCode = code
  tvConsoleDataCacheTime = Date.now()
  return data
}

function generateTvPairingCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function isMissingTranslationsColumnError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  return error?.code === '42703' || msg.includes('translations')
}

async function prepareHotelTranslations(values, existingTranslations) {
  const fields = extractHotelTranslatableFields(values)
  const sig = computeTranslationSignature(fields)
  if (!Object.keys(fields).length) {
    return { translations: { _source: sig, en: {}, de: {}, it: {} }, translationError: null }
  }
  if (hasCompleteTranslations(existingTranslations, sig)) {
    return { translations: existingTranslations, translationError: null }
  }
  try {
    const [translated] = await translateBatch([{ fields }])
    return {
      translations: {
        _source: sig,
        en: translated?.en || {},
        de: translated?.de || {},
        it: translated?.it || {},
      },
      translationError: null,
    }
  } catch (error) {
    return {
      translations: existingTranslations || null,
      translationError: error instanceof Error ? error.message : 'Prevod nije uspio.',
    }
  }
}

async function prepareModuleEntryTranslations(moduleName, entries, existingById) {
  const prepared = entries.map((entry) => {
    const fields = extractEntryTranslatableFields(moduleName, entry)
    const sig = computeTranslationSignature(fields)
    const existingTranslations = entry.translations || existingById.get(entry.id)?.translations || null
    const needsTranslation = Object.keys(fields).length > 0 && !hasCompleteTranslations(existingTranslations, sig)
    return { entry, fields, sig, existingTranslations, needsTranslation }
  })

  const toTranslate = prepared.filter((item) => item.needsTranslation)
  let translationError = null

  if (toTranslate.length > 0) {
    try {
      const results = await translateBatch(
        toTranslate.map((item, idx) => ({ id: item.entry.id || String(idx), fields: item.fields })),
      )
      toTranslate.forEach((item, idx) => {
        const res = results[idx]
        item.nextTranslations = {
          _source: item.sig,
          en: res?.en || {},
          de: res?.de || {},
          it: res?.it || {},
        }
      })
    } catch (error) {
      translationError = error instanceof Error ? error.message : 'Prevod nije uspio.'
    }
  }

  const nextEntries = prepared.map((item) => {
    let translations = item.existingTranslations
    if (Object.keys(item.fields).length === 0) {
      translations = { _source: item.sig, en: {}, de: {}, it: {} }
    } else if (item.nextTranslations) {
      translations = item.nextTranslations
    }
    return {
      ...item.entry,
      translations: translations || {},
    }
  })

  return { entries: nextEntries, translationError }
}

export async function createTvPairing(roomNumber, customCode = '') {
  const room = roomNumber.trim()
  if (!room) throw new Error('Broj sobe je obavezan.')

  const rawCustom = typeof customCode === 'string' ? customCode.trim() : ''
  if (rawCustom && !isValidPairingCode(rawCustom)) {
    throw new Error('Lozinka / kod za uparivanje mora imati između 4 i 64 znaka.')
  }

  const code = rawCustom || generateTvPairingCode()
  const codeHash = await hashTvPairingCode(code)

  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    const duplicate = Object.values(store.pairings || {})
      .flat()
      .some((item) => item.code_hash === codeHash && !item.revoked_at)
    if (duplicate) {
      throw new Error('Ova lozinka / kod za uparivanje je već zauzeta. Unesite drugu lozinku.')
    }
    const pairing = {
      id: createId(),
      hotel_id: hotelId,
      room_number: room,
      code_hash: codeHash,
      created_at: new Date().toISOString(),
      revoked_at: null,
    }
    store.pairings[hotelId] = [pairing, ...(store.pairings[hotelId] || [])]
    writeLocalStore(store)
    return {
      id: pairing.id,
      room_number: pairing.room_number,
      created_at: pairing.created_at,
      code,
      isCustom: Boolean(rawCustom),
    }
  }

  const hotelId = await getHotelId()
  const { data, error } = await supabase
    .from('tv_console_pairings')
    .insert({
      hotel_id: hotelId,
      room_number: room,
      code_hash: codeHash,
    })
    .select('id, room_number, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ova lozinka / kod za uparivanje je već zauzeta. Dodajte npr. naziv hotela ili drugi broj.')
    }
    throw error
  }
  return { ...data, code, isCustom: Boolean(rawCustom) }
}

export async function loadTvPairings() {
  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    return (store.pairings[hotelId] || []).map(({ id, room_number, created_at, revoked_at }) => ({
      id,
      room_number,
      created_at,
      revoked_at,
    }))
  }

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
  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    const list = store.pairings[hotelId] || []
    store.pairings[hotelId] = list.map((item) =>
      item.id === pairingId && !item.revoked_at
        ? { ...item, revoked_at: new Date().toISOString() }
        : item,
    )
    writeLocalStore(store)
    return
  }

  const hotelId = await getHotelId()
  const { error } = await supabase
    .from('tv_console_pairings')
    .update({ revoked_at: new Date().toISOString() })
    .eq('hotel_id', hotelId)
    .eq('id', pairingId)
    .is('revoked_at', null)

  if (error) throw error
}

export async function deleteTvPairing(pairingId) {
  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    store.pairings[hotelId] = (store.pairings[hotelId] || []).filter((item) => item.id !== pairingId)
    writeLocalStore(store)
    return
  }

  const hotelId = await getHotelId()
  const { error } = await supabase
    .from('tv_console_pairings')
    .delete()
    .eq('hotel_id', hotelId)
    .eq('id', pairingId)

  if (error) throw error
}

export async function signInAdmin(username, pin) {
  const email = getAdminIdentity(username)
  if (!supabase) {
    const store = readLocalStore()
    const normalized = username.trim().toLowerCase()
    const account = store.accounts.find((item) => item.username === normalized && item.pin === pin)
    if (!account) {
      throw new Error('Pogrešno korisničko ime ili PIN.')
    }
    store.sessionUserId = account.id
    store.activeHotelId = account.hotelId
    writeLocalStore(store)
    notifyTvSync('auth')
    return { id: account.id, email }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pin,
  })
  if (error) throw error
  return data.user
}

export async function signUpAdmin({ username, pin, hotelName, city }) {
  const email = getAdminIdentity(username)
  const normalized = username.trim().toLowerCase()

  if (!supabase) {
    const store = readLocalStore()
    if (store.accounts.some((item) => item.username === normalized)) {
      throw new Error('Korisničko ime je već registrovano.')
    }
    const hotelId = createId()
    const accountId = createId()
    const welcomeText = `Dobrodošli u ${hotelName}.`
    const { translations } = await prepareHotelTranslations({ welcomeText, city: city || '' }, null)
    store.hotels.push({
      id: hotelId,
      name: hotelName,
      city: city || '',
      welcome_text: welcomeText,
      phone: '',
      email: '',
      translations: translations || {},
    })
    store.accounts.push({
      id: accountId,
      username: normalized,
      pin,
      hotelId,
    })
    store.entries[hotelId] = {}
    store.bookings[hotelId] = []
    store.pairings[hotelId] = []
    store.activeHotelId = hotelId
    writeLocalStore(store)
    notifyTvSync('signup')
    return { user: { id: accountId, email } }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pin,
    options: {
      data: {
        admin_username: normalized,
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
  if (!supabase) {
    const store = readLocalStore()
    store.sessionUserId = null
    writeLocalStore(store)
    return
  }
  await supabase.auth.signOut()
}

export async function getAdminContext() {
  if (!supabase) {
    const store = readLocalStore()
    if (!store.sessionUserId) return null
    const account = store.accounts.find((item) => item.id === store.sessionUserId)
    if (!account) return null
    const hotel = store.hotels.find((item) => item.id === account.hotelId) || null
    if (!hotel) return null
    return {
      user: { id: account.id, email: `${account.username}@admins.bookroom.local` },
      hotelId: hotel.id,
      hotel,
    }
  }

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
  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return data.hotel
  }

  if (!supabase) {
    const store = readLocalStore()
    const hotelId = getLocalHotelId(store)
    return store.hotels.find((item) => item.id === hotelId) || null
  }

  const hotelId = await getHotelId()
  const backup = readTranslationBackup()
  let data = null
  let error = null

  ;({ data, error } = await supabase
    .from('hotels')
    .select('id, name, city, welcome_text, phone, email, translations')
    .eq('id', hotelId)
    .single())

  if (error && isMissingTranslationsColumnError(error)) {
    ;({ data, error } = await supabase
      .from('hotels')
      .select('id, name, city, welcome_text, phone, email')
      .eq('id', hotelId)
      .single())
  }

  if (error) throw error

  const { error: accountError } = await supabase
    .from('admin_hotel_accounts')
    .update({ hotel_name: data.name, city: data.city })
    .eq('hotel_id', hotelId)
  if (accountError) throw accountError

  return {
    ...data,
    translations: data.translations || backup[`hotel:${hotelId}`] || null,
  }
}

export async function saveHotelHeader(values) {
  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    const hotelIndex = store.hotels.findIndex((item) => item.id === hotelId)
    if (hotelIndex < 0) throw new Error('Hotel nije pronađen.')
    const existing = store.hotels[hotelIndex]
    const { translations, translationError } = await prepareHotelTranslations(values, existing.translations)
    const updated = {
      ...existing,
      name: values.name,
      city: values.city || null,
      welcome_text: values.welcomeText || null,
      phone: values.phone || null,
      email: values.email || null,
      translations: translations || existing.translations || {},
    }
    store.hotels[hotelIndex] = updated
    writeLocalStore(store)
    notifyTvSync('hotel_header')
    return { ...updated, translationError }
  }

  const hotelId = await getHotelId()
  const existing = await loadHotelHeader().catch(() => null)
  const { translations, translationError } = await prepareHotelTranslations(values, existing?.translations)
  if (translations) writeTranslationBackup(`hotel:${hotelId}`, translations)

  const basePayload = {
    name: values.name,
    city: values.city || null,
    welcome_text: values.welcomeText || null,
    phone: values.phone || null,
    email: values.email || null,
  }

  let data = null
  let error = null
  ;({ data, error } = await supabase
    .from('hotels')
    .update({ ...basePayload, translations: translations || {} })
    .eq('id', hotelId)
    .select('id, name, city, welcome_text, phone, email, translations')
    .single())

  if (error && isMissingTranslationsColumnError(error)) {
    ;({ data, error } = await supabase
      .from('hotels')
      .update(basePayload)
      .eq('id', hotelId)
      .select('id, name, city, welcome_text, phone, email')
      .single())
  }

  if (error) throw error
  notifyTvSync('hotel_header')
  return { ...data, translations: data.translations || translations || null, translationError }
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
      } catch {
        return { value: null }
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
  }
}

const storage = (typeof window !== 'undefined' && window.storage) || getFallbackStorage()

export function getStorageApi() {
  return storage
}

export async function sendPowerTvCommand(roomNumber) {
  if (!supabase) {
    await getHotelId()
    return {
      id: createId(),
      status: 'pending',
      deviceId: `local-tv-${roomNumber || 'room'}`,
    }
  }

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
  if (!supabase) {
    const timer = setTimeout(() => {
      onChange({ id: commandId, status: 'completed' })
    }, 500)
    return () => clearTimeout(timer)
  }

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
  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return (data.entries || [])
      .filter((entry) => entry.module_name === moduleName)
      .map((row) => ({
        id: row.id,
        title: row.title || '',
        subtitle: row.subtitle || '',
        description: row.description || '',
        image: row.image_url || row.image || '',
        images: Array.isArray(row.images) ? row.images : (row.image_url || row.image ? [row.image_url || row.image] : []),
        location: row.location || '',
        links: Array.isArray(row.links) ? row.links : [],
        name: row.name || '',
        value: row.value || '',
        translations: row.translations || null,
        created_at: row.created_at,
      }))
  }

  if (!supabase) {
    const store = readLocalStore()
    const hotelId = getLocalHotelId(store)
    const entries = store.entries[hotelId]?.[moduleName] || []
    return entries.map((entry) => ({ ...entry }))
  }

  const hotelId = await getHotelId()
  const backup = readTranslationBackup()

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
    translations: row.translations || backup[`entry:${row.id}`] || null,
    created_at: row.created_at,
  }))
}

export async function saveModuleEntries(moduleName, entries) {
  if (!supabase) {
    const store = readLocalStore()
    const hotelId = await getHotelId()
    const existingList = store.entries[hotelId]?.[moduleName] || []
    const existingById = new Map(existingList.map((item) => [item.id, item]))
    const normalized = entries.map((entry) => ({ ...entry, id: entry.id || createId() }))
    const { entries: translatedEntries, translationError } = await prepareModuleEntryTranslations(
      moduleName,
      normalized,
      existingById,
    )
    if (!store.entries[hotelId]) store.entries[hotelId] = {}
    store.entries[hotelId][moduleName] = translatedEntries
    writeLocalStore(store)
    notifyTvSync(`module:${moduleName}`)
    return { entries: translatedEntries, translationError }
  }

  const hotelId = await getHotelId()

  const currentRows = await supabase
    .from('admin_form_entries')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('module_name', moduleName)

  if (currentRows.error) throw currentRows.error

  const ids = currentRows.data.map((row) => row.id)
  const existingById = new Map(currentRows.data.map((row) => [row.id, row]))
  const normalized = entries.map((entry) => ({
    ...entry,
    id: isUuid(entry.id) ? entry.id : crypto.randomUUID(),
  }))

  const { entries: translatedEntries, translationError } = await prepareModuleEntryTranslations(
    moduleName,
    normalized,
    existingById,
  )

  for (const entry of translatedEntries) {
    if (entry.translations) writeTranslationBackup(`entry:${entry.id}`, entry.translations)
  }

  const upserts = translatedEntries.map((entry, index) => ({
    id: entry.id,
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
    translations: entry.translations || {},
    sort_order: index,
  }))

  if (upserts.length) {
    let { error } = await supabase.from('admin_form_entries').upsert(upserts, { onConflict: 'id' })
    if (error && isMissingTranslationsColumnError(error)) {
      const upsertsWithoutTranslations = upserts.map(({ translations: _omit, ...rest }) => rest)
      ;({ error } = await supabase.from('admin_form_entries').upsert(upsertsWithoutTranslations, { onConflict: 'id' }))
    }
    if (error) throw error
  }

  for (const oldId of ids) {
    if (!translatedEntries.some((entry) => entry.id === oldId)) {
      const { error } = await supabase.from('admin_form_entries').delete().eq('id', oldId)
      if (error) throw error
    }
  }

  notifyTvSync(`module:${moduleName}`)
  return { entries: translatedEntries, translationError }
}

export async function loadTvRoom() {
  if (!getTvPairingCode()) return ''
  const data = await loadTvConsoleData()
  return data.room || data.booking?.room || ''
}

export async function loadBookings() {
  if (getTvPairingCode()) {
    const data = await loadTvConsoleData()
    return data.booking ? [{
      id: data.booking.id,
      guestName: data.booking.guest_name || data.booking.guestName,
      room: data.booking.room,
      checkIn: data.booking.check_in || data.booking.checkIn,
      checkOut: data.booking.check_out || data.booking.checkOut,
      status: data.booking.status,
    }] : []
  }

  if (!supabase) {
    const store = readLocalStore()
    const hotelId = getLocalHotelId(store)
    return (store.bookings[hotelId] || []).map((row) => ({ ...row }))
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
    const store = readLocalStore()
    const hotelId = await getHotelId()
    store.bookings[hotelId] = entries.map((entry) => ({
      ...entry,
      id: entry.id || createId(),
    }))
    writeLocalStore(store)
    notifyTvSync('bookings')
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

  notifyTvSync('bookings')
}

export function subscribeToHotelUpdates(onUpdate) {
  const cleanups = []

  if (typeof window !== 'undefined') {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(SYNC_CHANNEL_NAME)
        bc.onmessage = () => onUpdate()
        cleanups.push(() => bc.close())
      } catch {
        // ignore BroadcastChannel failures
      }
    }

    const onStorage = (event) => {
      if (event.key === LOCAL_STORE_KEY || event.key === 'bookroom_tv_last_sync') {
        onUpdate()
      }
    }
    window.addEventListener('storage', onStorage)
    cleanups.push(() => window.removeEventListener('storage', onStorage))
  }

  if (supabase && !getTvPairingCode()) {
    let channel = null
    let cancelled = false

    getHotelId()
      .then((hotelId) => {
        if (cancelled || !hotelId) return
        channel = supabase
          .channel(`hotel-tv-live-${hotelId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'admin_form_entries',
            filter: `hotel_id=eq.${hotelId}`,
          }, () => onUpdate())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'hotels',
            filter: `id=eq.${hotelId}`,
          }, () => onUpdate())
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'guest_bookings',
            filter: `hotel_id=eq.${hotelId}`,
          }, () => onUpdate())

        channel.subscribe()
      })
      .catch(() => {
        // fallback polling continues
      })

    cleanups.push(() => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    })
  }

  const pollMs = supabase && getTvPairingCode() ? 5000 : 15000
  let lastSnapshotHash = ''
  const timer = setInterval(async () => {
    if (supabase && getTvPairingCode()) {
      try {
        const fresh = await loadTvConsoleData(true, { silentOnError: true })
        const snapshotHash = JSON.stringify(fresh)
        if (snapshotHash !== lastSnapshotHash) {
          lastSnapshotHash = snapshotHash
          onUpdate()
        }
      } catch {
        // ignore transient polling error
      }
    } else if (supabase) {
      onUpdate()
    }
  }, pollMs)

  cleanups.push(() => clearInterval(timer))

  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup()
      } catch {
        // ignore cleanup error
      }
    }
  }
}
