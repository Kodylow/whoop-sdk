import { useEffect, useState } from 'react'
import { Routes, Route, useSearchParams } from 'react-router-dom'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'
import LoadingSpinner from './components/LoadingSpinner'

interface AuthStatus {
  authenticated: boolean
  hasTokens: boolean
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include'
      })
      const data = await response.json()
      setAuthStatus(data)
    } catch (error) {
      console.error('Error checking auth status:', error)
      setAuthStatus({ authenticated: false, hasTokens: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const authParam = searchParams.get('auth')
    const errorParam = searchParams.get('error')

    if (authParam === 'success') {
      // Remove query params
      setSearchParams({})
      // Refresh auth status
      checkAuthStatus()
    } else if (errorParam) {
      console.error('OAuth error:', errorParam)
      // Show error message (you could add a toast notification here)
    }
  }, [searchParams, setSearchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Routes>
        <Route 
          path="/" 
          element={
            authStatus?.authenticated ? (
              <Dashboard />
            ) : (
              <LoginPage />
            )
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            authStatus?.authenticated ? (
              <Dashboard />
            ) : (
              <LoginPage />
            )
          } 
        />
      </Routes>
    </div>
  )
}

export default App 