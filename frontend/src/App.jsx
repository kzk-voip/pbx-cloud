import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/Layout/Layout'
import PrivateRoute from './components/PrivateRoute/PrivateRoute'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Tenants from './pages/Tenants/Tenants'
import TenantDetails from './pages/Tenants/TenantDetails'
import Extensions from './pages/Extensions/Extensions'
import Trunks from './pages/Trunks/Trunks'
import ActiveCalls from './pages/ActiveCalls/ActiveCalls'
import CDR from './pages/CDR/CDR'
import Profile from './pages/Profile/Profile'

export default function App() {
  const { fetchUser, isAuthenticated } = useAuthStore()

  // On mount — restore user session from stored token
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
    if (isAuthenticated) {
      fetchUser()
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/tenants/:id" element={<TenantDetails />} />
        <Route path="/extensions" element={<Extensions />} />
        <Route path="/trunks" element={<Trunks />} />
        <Route path="/active-calls" element={<ActiveCalls />} />
        <Route path="/cdr" element={<CDR />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
