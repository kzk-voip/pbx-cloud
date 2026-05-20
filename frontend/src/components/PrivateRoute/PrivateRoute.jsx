import { Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isUserLoaded } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Wait for fetchUser() to complete before rendering child routes.
  // This prevents 403 errors from API calls made before the role is known.
  if (!isUserLoaded) {
    return null
  }

  return children
}
