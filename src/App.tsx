import { type ReactElement } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Signup from './pages/Signup'
import Organisation from './pages/Organisation'
import Meeting from './pages/Meeting'
import Room from './pages/Room'
import RecordingPage from './pages/Recording'
import Dashboard from './pages/Dashboard'
import { AppProvider, useAppContext } from './context/AppContext'
import { isValidRoomCode } from './lib/meeting/roomCode'

function HomeRoute() {
  const { authSession, isTestLogin, selectedOrg } = useAppContext()

  if (authSession || isTestLogin) {
    return <Navigate to={selectedOrg ? '/dashboard' : '/organizations'} replace />
  }

  return <LandingPage />
}

function RequireIdentifier({ children }: { children: ReactElement }) {
  const { identifier } = useAppContext()
  if (!identifier) return <Navigate to="/" replace />
  return children
}

function RequireOrganisation({ children }: { children: ReactElement }) {
  const { identifier, selectedOrg } = useAppContext()
  if (!identifier) return <Navigate to="/" replace />
  if (!selectedOrg) return <Navigate to="/organizations" replace />
  return children
}

function MeetingRoute() {
  const { identifier } = useAppContext()
  const location = useLocation()
  const roomCode = (location.state as { roomCode?: string } | null)?.roomCode

  if (!isValidRoomCode(roomCode)) {
    return <Navigate to="/room" replace />
  }

  return <Meeting roomId={roomCode} localName={identifier ?? 'You'} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route
        path="/organizations"
        element={
          <RequireIdentifier>
            <Organisation />
          </RequireIdentifier>
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
        path="/dashboard"
        element={
          <RequireOrganisation>
            <Dashboard />
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
