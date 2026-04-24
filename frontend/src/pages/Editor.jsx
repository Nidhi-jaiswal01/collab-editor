import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'

export default function Editor() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const username = searchParams.get('user') || 'Anonymous'

  const [content, setContent] = useState('')
  const [users, setUsers] = useState([])
  const [revision, setRevision] = useState(0)
  const [copied, setCopied] = useState(false)

  const socketRef = useRef(null)
  const suppressRef = useRef(false)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.emit('join', { room_id: roomId, username })

    socket.on('init', (data) => {
      suppressRef.current = true
      setContent(data.content)
      setRevision(data.revision)
      setUsers(data.users)
      suppressRef.current = false
    })

    socket.on('operation', (data) => {
      if (!data.op) return
      setRevision(data.revision)
      setContent(prev => applyOp(prev, data.op))
    })

    socket.on('user_joined', (data) => setUsers(data.users))
    socket.on('user_left', (data) => setUsers(data.users))

    return () => socket.disconnect()
  }, [roomId])

  function applyOp(text, op) {
    if (op.type === 'insert') {
      return text.slice(0, op.pos) + op.chars + text.slice(op.pos)
    } else if (op.type === 'delete') {
      return text.slice(0, op.pos) + text.slice(op.pos + op.chars.length)
    }
    return text
  }

  function handleChange(e) {
    if (suppressRef.current) return
    const newContent = e.target.value
    const op = diffToOp(content, newContent)
    setContent(newContent)
    if (op) {
      socketRef.current.emit('operation', {
        room_id: roomId,
        op,
        content: newContent,
        revision,
      })
    }
  }

  function diffToOp(oldText, newText) {
    // Find where they differ
    let start = 0
    while (start < oldText.length && start < newText.length &&
           oldText[start] === newText[start]) start++

    let oldEnd = oldText.length
    let newEnd = newText.length
    while (oldEnd > start && newEnd > start &&
           oldText[oldEnd - 1] === newText[newEnd - 1]) {
      oldEnd--; newEnd--
    }

    const removed = oldText.slice(start, oldEnd)
    const inserted = newText.slice(start, newEnd)

    if (removed.length > 0) return { type: 'delete', pos: start, chars: removed }
    if (inserted.length > 0) return { type: 'insert', pos: start, chars: inserted }
    return null
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800 bg-gray-900">
        <span className="text-gray-400 text-sm font-mono">Room: <span className="text-white">{roomId}</span></span>
        <button
          onClick={copyLink}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {users.map((u, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-xs font-medium text-white"
              title={u}
            >
              {u[0].toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Editor area */}
      <textarea
        className="flex-1 bg-gray-950 text-gray-100 font-mono text-sm p-6 resize-none focus:outline-none placeholder-gray-700"
        placeholder="Start typing..."
        value={content}
        onChange={handleChange}
        spellCheck={false}
      />

      {/* Status bar */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 text-xs text-gray-500">
        revision {revision} · {users.length} user{users.length !== 1 ? 's' : ''} online
      </div>
    </div>
  )
}