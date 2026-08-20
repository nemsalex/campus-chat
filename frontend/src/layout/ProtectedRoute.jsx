import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SplashScreen from '../components/SplashScreen'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/connexion" replace />

  return children
}

export default ProtectedRoute
