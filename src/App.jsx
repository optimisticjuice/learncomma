// Project: deepwiki-mcp-react-demo (JavaScript-only)
// ├── server/
// │   └── index.js        ← Node/Express proxy that connects to the DeepWiki MCP server via SSE (no TypeScript)
// ├── client/
// │   ├── src/App.jsx     ← React UI that calls our proxy and renders results (JSX)
// │   └── src/main.jsx    ← Vite bootstrap (JSX)
// └── package.json        ← Workspaces for server & client (or run separately)

// ==============================
// server/index.js  (plain JS)
// ==============================
// Purpose: Thin proxy that speaks MCP to DeepWiki on the backend (Node env),
//          so your React SPA can just hit simple REST endpoints without dealing
//          with CORS, sessions, or the MCP wire protocol.
// Key idea: The Vercel AI SDK can create an MCP client over SSE. We connect
//           to https://mcp.deepwiki.com/sse and then expose 3 endpoints that map
//           1:1 to DeepWiki's tools: read_wiki_structure, read_wiki_contents, ask_question.


// ==============================
// client/src/App.jsx  (unchanged logic, JS with inline comments)
// ==============================
import { useEffect, useMemo, useState } from 'react'

const API_BASE = 'http://localhost:5174' // 🔁 points to our Node proxy

export default function App() {
  // 🧱 Local component state – simple and explicit
  const [owner, setOwner] = useState('facebook')        // 💡 default to React's org
  const [repo, setRepo] = useState('react')             // 💡 default to the React repo
  const [structure, setStructure] = useState([])        // 🧭 sitemap-like list of topics
  const [selectedTopic, setSelectedTopic] = useState('')// 📌 currently selected doc topic
  const [doc, setDoc] = useState('')                    // 📄 rendered doc content
  const [question, setQuestion] = useState('How does concurrent rendering work?')
  const [answer, setAnswer] = useState('')              // 🤖 DeepWiki Q&A output
  const [loading, setLoading] = useState(false)         // ⏳ UX feedback for async flows
  const [error, setError] = useState('')                // ❗ surface failures in-UI

  const canQuery = useMemo(() => owner.trim() && repo.trim(), [owner, repo])

  useEffect(() => {
    setStructure([])
    setSelectedTopic('')
    setDoc('')
    if (!canQuery) return

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const url = new URL('/api/structure', API_BASE)
        url.searchParams.set('owner', owner)
        url.searchParams.set('repo', repo)
        const res = await fetch(url.href)
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Failed to load structure')

        const items = (json.data || [])
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
        setStructure(items)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [owner, repo, canQuery])

  const loadTopic = async (topic) => {
    if (!topic) return
    setSelectedTopic(topic)
    setDoc('')
    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/contents', API_BASE)
      url.searchParams.set('owner', owner)
      url.searchParams.set('repo', repo)
      url.searchParams.set('topic', topic)
      const res = await fetch(url.href)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to load contents')

      const text = (json.data || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
      setDoc(text)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ask = async () => {
    if (!canQuery || !question.trim()) return
    setAnswer('')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, question })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'ask_question failed')

      const text = (json.data || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
      setAnswer(text)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">DeepWiki → React (MCP) Demo — JS</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          className="border rounded p-2"
          placeholder="owner e.g. facebook"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
        <input
          className="border rounded p-2"
          placeholder="repo e.g. react"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <button
          className="border rounded p-2 disabled:opacity-50"
          disabled={!canQuery || loading}
          onClick={() => setOwner((o) => o)}
        >Refresh Structure</button>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading && <div className="opacity-70 mb-2">Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Topics</h2>
          <ul className="space-y-2">
            {structure.map((topic) => (
              <li key={topic}>
                <button
                  className={`text-left underline ${selectedTopic === topic ? 'font-semibold' : ''}`}
                  onClick={() => loadTopic(topic)}
                >{topic}</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Doc</h2>
          <pre className="whitespace-pre-wrap border rounded p-3 bg-gray-50 min-h-[240px]">{doc || 'Select a topic to view docs…'}</pre>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Ask a question about this repo</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            className="border rounded p-2 md:col-span-4"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How does Suspense interop with server components?"
          />
          <button className="border rounded p-2" disabled={!canQuery || loading} onClick={ask}>Ask</button>
        </div>
        <pre className="whitespace-pre-wrap border rounded p-3 bg-gray-50 mt-3 min-h-[160px]">{answer || 'The answer will appear here with context.'}</pre>
      </div>
    </div>
  )
}
// ==============================
// client/src/main.jsx
// ==============================
// ==============================
// package.json (root – optional workspace)
// ==============================
// If you prefer separate folders, create 2 package.json files (one in /server, one in /client).
// This root example sets up scripts to run both quickly in dev.


// ==============================
// server/package.json  (JS only)
// ==============================

// ==============================
// client/package.json
// ==============================

// ==============================
// 🏁 Quickstart (local dev)
// ==============================
// 1) Terminal A: cd server && npm i && npm run start  → or from root: npm run dev:server
//    If you don’t have a start script, just: node index.js
// 2) Terminal B: cd client && npm i && npm run dev (Vite). Open http://localhost:5173
// 3) The client will call the proxy at http://localhost:5174
//
// Pro tips:
// - If you deploy the proxy, swap API_BASE to your server URL.
// - For production, add caching on /api/structure (topics change rarely).
// - Prefer SSE for now; Streamable HTTP is also supported by the server but requires a different transport config in the MCP client.
