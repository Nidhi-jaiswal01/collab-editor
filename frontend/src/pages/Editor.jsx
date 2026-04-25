import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'

export default function Editor() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const username = searchParams.get('user') || 'Anonymous'

  const [users, setUsers] = useState([])
  const [revision, setRevision] = useState(0)
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState('python')
  const [cursors, setCursors] = useState({})
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const socketRef = useRef(null)
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const suppressRef = useRef(false)
  const pendingOpRef = useRef(null)
  const bufferedOpRef = useRef(null)
  const revisionRef = useRef(0)
  const languageRef = useRef('python')

  function getLanguageExtension(lang) {
    if (lang === 'javascript') return javascript()
    return python()
  }

  function buildEditorState(doc, lang) {
    return EditorState.create({
      doc,
      extensions: [
        basicSetup,
        oneDark,
        getLanguageExtension(lang),
        EditorView.theme({
          "&": { fontSize: "14px" },
          ".cm-content": {
            fontFamily: "JetBrains Mono, Fira Code, monospace",
            padding: "10px 0"
          },
          ".cm-line": { padding: "0 16px" },
        }),
        EditorState.tabSize.of(4),
        keymap.of([indentWithTab]),
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
            if (!viewRef.current) return
            const pos = viewRef.current.state.selection.main.head
            const line = viewRef.current.state.doc.lineAt(pos)
            socketRef.current?.emit('cursor', {
              room_id: roomId,
              line: line.number - 1,
              ch: pos - line.from
            })
          }
        })
      ]
    })
  }

  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || window.location.origin, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    })
    socketRef.current = socket

    const view = new EditorView({
      state: buildEditorState('', 'python'),
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
        [data.username]: { line: data.line, ch: data.ch, color: data.color }
      }))
    })

    return () => {
      socket.disconnect()
      view.destroy()
    }
  }, [roomId])

  useEffect(() => {
    if (!viewRef.current) return
    languageRef.current = language
    const currentDoc = viewRef.current.state.doc.toString()
    suppressRef.current = true
    viewRef.current.setState(buildEditorState(currentDoc, language))
    suppressRef.current = false
  }, [language])

  function sendOp(op) {
    if (!pendingOpRef.current) {
      pendingOpRef.current = op
      socketRef.current.emit('operation', {
        room_id: roomId,
        op,
        revision: revisionRef.current
      })
      setTimeout(() => {
        if (pendingOpRef.current === op) {
          pendingOpRef.current = null
          if (bufferedOpRef.current) {
            const buffered = bufferedOpRef.current
            bufferedOpRef.current = null
            sendOp(buffered)
          }
        }
      }, 3000)
    } else {
      bufferedOpRef.current = op
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getInitials(name) {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  async function runCode() {
    if (!viewRef.current) return
    const code = viewRef.current.state.doc.toString()
    setIsRunning(true)
    setOutput('')

    if (language === 'javascript') {
      try {
        const logs = []
        const originalLog = console.log
        console.log = (...args) => logs.push(args.map(String).join(' '))
        eval(code)
        console.log = originalLog
        setOutput(logs.join('\n') || 'Code ran successfully with no output.')
      } catch (err) {
        setOutput(`Error: ${err.message}`)
      }
      setIsRunning(false)
      return
    }

    if (language === 'python') {
      try {
        if (!window.pyodide) {
          setOutput('Loading Python runtime... (first time only, ~10 seconds)')
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
          document.head.appendChild(script)
          await new Promise(resolve => script.onload = resolve)
          window.pyodide = await window.loadPyodide()
        }
        const output = await window.pyodide.runPythonAsync(`
import sys
from io import StringIO
_stdout = StringIO()
sys.stdout = _stdout
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
finally:
    sys.stdout = sys.__stdout__
_stdout.getvalue()
        `)
        setOutput(output || 'Code ran successfully with no output.')
      } catch (err) {
        setOutput(`Error: ${err.message}`)
      }
      setIsRunning(false)
    }
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
        <button
          onClick={runCode}
          disabled={isRunning}
          className="text-xs px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-600 disabled:bg-green-900 disabled:text-green-700 text-white transition-colors font-medium"
        >
          {isRunning ? 'Running...' : '▶ Run'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {users.map((u, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
              style={{ background: u.color }}
              title={u.username}
            >
              {getInitials(u.username)}
            </div>
          ))}
        </div>
      </div>

      {/* Editor + Output */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden relative">
          <div ref={editorRef} className="h-full overflow-auto" />
          {Object.entries(cursors).map(([name, pos]) => (
            <div
              key={name}
              className="absolute pointer-events-none text-xs text-white px-1.5 py-0.5 rounded font-medium"
              style={{
                top: `${pos.line * 20 + 8}px`,
                left: `${pos.ch * 8 + 16}px`,
                background: pos.color || '#7C3AED'
              }}
              title={name}
            >
              {getInitials(name)}
            </div>
          ))}
        </div>

        {/* Output panel */}
        {output && (
          <div className="border-t border-gray-800 bg-gray-900 p-4 max-h-48 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">Output</span>
              <button
                onClick={() => setOutput('')}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap">{output}</pre>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 text-xs text-gray-500">
        revision {revision} · {users.length} user{users.length !== 1 ? 's' : ''} online
      </div>
    </div>
  )
}