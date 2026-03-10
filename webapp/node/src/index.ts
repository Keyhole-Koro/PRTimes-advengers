import { getRequestListener } from '@hono/node-server'
import { createServer } from 'node:http'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { app } from './app.js'
import { ensureDatabaseSchema } from './db/schemaSetup.js'
import { collaborationHub } from './realtime/collaborationHub.js'
import { parseClientRealtimeMessage } from './realtime/messages.js'
import { pressReleaseService } from './services/pressReleaseService.js'
import { v4 as uuidv4 } from 'uuid'
// Wire up the collaboration hub notification through the service callback
// so that routes don't need to know about the collaboration hub
pressReleaseService.onPressReleaseSaved((pressRelease) => {
  collaborationHub.publishSavedSnapshot(pressRelease)
})

const port = parseInt(process.env.PORT || '8080', 10)
const requestListener = getRequestListener(app.fetch)
const server = createServer(requestListener)
const wss = new WebSocketServer({ noServer: true })

type ConnectionMetadata = {
  clientId: string
  pressReleaseId: number
  userId: string
  name: string
  color: string
}

type RealtimeSocket = WebSocket & {
  metadata?: ConnectionMetadata
}

wss.on('connection', (socket: RealtimeSocket) => {
  const metadata = socket.metadata
  if (!metadata) {
    socket.close()
    return
  }

  void collaborationHub.connect(socket, metadata)

  socket.on('message', (rawMessage: RawData) => {
    const message = parseClientRealtimeMessage(rawMessage.toString())
    if (!message) {
      return
    }

    collaborationHub.handleMessage(metadata.clientId, message)
  })

  socket.on('close', () => {
    collaborationHub.disconnect(metadata.clientId)
  })
})

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const matched = requestUrl.pathname.match(/^\/ws\/press-releases\/(\d+)$/)

  if (!matched) {
    socket.destroy()
    return
  }

  const pressReleaseId = parseInt(matched[1], 10)
  const clientId = uuidv4()
  const userId = requestUrl.searchParams.get('userId') || clientId
  const name = requestUrl.searchParams.get('name') || `User ${clientId.slice(0, 4)}`
  const color = requestUrl.searchParams.get('color') || '#2563eb'

  wss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
    ;(websocket as RealtimeSocket).metadata = {
      clientId,
      pressReleaseId,
      userId,
      name,
      color,
    }
    wss.emit('connection', websocket, request)
  })
})

server.listen(port, async () => {
  await ensureDatabaseSchema()
  console.log(`Server is running on http://localhost:${port}`)
})
