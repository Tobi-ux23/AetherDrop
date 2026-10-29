import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    roomsCount: rooms.size,
  });
});

// Real-time WebRTC & Relay Signaling via WebSocket
interface PeerInfo {
  id: string;
  name: string;
  deviceType: 'phone' | 'pc' | 'tablet';
  os: string;
  browser: string;
}

interface PeerConnection {
  ws: WebSocket;
  peerInfo: PeerInfo;
  roomId: string;
  isAlive: boolean;
}

const rooms = new Map<string, Map<string, PeerConnection>>();

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // If not /ws, let Vite or Express handle it (e.g. Vite HMR if active)
  }
});

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentPeerId: string | null = null;
  let currentPeerInfo: PeerInfo | null = null;

  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  const send = (targetWs: WebSocket, message: Record<string, any>) => {
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify(message));
    }
  };

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'join-room': {
          const { roomId, peerInfo } = msg;
          if (!roomId || !peerInfo?.id) return;

          currentRoomId = roomId;
          currentPeerId = peerInfo.id;
          currentPeerInfo = peerInfo;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }

          const room = rooms.get(roomId)!;

          // Gather existing peers in room
          const existingPeers: PeerInfo[] = [];
          for (const [id, peer] of room.entries()) {
            if (id !== peerInfo.id && peer.ws.readyState === WebSocket.OPEN) {
              existingPeers.push(peer.peerInfo);
            }
          }

          // Register new peer
          room.set(peerInfo.id, {
            ws,
            peerInfo,
            roomId,
            isAlive: true,
          });

          // Send current peers to joining peer
          send(ws, {
            type: 'room-peers',
            peers: existingPeers,
          });

          // Broadcast peer-joined to other peers in room
          for (const [id, peer] of room.entries()) {
            if (id !== peerInfo.id) {
              send(peer.ws, {
                type: 'peer-joined',
                peer: peerInfo,
              });
            }
          }
          break;
        }

        case 'signal': {
          // WebRTC SDP Offer / Answer / ICE Candidate
          const { targetPeerId, data } = msg;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetPeer = room.get(targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            send(targetPeer.ws, {
              type: 'signal',
              senderPeerId: currentPeerId,
              data,
            });
          }
          break;
        }

        case 'relay-meta': {
          // Direct fallback encrypted metadata
          const { targetPeerId, metadata } = msg;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetPeer = room.get(targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            send(targetPeer.ws, {
              type: 'relay-meta',
              senderPeerId: currentPeerId,
              metadata,
            });
          }
          break;
        }

        case 'relay-chunk': {
          // Fallback encrypted chunk relay if WebRTC DataChannel cannot connect
          const { targetPeerId, transferId, chunkIndex, totalChunks, payload } = msg;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetPeer = room.get(targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            send(targetPeer.ws, {
              type: 'relay-chunk',
              senderPeerId: currentPeerId,
              transferId,
              chunkIndex,
              totalChunks,
              payload,
            });
          }
          break;
        }

        case 'relay-ack': {
          const { targetPeerId, transferId, chunkIndex } = msg;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetPeer = room.get(targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            send(targetPeer.ws, {
              type: 'relay-ack',
              senderPeerId: currentPeerId,
              transferId,
              chunkIndex,
            });
          }
          break;
        }

        case 'relay-response': {
          const { targetPeerId, transferId, accepted, receiverName, reason } = msg;
          if (!currentRoomId || !targetPeerId) return;

          const room = rooms.get(currentRoomId);
          if (!room) return;

          const targetPeer = room.get(targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            send(targetPeer.ws, {
              type: 'relay-response',
              senderPeerId: currentPeerId,
              transferId,
              accepted,
              receiverName,
              reason,
            });
          }
          break;
        }

        case 'ping': {
          send(ws, { type: 'pong' });
          break;
        }
      }
    } catch (err) {
      console.error('Error processing WS message:', err);
    }
  });

  const cleanup = () => {
    if (currentRoomId && currentPeerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.delete(currentPeerId);
        // Broadcast peer-left to remaining peers
        for (const peer of room.values()) {
          send(peer.ws, {
            type: 'peer-left',
            peerId: currentPeerId,
          });
        }
        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// Heartbeat ping interval
const interval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on('close', () => {
  clearInterval(interval);
});

// Configure Vite in development or static serve in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AetherDrop server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
