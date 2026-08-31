import { useMemo, useState } from 'react'
import './App.css'

const initialContent = [
  {
    id: 1,
    title: 'Restaurant Panorama',
    subtitle: 'Open daily 07:00 – 22:00',
    description: 'Signature dining with local dishes and sunset terrace service.',
    status: 'Published',
  },
  {
    id: 2,
    title: 'Wellness Ritual',
    subtitle: 'Massage, sauna and recovery',
    description: 'Three treatment packages available for guests staying 2+ nights.',
    status: 'Draft',
  },
  {
    id: 3,
    title: 'Local Guide',
    subtitle: 'Top activities nearby',
    description: 'Recommended hiking, city tours and marina experiences.',
    status: 'Published',
  },
]

const initialRooms = [
  { id: 1, number: '101', type: 'Deluxe', status: 'Occupied', price: '€220/night' },
  { id: 2, number: '204', type: 'Sea View', status: 'Available', price: '€260/night' },
  { id: 3, number: '315', type: 'Suite', status: 'Maintenance', price: '€340/night' },
]

const initialGuests = [
  { id: 1, name: 'Ana Petrović', room: '101', stay: '2 nights', status: 'Checked in' },
  { id: 2, name: 'Marko Šimić', room: '204', stay: '5 nights', status: 'VIP' },
  { id: 3, name: 'Sara Dedić', room: '315', stay: '1 night', status: 'Pending' },
]

const initialReservations = [
  { id: 1, guest: 'Lea Kovač', room: '204', checkIn: '2026-09-02', checkOut: '2026-09-07', status: 'Confirmed' },
  { id: 2, guest: 'Ivan Marić', room: '101', checkIn: '2026-09-05', checkOut: '2026-09-10', status: 'Waiting' },
  { id: 3, guest: 'Maja Babić', room: '315', checkIn: '2026-09-09', checkOut: '2026-09-12', status: 'Checked in' },
]

const initialDevices = [
  { id: 1, name: 'Lobby TV 1', room: 'Lobby', status: 'Online', tv: 'Samsung 50"', pairing: 'A12F-22' },
  { id: 2, name: 'Room 204', room: '204', status: 'Online', tv: 'LG 43"', pairing: 'B201-88' },
  { id: 3, name: 'Suite 315', room: '315', status: 'Offline', tv: 'Sony 55"', pairing: 'C991-01' },
]

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'hotelContent', label: 'Hotel content' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'guests', label: 'Guests' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'devices', label: 'TV devices' },
]

