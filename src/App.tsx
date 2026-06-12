import { type ReactElement } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Signup from './pages/Signup'
import Meeting from './pages/Meeting'
import Room from './pages/Room'
import RecordingPage from './pages/Recording'
import Dashboard from './pages/Dashboard'
import { AppProvider, useAppContext } from './context/AppContext'
import { isValidRoomCode } from './lib/meeting/roomCode'

function HomeRoute() {
  const { authSession, isTestLogin } = useAppContext()

  if (authSession || isTestLogin) {
    return <Navigate to="/dashboard" replace />
  }

  return <LandingPage />
}

function RequireIdentifier({ children }: { children: ReactElement }) {
  const { identifier } = useAppContext()
  if (!identifier) return <Navigate to="/" replace />
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
        path="/room"
        element={
          <RequireIdentifier>
            <Room />
          </RequireIdentifier>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireIdentifier>
            <Dashboard />
          </RequireIdentifier>
        }
      />
      <Route
        path="/meetings"
        element={
          <RequireIdentifier>
            <MeetingRoute />
          </RequireIdentifier>
        }
      />
      <Route
        path="/recordings"
        element={
          <RequireIdentifier>
            <RecordingPage />
          </RequireIdentifier>
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
