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
import IpAccess from './pages/IpAccess/IpAccess'

/** Role-based guard — redirects unauthorized roles to their default page */
function RoleGuard({ allowed, children }) {
  const { user } = useAuthStore()
  if (!user) return null
  if (allowed.includes(user.role)) return children
  // Redirect to role-appropriate default
  if (user.role === 'user') return <Navigate to="/my-dashboard" replace />
  if (user.role === 'tenant_admin') return <Navigate to={`/tenants/${user.tenant_id}`} replace />
  return <Navigate to="/dashboard" replace />
}

/** Redirect to role-appropriate default page */
function DefaultRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'user') return <Navigate to="/my-dashboard" replace />
  if (user?.role === 'tenant_admin' && user?.tenant_id) {
    return <Navigate to={`/tenants/${user.tenant_id}`} replace />
  }
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
        {/* Super admin only routes */}
        <Route path="/dashboard" element={
          <RoleGuard allowed={['super_admin']}>
            <Dashboard />
          </RoleGuard>
        } />
        <Route path="/tenants" element={
          <RoleGuard allowed={['super_admin']}>
            <Tenants />
          </RoleGuard>
        } />
        <Route path="/ip-access" element={
          <RoleGuard allowed={['super_admin']}>
            <IpAccess />
          </RoleGuard>
        } />

        {/* Admin routes (super_admin + tenant_admin) */}
        <Route path="/tenants/:id" element={
          <RoleGuard allowed={['super_admin', 'tenant_admin']}>
            <TenantDetails />
          </RoleGuard>
        } />
        <Route path="/tenants/:id/settings" element={
          <RoleGuard allowed={['super_admin', 'tenant_admin']}>
            <TenantSettings />
          </RoleGuard>
        } />
        <Route path="/active-calls" element={
          <RoleGuard allowed={['super_admin', 'tenant_admin']}>
            <ActiveCalls />
          </RoleGuard>
        } />
        <Route path="/cdr" element={
          <RoleGuard allowed={['super_admin', 'tenant_admin']}>
            <CDR />
          </RoleGuard>
        } />

        {/* Extension user routes */}
        <Route path="/my-dashboard" element={
          <RoleGuard allowed={['user']}>
            <ExtensionDashboard />
          </RoleGuard>
        } />
        <Route path="/my-calls" element={
          <RoleGuard allowed={['user']}>
            <CDR />
          </RoleGuard>
        } />

        {/* Shared routes */}
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  )
}
