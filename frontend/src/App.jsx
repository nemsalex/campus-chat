import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './layout/ProtectedRoute'
import AppShell from './layout/AppShell'
import Login from './pages/Login'
import Register from './pages/Register'
import MessagesList from './pages/MessagesList'
import NewConversation from './pages/NewConversation'
import Conversation from './pages/Conversation'
import Search from './pages/Search'
import Profile from './pages/Profile'
import FriendsList from './pages/FriendsList'
import FriendRequests from './pages/FriendRequests'
import StatusCreate from './pages/StatusCreate'
import StatusFeed from './pages/StatusFeed'
import Campus from './pages/Campus'
import GroupDetail from './pages/GroupDetail'
import GroupInfo from './pages/GroupInfo'
import AnnouncementDetail from './pages/AnnouncementDetail'
import MyTimetable from './pages/MyTimetable'
import ClassDirectory from './pages/ClassDirectory'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Privacy from './pages/Privacy'
import AdminSpace from './pages/AdminSpace'
import CreatorSpace from './pages/CreatorSpace'
import ConfirmCreator from './pages/ConfirmCreator'
import Admin from './components/Admin'
import './common.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/inscription" element={<Register />} />
          <Route path="/confirmer-createur/:token" element={<ConfirmCreator />} />

          <Route
            path="/messages/:matricule"
            element={
              <ProtectedRoute>
                <Conversation />
              </ProtectedRoute>
            }
          />

          <Route
            path="/campus/groupes/:id"
            element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campus/groupes/:id/infos"
            element={
              <ProtectedRoute>
                <GroupInfo />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<StatusFeed />} />
            <Route path="/messages" element={<MessagesList />} />
            <Route path="/messages/nouveau" element={<NewConversation />} />
            <Route path="/recherche" element={<Search />} />
            <Route path="/amis" element={<FriendsList />} />
            <Route path="/demandes" element={<FriendRequests />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/profil/:id" element={<Profile />} />
            <Route path="/statuts/nouveau" element={<StatusCreate />} />
            <Route path="/campus" element={<Campus />} />
            <Route path="/campus/emploi-du-temps" element={<MyTimetable />} />
            <Route path="/campus/annuaire" element={<ClassDirectory />} />
            <Route path="/annonces/:id" element={<AnnouncementDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/parametres" element={<Settings />} />
            <Route path="/confidentialite" element={<Privacy />} />
            <Route path="/espace-admin" element={<AdminSpace />} />
            <Route path="/espace-createur" element={<CreatorSpace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
