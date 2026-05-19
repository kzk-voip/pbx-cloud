import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/Layout/Layout'
import PrivateRoute from './components/PrivateRoute/PrivateRoute'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import ExtensionDashboard from './pages/ExtensionDashboard/ExtensionDashboard'
import Tenants from './pages/Tenants/Tenants'
import TenantDetails from './pages/Tenants/TenantDetails'
import TenantSettings from './pages/Tenants/TenantSettings'
import ActiveCalls from './pages/ActiveCalls/ActiveCalls'
import CDR from './pages/CDR/CDR'
import Profile from './pages/Profile/Profile'
import InboundRules from './pages/InboundRules/InboundRules'
import CallRoutesPage from './pages/Routes/Routes'

/** Redirect to role-appropriate default page */
function DefaultRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'user') return <Navigate to="/my-dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

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
        {/* Admin routes (super_admin + tenant_admin) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/tenants/:id" element={<TenantDetails />} />
        <Route path="/tenants/:id/settings" element={<TenantSettings />} />
        <Route path="/active-calls" element={<ActiveCalls />} />
        <Route path="/cdr" element={<CDR />} />
        <Route path="/inbound-rules" element={<InboundRules />} />
        <Route path="/call-routes" element={<CallRoutesPage />} />

        {/* Extension user routes */}
        <Route path="/my-dashboard" element={<ExtensionDashboard />} />
        <Route path="/my-calls" element={<CDR />} />

        {/* Shared routes */}
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  )
}

