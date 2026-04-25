import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Lobby() {
  const [roomId, setRoomId] = useState('')
  const { username, signOut } = useAuth()
  const navigate = useNavigate()

  function createRoom() {
    const id = crypto.randomUUID().slice(0, 8)
    navigate(`/room/${id}`)
  }

  function joinRoom() {
    if (roomId.trim()) navigate(`/room/${roomId.trim()}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Collab Editor</h1>
            <p className="text-gray-400 text-sm">Hey, <span className="text-purple-400">{username}</span>!</p>
          </div>
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Sign out
          </button>
        </div>

        <button
          onClick={createRoom}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors mb-4"
        >
          Create new room
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs">or join existing</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-3"
          placeholder="Paste room ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && joinRoom()}
        />

        <button
          onClick={joinRoom}
          className="w-full border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Join room
        </button>
      </div>
    </div>
  )
}