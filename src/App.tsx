import { type ReactElement } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Signup from './pages/Signup'
import Organisation from './pages/Organisation'
import Meeting from './pages/Meeting'
import Room from './pages/Room'
import RecordingPage from './pages/Recording'
import { AppProvider, useAppContext } from './context/AppContext'

function RequireUsername({ children }: { children: ReactElement }) {
  const { username } = useAppContext()
  if (!username) return <Navigate to="/" replace />
  return children
}

function RequireOrganisation({ children }: { children: ReactElement }) {
  const { username, selectedOrg } = useAppContext()
  if (!username) return <Navigate to="/" replace />
  if (!selectedOrg) return <Navigate to="/organizations" replace />
  return children
}

function MeetingRoute() {
  const { username, selectedOrg } = useAppContext()
  const location = useLocation()
  const roomCode = (location.state as { roomCode?: string } | null)?.roomCode
    ?? selectedOrg
    ?? 'default-room'
  return <Meeting roomId={roomCode} localName={username ?? 'You'} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/organizations"
        element={
          <RequireUsername>
            <Organisation />
          </RequireUsername>
        }
      />
      <Route
        path="/room"
        element={
          <RequireOrganisation>
            <Room />
          </RequireOrganisation>
        }
      />
      <Route
        path="/meetings"
        element={
          <RequireOrganisation>
            <MeetingRoute />
          </RequireOrganisation>
        }
      />
      <Route
        path="/recordings"
        element={
          <RequireOrganisation>
            <RecordingPage />
          </RequireOrganisation>
        }
      />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}
