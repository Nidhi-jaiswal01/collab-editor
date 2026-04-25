import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import Lobby from './pages/Lobby'
import Editor from './pages/Editor'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )
  if (!user) return <Navigate to="/auth" />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
        <Route path="/room/:roomId" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)