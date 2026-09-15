import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('Admin dashboard', () => {
  it('renders the main admin sections and forms', () => {
    render(<App />)

    expect(screen.getByText('Hotel overview')).toBeInTheDocument()
    expect(screen.getByText('Hotel content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })
})
