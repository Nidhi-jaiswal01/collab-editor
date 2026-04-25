import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

export default function Editor() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const username = searchParams.get('user') || 'Anonymous'

  const [users, setUsers] = useState([])
  const [revision, setRevision] = useState(0)
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState('python')
  const [cursors, setCursors] = useState({})

  const socketRef = useRef(null)
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const suppressRef = useRef(false)
  const pendingOpRef = useRef(null)
  const bufferedOpRef = useRef(null)
  const revisionRef = useRef(0)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    // Set up CodeMirror
    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          oneDark,
          python(),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || suppressRef.current) return
            update.transactions.forEach(tr => {
              if (!tr.docChanged) return
              tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                const removedText = tr.startState.doc.sliceString(fromA, toA)
                const insertedText = inserted.toString()

                if (removedText.length > 0) {
                  sendOp({ type: 'delete', pos: fromA, chars: removedText })
                }
                if (insertedText.length > 0) {
                  sendOp({ type: 'insert', pos: fromB, chars: insertedText })
                }
              })
            })
          }),
          EditorView.domEventHandlers({
            keyup: () => {
              const pos = view.state.selection.main.head
              const line = view.state.doc.lineAt(pos)
              socket.emit('cursor', {
                room_id: roomId,
                line: line.number - 1,
                ch: pos - line.from
              })
            }
          })
        ]
      }),
      parent: editorRef.current
    })

    viewRef.current = view

    socket.emit('join', { room_id: roomId, username })

    socket.on('init', (data) => {
      suppressRef.current = true
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: data.content
        }
      })
      revisionRef.current = data.revision
      setRevision(data.revision)
      setUsers(data.users)
      suppressRef.current = false
    })

    socket.on('ack', (data) => {
      revisionRef.current = data.revision
      setRevision(data.revision)
      pendingOpRef.current = null
      if (bufferedOpRef.current) {
        const op = bufferedOpRef.current
        bufferedOpRef.current = null
        pendingOpRef.current = op
        socket.emit('operation', {
          room_id: roomId,
          op,
          revision: revisionRef.current
        })
      }
    })

    socket.on('operation', (data) => {
      if (!data.op) return
      revisionRef.current = data.revision
      setRevision(data.revision)
      suppressRef.current = true
      const op = data.op
      if (op.type === 'insert') {
        view.dispatch({
          changes: { from: op.pos, insert: op.chars }
        })
      } else if (op.type === 'delete') {
        view.dispatch({
          changes: { from: op.pos, to: op.pos + op.chars.length, insert: '' }
        })
      }
      suppressRef.current = false
    })

    socket.on('user_joined', (data) => setUsers(data.users))
    socket.on('user_left', (data) => {
      setUsers(data.users)
      setCursors(prev => {
        const next = { ...prev }
        delete next[data.username]
        return next
      })
    })

    socket.on('cursor', (data) => {
      setCursors(prev => ({
        ...prev,
        [data.username]: { line: data.line, ch: data.ch }
      }))
    })

    return () => {
      socket.disconnect()
      view.destroy()
    }
  }, [roomId])

  function sendOp(op) {
    if (!pendingOpRef.current) {
      pendingOpRef.current = op
      socketRef.current.emit('operation', {
        room_id: roomId,
        op,
        revision: revisionRef.current
      })
    } else {
      bufferedOpRef.current = op
    }
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
        <span className="text-gray-400 text-sm font-mono">
          Room: <span className="text-white">{roomId}</span>
        </span>
        <button
          onClick={copyLink}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-700 bg-gray-900 text-gray-300 focus:outline-none"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
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

      {/* Editor */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={editorRef} className="h-full overflow-auto" />
        {/* Remote cursors */}
        {Object.entries(cursors).map(([name, pos]) => (
          <div
            key={name}
            className="absolute pointer-events-none text-xs bg-purple-600 text-white px-1 rounded"
            style={{ top: `${pos.line * 20 + 8}px`, left: `${pos.ch * 8 + 16}px` }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 text-xs text-gray-500">
        revision {revision} · {users.length} user{users.length !== 1 ? 's' : ''} online
      </div>
    </div>
  )
}