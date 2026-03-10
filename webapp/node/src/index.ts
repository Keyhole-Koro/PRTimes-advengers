import { getRequestListener } from '@hono/node-server'
import { createServer } from 'node:http'
import { app } from './app.js'
import { config } from './config.js'
import { ensureDatabaseSchema } from './db/schemaSetup.js'
import { collaborationHub } from './infrastructure/realtime/collaborationHub.js'
import { registerPressReleaseCollaborationHandler } from './interfaces/ws/handlers/pressReleaseCollaborationHandler.js'
import { pressReleaseService } from './services/pressReleaseService.js'

// Wire up the collaboration hub notification through the service callback
// so that routes don't need to know about the collaboration hub
pressReleaseService.onPressReleaseSaved((pressRelease) => {
  collaborationHub.publishSavedSnapshot(pressRelease)
})

const port = config.port
const requestListener = getRequestListener(app.fetch)
const server = createServer(requestListener)
registerPressReleaseCollaborationHandler(server)

server.listen(port, async () => {
  await ensureDatabaseSchema()
  console.log(`Server is running on http://localhost:${port}`)
})