const defaultForms = {
  hotelContent: {
    title: '',
    subtitle: '',
    description: '',
    status: 'Published',
  },
  rooms: {
    number: '',
    type: 'Deluxe',
    status: 'Available',
    price: '',
  },
  guests: {
    name: '',
    room: '',
    stay: '',
    status: 'Checked in',
  },
  reservations: {
    guest: '',
    room: '',
    checkIn: '',
    checkOut: '',
    status: 'Confirmed',
  },
  devices: {
    name: '',
    room: '',
    status: 'Online',
    tv: '',
    pairing: '',
  },
}

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [contentItems, setContentItems] = useState(initialContent)
  const [rooms, setRooms] = useState(initialRooms)
  const [guests, setGuests] = useState(initialGuests)
  const [reservations, setReservations] = useState(initialReservations)
  const [devices, setDevices] = useState(initialDevices)
  const [formState, setFormState] = useState(defaultForms.hotelContent)
  const [editingId, setEditingId] = useState(null)

  const overviewStats = useMemo(
    () => [
      { label: 'Rooms', value: rooms.length, detail: 'Live report' },
      { label: 'Occupancy', value: '74%', detail: '+8% this month' },
      { label: 'Guests', value: guests.length, detail: 'Checked in' },
      { label: 'TV devices', value: devices.length, detail: 'Connected' },
    ],
    [rooms.length, guests.length, devices.length],
  )

  const currentCollection = {
    hotelContent: contentItems,
    rooms,
    guests,
    reservations,
    devices,
  }[activeTab] || []

  const activeLabel = navItems.find((item) => item.id === activeTab)?.label ?? 'Overview'

  const resetForm = (tab = activeTab) => {
    setEditingId(null)
    setFormState(defaultForms[tab] ?? defaultForms.hotelContent)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setFormState(item)
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setEditingId(null)
    setFormState(defaultForms[tabId] ?? defaultForms.hotelContent)
  }

  const handleInputChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const saveItem = (event) => {
    event.preventDefault()

    if (activeTab === 'hotelContent') {
      if (!formState.title.trim()) return

      const nextItem = {
        id: editingId ?? Date.now(),
        title: formState.title,
        subtitle: formState.subtitle,
        description: formState.description,
        status: formState.status,
      }

      if (editingId) {
        setContentItems((prev) => prev.map((item) => (item.id === editingId ? nextItem : item)))
      } else {
        setContentItems((prev) => [nextItem, ...prev])
      }
    }

    if (activeTab === 'rooms') {
      if (!formState.number.trim()) return

      const nextItem = {
        id: editingId ?? Date.now(),
        number: formState.number,
        type: formState.type,
        status: formState.status,
        price: formState.price,
      }

      if (editingId) {
        setRooms((prev) => prev.map((item) => (item.id === editingId ? nextItem : item)))
      } else {
        setRooms((prev) => [nextItem, ...prev])
      }
    }

    if (activeTab === 'guests') {
      if (!formState.name.trim()) return
      const nextItem = {
        id: editingId ?? Date.now(),
        name: formState.name,
        room: formState.room,
        stay: formState.stay,
        status: formState.status,
      }

      if (editingId) {
        setGuests((prev) => prev.map((item) => (item.id === editingId ? nextItem : item)))
      } else {
        setGuests((prev) => [nextItem, ...prev])
      }
    }

    if (activeTab === 'reservations') {
      if (!formState.guest.trim() || !formState.room.trim()) return
      const nextItem = {
        id: editingId ?? Date.now(),
        guest: formState.guest,
        room: formState.room,
        checkIn: formState.checkIn,
        checkOut: formState.checkOut,
        status: formState.status,
      }

      if (editingId) {
        setReservations((prev) => prev.map((item) => (item.id === editingId ? nextItem : item)))
      } else {
        setReservations((prev) => [nextItem, ...prev])
      }
    }

    if (activeTab === 'devices') {
      if (!formState.name.trim()) return
      const nextItem = {
        id: editingId ?? Date.now(),
        name: formState.name,
        room: formState.room,
        status: formState.status,
        tv: formState.tv,
        pairing: formState.pairing,
      }

      if (editingId) {
        setDevices((prev) => prev.map((item) => (item.id === editingId ? nextItem : item)))
      } else {
        setDevices((prev) => [nextItem, ...prev])
      }
    }

    resetForm(activeTab)
  }

  const deleteItem = (id) => {
    if (activeTab === 'hotelContent') setContentItems((prev) => prev.filter((item) => item.id !== id))
    if (activeTab === 'rooms') setRooms((prev) => prev.filter((item) => item.id !== id))
    if (activeTab === 'guests') setGuests((prev) => prev.filter((item) => item.id !== id))
    if (activeTab === 'reservations') setReservations((prev) => prev.filter((item) => item.id !== id))
    if (activeTab === 'devices') setDevices((prev) => prev.filter((item) => item.id !== id))
  }

  const renderOverview = () => (
    <div className="overview-grid">
      <div className="stats-grid">
        {overviewStats.map((stat) => (
          <article key={stat.label} className="stat-card accent">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-panels">
        <section className="panel-card">
          <h3>Hotel overview</h3>
          <ul className="mini-list">
            <li><span>Check-in window</span><strong>14:00 - 22:00</strong></li>
            <li><span>Services active</span><strong>12 modules</strong></li>
            <li><span>Guest satisfaction</span><strong>4.8 / 5.0</strong></li>
          </ul>
        </section>

        <section className="panel-card">
          <h3>TV content status</h3>
          <ul className="mini-list">
            <li><span>Published items</span><strong>{contentItems.filter((item) => item.status === 'Published').length}</strong></li>
            <li><span>Draft items</span><strong>{contentItems.filter((item) => item.status === 'Draft').length}</strong></li>
            <li><span>Active rooms</span><strong>{rooms.filter((item) => item.status !== 'Maintenance').length}</strong></li>
          </ul>
        </section>
      </div>
    </div>
  )

  const renderCollectionTab = () => (
    <div className="content-layout">
      <section className="list-panel">
        <div className="section-header">
          <h3>{activeLabel}</h3>
          <button type="button" className="primary-btn" onClick={() => resetForm()}>
            + Add item
          </button>
        </div>

        <div className="record-list">
          {currentCollection.map((item) => (
            <div key={item.id} className="record-card">
              <div className="record-main">
                <strong>
                  {item.title || item.name || item.guest || item.number || item.room || 'Unnamed item'}
                </strong>
                <small>
                  {item.subtitle || item.type || item.status || item.room || item.checkIn || 'No details'}
                </small>
              </div>

              <div className="record-meta">
                {item.status && <span className="status-pill">{item.status}</span>}
                {item.price && <span className="meta-pill">{item.price}</span>}
                {item.checkIn && item.checkOut && (
                  <span className="meta-pill">
                    {item.checkIn} → {item.checkOut}
                  </span>
                )}
              </div>

              <div className="record-actions">
                <button type="button" className="ghost-btn" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button type="button" className="danger-btn" onClick={() => deleteItem(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="form-panel">
        <h3>{editingId ? 'Edit item' : 'New item'}</h3>

        <form onSubmit={saveItem} className="data-form">
          {activeTab === 'hotelContent' && (
            <>
              <label>
                Content title
                <input value={formState.title || ''} onChange={(e) => handleInputChange('title', e.target.value)} />
              </label>
              <label>
                Subtitle
                <input value={formState.subtitle || ''} onChange={(e) => handleInputChange('subtitle', e.target.value)} />
              </label>
              <label>
                Description
                <textarea value={formState.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} rows="4" />
              </label>
              <label>
                Status
                <select value={formState.status || 'Published'} onChange={(e) => handleInputChange('status', e.target.value)}>
                  <option>Published</option>
                  <option>Draft</option>
                </select>
              </label>
            </>
          )}

          {activeTab === 'rooms' && (
            <>
              <label>
                Room number
                <input value={formState.number || ''} onChange={(e) => handleInputChange('number', e.target.value)} />
              </label>
              <label>
                Room type
                <select value={formState.type || 'Deluxe'} onChange={(e) => handleInputChange('type', e.target.value)}>
                  <option>Deluxe</option>
                  <option>Sea View</option>
                  <option>Suite</option>
                  <option>Family</option>
                </select>
              </label>
              <label>
                Status
                <select value={formState.status || 'Available'} onChange={(e) => handleInputChange('status', e.target.value)}>
                  <option>Available</option>
                  <option>Occupied</option>
                  <option>Maintenance</option>
                </select>
              </label>
              <label>
                Price
                <input value={formState.price || ''} onChange={(e) => handleInputChange('price', e.target.value)} />
              </label>
            </>
          )}

          {activeTab === 'guests' && (
            <>
              <label>
                Guest name
                <input value={formState.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} />
              </label>
              <label>
                Room
                <input value={formState.room || ''} onChange={(e) => handleInputChange('room', e.target.value)} />
              </label>
              <label>
                Stay length
                <input value={formState.stay || ''} onChange={(e) => handleInputChange('stay', e.target.value)} />
              </label>
              <label>
                Status
                <select value={formState.status || 'Checked in'} onChange={(e) => handleInputChange('status', e.target.value)}>
                  <option>Checked in</option>
                  <option>VIP</option>
                  <option>Pending</option>
                  <option>Checked out</option>
                </select>
              </label>
            </>
          )}

          {activeTab === 'reservations' && (
            <>
              <label>
                Guest name
                <input value={formState.guest || ''} onChange={(e) => handleInputChange('guest', e.target.value)} />
              </label>
              <label>
                Room
                <input value={formState.room || ''} onChange={(e) => handleInputChange('room', e.target.value)} />
              </label>
              <div className="split-field">
                <label>
                  Check in
                  <input type="date" value={formState.checkIn || ''} onChange={(e) => handleInputChange('checkIn', e.target.value)} />
                </label>
                <label>
                  Check out
                  <input type="date" value={formState.checkOut || ''} onChange={(e) => handleInputChange('checkOut', e.target.value)} />
                </label>
              </div>
              <label>
                Status
                <select value={formState.status || 'Confirmed'} onChange={(e) => handleInputChange('status', e.target.value)}>
                  <option>Confirmed</option>
                  <option>Waiting</option>
                  <option>Checked in</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </>
          )}

          {activeTab === 'devices' && (
            <>
              <label>
                Device name
                <input value={formState.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} />
              </label>
              <label>
                Assigned room
                <input value={formState.room || ''} onChange={(e) => handleInputChange('room', e.target.value)} />
              </label>
              <label>
                TV model
                <input value={formState.tv || ''} onChange={(e) => handleInputChange('tv', e.target.value)} />
              </label>
              <label>
                Pairing code
                <input value={formState.pairing || ''} onChange={(e) => handleInputChange('pairing', e.target.value)} />
              </label>
              <label>
                Status
                <select value={formState.status || 'Online'} onChange={(e) => handleInputChange('status', e.target.value)}>
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Pending</option>
                </select>
              </label>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="ghost-btn" onClick={() => resetForm()}>
              Clear
            </button>
            <button type="submit" className="primary-btn">
              Save changes
            </button>
          </div>
        </form>
      </aside>
    </div>
  )

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <div className="brand-mark">VA</div>
          <div>
            <strong>Villa Aura</strong>
            <small>Admin panel</small>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => handleTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Hotel operations</p>
            <h1>{activeTab === 'overview' ? 'Dashboard' : activeLabel}</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="primary-btn" onClick={() => {
              setActiveTab('hotelContent')
              resetForm('hotelContent')
            }}>
              + Add item
            </button>
            <div className="save-status">All changes saved</div>
          </div>
        </header>

        {activeTab === 'overview' ? renderOverview() : renderCollectionTab()}
      </main>
    </div>
  )
}

export default App
