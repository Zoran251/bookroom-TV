import './App.css'

const stats = [
  { label: 'Active guests', value: '18', tone: 'primary' },
  { label: 'TV devices', value: '24', tone: 'secondary' },
  { label: 'Rooms', value: '42', tone: 'success' },
  { label: 'Hotel content', value: '12', tone: 'warning' },
]

const homeCards = [
  { title: 'Hotelske informacije', type: 'info' },
  { title: 'Restoran i bar', type: 'restaurant' },
  { title: 'Wellness & beauty centre', type: 'wellness' },
  { title: 'TV', type: 'tv' },
  { title: 'Radio', type: 'radio' },
  { title: 'Vremenska prognoza', type: 'weather' },
  { title: 'Posluga u sobu', type: 'service' },
  { title: 'Sportske aktivnosti', type: 'sports' },
  { title: 'Zanimljivosti u okolini', type: 'local' },
  { title: 'Moj profil', type: 'profile' },
  { title: 'Zabava', type: 'entertainment' },
  { title: 'Spa i wellness', type: 'spa' },
]

const rooms = [
  { room: '101', guest: 'Pero Perić', status: 'Checked in', tv: 'TV-101' },
  { room: '105', guest: 'Marko Marković', status: 'Checked in', tv: 'TV-105' },
  { room: '202', guest: 'Ana Anić', status: 'Checked out', tv: 'TV-202' },
  { room: '304', guest: 'No guest', status: 'Available', tv: 'TV-304' },
]

const contentModules = [
  { name: 'Hotel info', status: 'Published', updated: 'Today' },
  { name: 'Restaurant & bar', status: 'Published', updated: 'Today' },
  { name: 'Wellness & spa', status: 'Draft', updated: '2 days ago' },
  { name: 'Sports activities', status: 'Published', updated: '1 day ago' },
  { name: 'Local attractions', status: 'Published', updated: 'Today' },
  { name: 'In-room service', status: 'Published', updated: 'Today' },
]

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BOOKINGROOM</div>
            <div className="brand-subtitle">TV ADMIN</div>
          </div>
        </div>

        <nav className="nav">
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Hotel info</button>
          <button className="nav-item">Rooms</button>
          <button className="nav-item">TV devices</button>
          <button className="nav-item">Guests</button>
          <button className="nav-item">Bookings</button>
          <button className="nav-item">Content</button>
          <button className="nav-item">Power TV</button>
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Hotel management</p>
            <h1>Hotel Bellevue</h1>
          </div>

          <div className="topbar-actions">
            <div className="admin-pill">Admin</div>
            <button className="ghost-button">Logout</button>
          </div>
        </header>

        <section className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat-card ${stat.tone}`}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </section>

        <section className="workspace-grid">
          <div className="panel tv-preview-panel">
            <div className="panel-header">
              <h2>TV home screen preview</h2>
              <span>Single hotel / all rooms</span>
            </div>

            <div className="tv-screen">
              <div className="tv-header">
                <div className="hotel-tag">Terme Omiia</div>
                <div className="hotel-center">Dobrodošli, Gospoda Jozic</div>
                <div className="hotel-meta">Soba 6335</div>
              </div>

              <div className="tv-grid">
                {homeCards.map((card) => (
                  <div key={card.title} className={`tv-card ${card.type}`}>
                    <span>{card.title}</span>
                  </div>
                ))}
              </div>

              <div className="tv-slideshow">
                <div className="slide active" />
                <div className="slide" />
                <div className="slide" />
              </div>
            </div>
          </div>

          <div className="panel side-panel">
            <div className="panel-header">
              <h2>Content modules</h2>
              <button className="small-button">Add page</button>
            </div>

            <div className="content-list">
              {contentModules.map((module) => (
                <div key={module.name} className="content-row">
                  <div>
                    <strong>{module.name}</strong>
                    <span>{module.updated}</span>
                  </div>
                  <span className={`status ${module.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {module.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Rooms and TV devices</h2>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Guest</th>
                  <th>Status</th>
                  <th>TV</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.room}>
                    <td>{room.room}</td>
                    <td>{room.guest}</td>
                    <td>
                      <span className={`badge ${room.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {room.status}
                      </span>
                    </td>
                    <td>{room.tv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Quick actions</h2>
            </div>

            <div className="quick-actions">
              <button>Check-in guest</button>
              <button>Pair TV device</button>
              <button>Update hotel content</button>
              <button>Launch Power TV</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
