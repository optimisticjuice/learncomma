import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

// ⚛️ Experimental MCP client (JavaScript import)
import { experimental_createMCPClient as createMcpClient } from 'ai'

// "Singleton" MCP connection so we don't reconnect on every HTTP request.
let mcpClientPromise = null

async function getMcpClient() {
  // 🧠 Lazy-init so local dev restarts are snappy.
  if (!mcpClientPromise) {
    mcpClientPromise = createMcpClient({
      name: 'deepwiki-react-proxy',                // 👋 identifies your client to the MCP server
      transport: { type: 'sse', url: 'https://mcp.deepwiki.com/sse' } // 🌐 official DeepWiki MCP SSE endpoint
    })
  }
  return mcpClientPromise
}

const app = express()
app.use(cors()) // 🔓 allow your Vite dev server to call us
app.use(bodyParser.json())

// 🧭 GET /api/structure?owner=facebook&repo=react
app.get('/api/structure', async (req, res) => {
  try {
    const { owner, repo } = req.query
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' })

    const client = await getMcpClient()

    // 🔧 Call DeepWiki's tool: read_wiki_structure
    const result = await client.tool.invoke({
      server: { type: 'sse', url: 'https://mcp.deepwiki.com/sse' },
      toolName: 'read_wiki_structure',
      arguments: { owner, repo },
    })

    res.json({ ok: true, data: result?.content ?? [] })
  } catch (err) {
    console.error('structure error', err)
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' })
  }
})

// ❓ POST /api/ask  body: { owner, repo, question }
app.post('/api/ask', async (req, res) => {
    try {
      const { owner, repo, question } = req.body
      if (!owner || !repo || !question) return res.status(400).json({ error: 'owner, repo, question are required' })
  
      const client = await getMcpClient()
      const result = await client.tool.invoke({
        server: { type: 'sse', url: 'https://mcp.deepwiki.com/sse' },
        toolName: 'ask_question',
        arguments: { owner, repo, question },
      })
  
      res.json({ ok: true, data: result?.content ?? [] })
    } catch (err) {
      console.error('ask error', err)
      res.status(500).json({ ok: false, error: err?.message || 'unknown error' })
    }
  })
  
  app.listen(5174, () => {
    console.log('🔌 DeepWiki MCP proxy running on http://localhost:5174')
  })