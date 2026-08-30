import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import adminHtml from './admin-panel.html?raw'

function ExactAdminPanel() {
  useEffect(() => {
    document.body.innerHTML = adminHtml
    document.title = 'Villa Aura — Admin panel'
  }, [])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin-panel" replace />} />
        <Route path="/admin" element={<Navigate to="/admin-panel" replace />} />
        <Route path="/admin-panel" element={<ExactAdminPanel />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
