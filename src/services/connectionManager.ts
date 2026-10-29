import {
  DeviceType,
  FileChunkMessage,
  FileMetadataMessage,
  FileRequestMessage,
  FileResponseMessage,
  IncomingTransferRequest,
  PeerInfo,
  QuickTextMessage,
  TransferHistoryEntry,
  TransferItem,
} from '../types';
import {
  computeSecurityFingerprint,
  deriveEncryptionKey,
  deriveSecretFromRoomCodeSync,
  decryptChunk,
  encryptChunk,
  encryptText,
  decryptText,
  generateRoomCode,
  generateSalt,
  bufToHex,
  hexToBuf,
} from '../utils/crypto';
import { getDeviceInfo } from '../utils/device';

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 64 * 1024; // 64 KB

export type ConnectionListener = () => void;

interface ActiveReceivingFile {
  metadata: FileMetadataMessage;
  key: CryptoKey;
  chunks: ArrayBuffer[];
  receivedCount: number;
  startTime: number;
  lastUpdate: number;
  lastBytes: number;
  currentSpeed: number;
  transferItem: TransferItem;
}

export class ConnectionManager {
  private ws: WebSocket | null = null;
  public localPeer: PeerInfo;
  public roomId: string = '';
  public roomSecret: string = '';
  public securityFingerprint: { emojis: string; hex: string } = { emojis: '', hex: '' };
  public peers: Map<string, PeerInfo> = new Map();
  public peerTransports: Map<string, 'webrtc' | 'relay'> = new Map();

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  // Active transfers (send or receive)
  public activeTransfers: Map<string, TransferItem> = new Map();
  private receivingFiles: Map<string, ActiveReceivingFile> = new Map();
  private sendingControls: Map<string, { paused: boolean; cancelled: boolean }> = new Map();
  private pendingOutgoingFiles: Map<string, { file: File; item: TransferItem; saltHex: string }> = new Map();
  private fileSources: Map<string, { file: File; targetPeerId: string }> = new Map();

  // Incoming transfer requests awaiting receiver approval
  public incomingRequests: IncomingTransferRequest[] = [];

  // Transfer history
  public history: TransferHistoryEntry[] = [];

  // Quick texts
  public quickTexts: QuickTextMessage[] = [];

  // Connection & Room state
  public inRoom: boolean = false;
  private listeners: Set<ConnectionListener> = new Set();
  public isConnected: boolean = false;
  public reconnectAttempts: number = 0;

  constructor() {
    this.localPeer = getDeviceInfo();
    this.loadHistory();
    this.initRoomParams();
  }

  public subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem('aetherdrop_history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem('aetherdrop_history', JSON.stringify(this.history.slice(0, 50)));
    } catch (err) {
      console.warn('Failed to save transfer history', err);
    }
  }

  public clearHistory() {
    this.history = [];
    this.saveHistory();
    this.notify();
  }

  private initRoomParams() {
    const url = new URL(window.location.href);
    const roomParam = url.searchParams.get('room');
    const keyHash = window.location.hash.replace(/^#key=/, '').trim();

    if (roomParam && roomParam.trim()) {
      this.roomId = roomParam.trim().toUpperCase();
      this.inRoom = true;

      const isLegacyAutoHash = keyHash.length === 32 && /^[0-9a-fA-F]+$/.test(keyHash);
      if (keyHash && !isLegacyAutoHash) {
        this.roomSecret = deriveSecretFromRoomCodeSync(this.roomId, keyHash);
      } else {
        this.roomSecret = deriveSecretFromRoomCodeSync(this.roomId);
      }

      if (isLegacyAutoHash) {
        url.hash = '';
        window.history.replaceState(null, '', url.toString());
      }
      this.securityFingerprint = computeSecurityFingerprint(this.roomSecret);
    } else {
      this.roomId = '';
      this.inRoom = false;
      this.roomSecret = '';
      this.securityFingerprint = { emojis: '', hex: '' };
    }
  }

  public createRoom(): string {
    const newRoomCode = generateRoomCode();
    this.setRoom(newRoomCode);
    return newRoomCode;
  }

  public joinRoom(roomCode: string) {
    if (!roomCode.trim()) return;
    this.setRoom(roomCode.trim().toUpperCase());
  }

  public leaveRoom() {
    this.disconnectAllPeers();
    this.inRoom = false;
    this.roomId = '';
    this.roomSecret = '';
    this.securityFingerprint = { emojis: '', hex: '' };

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
    this.notify();
  }

  public setRoom(newRoomId: string, newSecret?: string) {
    const cleanRoom = newRoomId.trim().toUpperCase();
    this.roomId = cleanRoom;
    this.inRoom = true;

    if (newSecret?.trim()) {
      this.roomSecret = deriveSecretFromRoomCodeSync(this.roomId, newSecret.trim());
    } else {
      this.roomSecret = deriveSecretFromRoomCodeSync(this.roomId);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomId);
    if (newSecret?.trim()) {
      url.hash = `key=${newSecret.trim()}`;
    } else {
      url.hash = '';
    }
    window.history.replaceState(null, '', url.toString());

    this.securityFingerprint = computeSecurityFingerprint(this.roomSecret);
    this.notify();

    // Reset connections and reconnect to new room
    this.disconnectAllPeers();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendWs({
        type: 'join-room',
        roomId: this.roomId,
        peerInfo: this.localPeer,
      });
    } else {
      this.connectWebSocket();
    }
    this.notify();
  }

  public setDeviceName(newName: string) {
    if (!newName.trim()) return;
    this.localPeer.name = newName.trim();
    localStorage.setItem('aetherdrop_device_name', this.localPeer.name);
    // Notify room of updated name
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.inRoom && this.roomId) {
      this.sendWs({
        type: 'join-room',
        roomId: this.roomId,
        peerInfo: this.localPeer,
      });
    }
    this.notify();
  }

  public connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.inRoom && this.roomId) {
          this.sendWs({
            type: 'join-room',
            roomId: this.roomId,
            peerInfo: this.localPeer,
          });
        }
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notify();
        // Auto-reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
        this.reconnectAttempts++;
        setTimeout(() => {
          this.connectWebSocket();
        }, delay);
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket signaling error', err);
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket', e);
    }
  }

  private sendWs(msg: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'room-peers': {
        const peersList: PeerInfo[] = msg.peers || [];
        this.peers.clear();
        peersList.forEach((p) => {
          this.peers.set(p.id, p);
          this.initiatePeerConnection(p.id, true);
        });
        this.notify();
        break;
      }

      case 'peer-joined': {
        const peer: PeerInfo = msg.peer;
        if (peer && peer.id !== this.localPeer.id) {
          this.peers.set(peer.id, peer);
          // The peer with alphabetically lower ID initiates WebRTC offer
          const shouldOffer = this.localPeer.id < peer.id;
          this.initiatePeerConnection(peer.id, shouldOffer);
          this.notify();
        }
        break;
      }

      case 'peer-left': {
        const peerId = msg.peerId;
        this.closePeer(peerId);
        this.peers.delete(peerId);
        this.peerTransports.delete(peerId);
        this.notify();
        break;
      }

      case 'signal': {
        this.handlePeerSignal(msg.senderPeerId, msg.data);
        break;
      }

      case 'relay-meta': {
        const meta = msg.metadata;
        if (meta?.type === 'file-request') {
          this.handleIncomingFileRequest(msg.senderPeerId, meta, 'relay');
        } else if (meta?.type === 'file-cancel-request') {
          this.incomingRequests = this.incomingRequests.filter((r) => r.transferId !== meta.transferId);
          this.notify();
        } else {
          this.handleEncryptedMetaMessage(msg.senderPeerId, meta, 'relay');
        }
        break;
      }

      case 'relay-response': {
        this.handleFileResponse(msg);
        break;
      }

      case 'relay-chunk': {
        this.handleEncryptedChunkMessage(msg);
        break;
      }

      case 'relay-ack': {
        this.handleAckMessage(msg.transferId, msg.chunkIndex);
        break;
      }
    }
  }

  private initiatePeerConnection(targetPeerId: string, shouldOffer: boolean) {
    if (this.peerConnections.has(targetPeerId)) {
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    this.peerConnections.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWs({
          type: 'signal',
          targetPeerId,
          data: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.peerTransports.set(targetPeerId, 'webrtc');
        this.notify();
      } else if (state === 'failed' || state === 'disconnected') {
        // Fallback to relay seamlessly
        this.peerTransports.set(targetPeerId, 'relay');
        this.notify();
      }
    };

    if (shouldOffer) {
      // Create DataChannel
      const dc = pc.createDataChannel('aetherdrop-data', {
        ordered: true,
      });
      this.setupDataChannel(targetPeerId, dc);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.sendWs({
            type: 'signal',
            targetPeerId,
            data: {
              type: 'offer',
              sdp: pc.localDescription,
            },
          });
        })
        .catch((err) => {
          console.warn('Failed to create WebRTC offer, falling back to relay', err);
          this.peerTransports.set(targetPeerId, 'relay');
          this.notify();
        });
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(targetPeerId, event.channel);
      };
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 128 * 1024; // 128KB threshold for backpressure

    dc.onopen = () => {
      this.dataChannels.set(peerId, dc);
      this.peerTransports.set(peerId, 'webrtc');
      this.notify();
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
      this.peerTransports.set(peerId, 'relay');
      this.notify();
    };

    dc.onerror = (e) => {
      console.warn('DataChannel error', e);
      this.peerTransports.set(peerId, 'relay');
      this.notify();
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'file-request') {
            this.handleIncomingFileRequest(peerId, msg, 'webrtc');
          } else if (msg.type === 'file-response') {
            this.handleFileResponse(msg);
          } else if (msg.type === 'file-cancel-request') {
            this.incomingRequests = this.incomingRequests.filter((r) => r.transferId !== msg.transferId);
            this.notify();
          } else if (msg.type === 'file-metadata') {
            this.handleEncryptedMetaMessage(peerId, msg, 'webrtc');
          } else if (msg.type === 'file-chunk') {
            this.handleEncryptedChunkMessage(msg);
          } else if (msg.type === 'file-ack') {
            this.handleAckMessage(msg.transferId, msg.chunkIndex);
          } else if (msg.type === 'quick-text') {
            this.handleQuickText(msg);
          }
        }
      } catch (err) {
        console.error('Error handling data channel message', err);
      }
    };
  }

  private async handlePeerSignal(senderPeerId: string, data: any) {
    let pc = this.peerConnections.get(senderPeerId);
    if (!pc) {
      this.initiatePeerConnection(senderPeerId, false);
      pc = this.peerConnections.get(senderPeerId)!;
    }

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendWs({
          type: 'signal',
          targetPeerId: senderPeerId,
          data: {
            type: 'answer',
            sdp: pc.localDescription,
          },
        });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'candidate') {
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    } catch (err) {
      console.warn('Error handling WebRTC signal, falling back to relay', err);
      this.peerTransports.set(senderPeerId, 'relay');
      this.notify();
    }
  }

  private closePeer(peerId: string) {
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try {
        dc.close();
      } catch {}
      this.dataChannels.delete(peerId);
    }
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peerConnections.delete(peerId);
    }

    // Mark active in-progress send transfers to this peer as error with retry enabled
    for (const [id, item] of this.activeTransfers.entries()) {
      if (item.peerId === peerId && (item.status === 'transferring' || item.status === 'awaiting_approval' || item.status === 'paused')) {
        item.status = 'error';
        item.error = 'Recipient disconnected';
        item.canRetry = this.fileSources.has(id);
        const ctrl = this.sendingControls.get(id);
        if (ctrl) ctrl.cancelled = true;
      }
    }
  }

  private disconnectAllPeers() {
    for (const peerId of this.peerConnections.keys()) {
      this.closePeer(peerId);
    }
    this.peers.clear();
    this.peerTransports.clear();
  }

  // --- SENDING FILES UP TO 500MB ---

  public async sendFile(file: File, targetPeerId?: string): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File is too large. Max supported size is 500MB.`);
    }

    // Determine target peer(s)
    let peerId = targetPeerId;
    if (!peerId) {
      const firstPeer = Array.from(this.peers.keys())[0];
      if (!firstPeer) {
        throw new Error('No device connected. Please pair or connect another device first.');
      }
      peerId = firstPeer;
    }

    const peer = this.peers.get(peerId);
    const peerName = peer?.name || 'Remote Device';
    const transport = this.dataChannels.get(peerId)?.readyState === 'open' ? 'webrtc' : 'relay';

    const transferId = 'tx_' + Math.random().toString(36).substring(2, 10);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const salt = generateSalt();
    const saltHex = bufToHex(salt);

    const transferItem: TransferItem = {
      id: transferId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      direction: 'send',
      peerId,
      peerName,
      status: 'awaiting_approval',
      progress: 0,
      transferredBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
      startedAt: Date.now(),
      transportType: transport,
      encryption: 'AES-256-GCM',
      chunksCompleted: 0,
      totalChunks: Math.max(1, totalChunks),
    };

    this.activeTransfers.set(transferId, transferItem);
    this.sendingControls.set(transferId, { paused: false, cancelled: false });
    this.pendingOutgoingFiles.set(transferId, { file, item: transferItem, saltHex });
    this.fileSources.set(transferId, { file, targetPeerId: peerId });
    this.notify();

    // Send transfer request message to receiver
    const reqMsg: FileRequestMessage = {
      type: 'file-request',
      transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      chunkSize: CHUNK_SIZE,
      saltHex,
      senderName: this.localPeer.name,
      fingerprintHex: this.securityFingerprint.hex,
    };

    const dc = this.dataChannels.get(peerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(reqMsg));
    } else {
      this.sendWs({
        type: 'relay-meta',
        targetPeerId: peerId,
        metadata: reqMsg,
      });
    }

    return transferId;
  }

  private async streamFile(file: File, item: TransferItem, saltHex: string) {
    const { peerId, id: transferId, totalChunks } = item;
    const dc = this.dataChannels.get(peerId);
    const useWebRtc = dc && dc.readyState === 'open';

    try {
      // Derive AES-256-GCM encryption key with salt
      const salt = hexToBuf(saltHex);
      const cryptoKey = await deriveEncryptionKey(this.roomSecret, salt);

      item.status = 'transferring';
      this.notify();

      // Send metadata
      const metaMsg: FileMetadataMessage = {
        type: 'file-metadata',
        transferId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        chunkSize: CHUNK_SIZE,
        saltHex,
        senderName: this.localPeer.name,
        fingerprintHex: this.securityFingerprint.hex,
      };

      if (useWebRtc) {
        dc.send(JSON.stringify(metaMsg));
      } else {
        this.sendWs({
          type: 'relay-meta',
          targetPeerId: peerId,
          metadata: metaMsg,
        });
      }

      // Stream chunks with backpressure
      let offset = 0;
      let chunkIndex = 0;
      const startTime = Date.now();
      let lastTime = startTime;
      let lastBytes = 0;

      while (offset < file.size || (file.size === 0 && chunkIndex === 0)) {
        const controls = this.sendingControls.get(transferId);
        if (controls?.cancelled) {
          item.status = 'cancelled';
          this.activeTransfers.delete(transferId);
          this.notify();
          return;
        }

        while (controls?.paused) {
          item.status = 'paused';
          this.notify();
          await new Promise((r) => setTimeout(r, 200));
          if (controls.cancelled) return;
        }
        item.status = 'transferring';

        // Check WebRTC DataChannel backpressure
        if (useWebRtc && dc.bufferedAmount > 512 * 1024) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc.addEventListener('bufferedamountlow', onLow);
          });
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await slice.arrayBuffer();

        // Encrypt chunk using AES-256-GCM
        const encrypted = await encryptChunk(cryptoKey, arrayBuffer);

        const chunkMsg: FileChunkMessage = {
          type: 'file-chunk',
          transferId,
          chunkIndex,
          totalChunks,
          ivHex: encrypted.ivHex,
          encryptedBase64: encrypted.encryptedBase64,
        };

        const serialized = JSON.stringify(chunkMsg);

        if (useWebRtc) {
          dc.send(serialized);
        } else {
          this.sendWs({
            type: 'relay-chunk',
            targetPeerId: peerId,
            transferId,
            chunkIndex,
            totalChunks,
            payload: chunkMsg,
          });

          // Small throttling for relay mode to prevent buffer overflow
          if (chunkIndex % 8 === 0) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        offset += arrayBuffer.byteLength;
        chunkIndex++;
        item.chunksCompleted = chunkIndex;
        item.transferredBytes = Math.min(offset, file.size);
        item.progress = file.size === 0 ? 100 : Math.min(100, (offset / file.size) * 100);

        // Calculate moving speed and ETA
        const now = Date.now();
        const deltaSec = (now - lastTime) / 1000;
        if (deltaSec >= 0.5 || chunkIndex === totalChunks) {
          const deltaBytes = item.transferredBytes - lastBytes;
          item.speedBps = deltaSec > 0 ? deltaBytes / deltaSec : 0;
          const remainingBytes = file.size - item.transferredBytes;
          item.etaSeconds = item.speedBps > 0 ? remainingBytes / item.speedBps : 0;
          lastTime = now;
          lastBytes = item.transferredBytes;
          this.notify();
        }

        if (file.size === 0) break;
      }

      // Completed
      item.status = 'completed';
      item.progress = 100;
      item.transferredBytes = file.size;
      item.endedAt = Date.now();
      const durationMs = item.endedAt - startTime;
      item.speedBps = durationMs > 0 ? (file.size / (durationMs / 1000)) : 0;

      // Add to transfer history
      const historyEntry: TransferHistoryEntry = {
        id: transferId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        direction: 'send',
        peerName: item.peerName,
        status: 'completed',
        startedAt: startTime,
        endedAt: item.endedAt,
        durationMs,
        avgSpeedBps: item.speedBps,
        transportType: item.transportType,
        encryption: 'AES-256-GCM',
      };
      this.history.unshift(historyEntry);
      this.saveHistory();
      this.playChime();
      this.notify();

      // Clean active item after 4 seconds
      setTimeout(() => {
        this.activeTransfers.delete(transferId);
        this.fileSources.delete(transferId);
        this.notify();
      }, 4000);
    } catch (err: any) {
      console.error('File streaming failed:', err);
      item.status = 'error';
      item.error = err?.message || 'Transfer failed';
      item.canRetry = this.fileSources.has(transferId);
      this.notify();
    }
  }

  // --- INCOMING TRANSFER APPROVAL FLOW ---

  private handleIncomingFileRequest(senderPeerId: string, meta: any, transport: 'webrtc' | 'relay') {
    const sender = this.peers.get(senderPeerId);
    const senderName = meta.senderName || sender?.name || 'Remote Device';

    // Prevent duplicate request notifications
    const existingIndex = this.incomingRequests.findIndex((r) => r.transferId === meta.transferId);
    if (existingIndex !== -1) return;

    const req: IncomingTransferRequest = {
      transferId: meta.transferId,
      senderPeerId,
      senderName,
      name: meta.name,
      size: meta.size,
      mimeType: meta.mimeType || 'application/octet-stream',
      totalChunks: meta.totalChunks,
      chunkSize: meta.chunkSize || CHUNK_SIZE,
      saltHex: meta.saltHex,
      fingerprintHex: meta.fingerprintHex,
      transportType: transport,
      requestedAt: Date.now(),
    };

    this.incomingRequests.push(req);
    this.playRequestChime();
    this.notify();
  }

  public async acceptTransfer(transferId: string) {
    const reqIndex = this.incomingRequests.findIndex((r) => r.transferId === transferId);
    if (reqIndex === -1) return;

    const req = this.incomingRequests[reqIndex];
    this.incomingRequests.splice(reqIndex, 1);

    // Initialize the active receiving item and key
    await this.handleEncryptedMetaMessage(req.senderPeerId, {
      type: 'file-metadata',
      transferId: req.transferId,
      name: req.name,
      size: req.size,
      mimeType: req.mimeType,
      totalChunks: req.totalChunks,
      chunkSize: req.chunkSize,
      saltHex: req.saltHex,
      senderName: req.senderName,
      fingerprintHex: req.fingerprintHex,
    }, req.transportType);

    // Send positive file-response to sender
    const responseMsg: FileResponseMessage = {
      type: 'file-response',
      transferId,
      accepted: true,
      receiverName: this.localPeer.name,
    };

    const dc = this.dataChannels.get(req.senderPeerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(responseMsg));
    } else {
      this.sendWs({
        type: 'relay-response',
        targetPeerId: req.senderPeerId,
        transferId,
        accepted: true,
        receiverName: this.localPeer.name,
      });
    }

    this.notify();
  }

  public declineTransfer(transferId: string, reason = 'Declined by recipient') {
    const reqIndex = this.incomingRequests.findIndex((r) => r.transferId === transferId);
    if (reqIndex === -1) return;

    const req = this.incomingRequests[reqIndex];
    this.incomingRequests.splice(reqIndex, 1);

    // Send decline response to sender
    const responseMsg: FileResponseMessage = {
      type: 'file-response',
      transferId,
      accepted: false,
      receiverName: this.localPeer.name,
      reason,
    };

    const dc = this.dataChannels.get(req.senderPeerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(responseMsg));
    } else {
      this.sendWs({
        type: 'relay-response',
        targetPeerId: req.senderPeerId,
        transferId,
        accepted: false,
        receiverName: this.localPeer.name,
        reason,
      });
    }

    this.notify();
  }

  private handleFileResponse(msg: any) {
    const { transferId, accepted, receiverName, reason } = msg;
    const pending = this.pendingOutgoingFiles.get(transferId);
    if (!pending) return;

    if (accepted) {
      // Recipient accepted! Begin streaming file chunks!
      this.pendingOutgoingFiles.delete(transferId);
      this.streamFile(pending.file, pending.item, pending.saltHex);
    } else {
      // Recipient declined!
      this.pendingOutgoingFiles.delete(transferId);
      const item = pending.item;
      item.status = 'declined';
      item.error = reason || `${receiverName || 'Recipient'} declined the transfer`;
      item.canRetry = this.fileSources.has(transferId);

      const historyEntry: TransferHistoryEntry = {
        id: transferId,
        name: pending.file.name,
        size: pending.file.size,
        type: pending.file.type || 'application/octet-stream',
        direction: 'send',
        peerName: item.peerName,
        status: 'declined',
        startedAt: item.startedAt,
        endedAt: Date.now(),
        durationMs: Date.now() - item.startedAt,
        avgSpeedBps: 0,
        transportType: item.transportType,
        encryption: 'AES-256-GCM',
      };
      this.history.unshift(historyEntry);
      this.saveHistory();
      this.notify();
    }
  }

  // --- RECEIVING FILES UP TO 500MB ---

  private async handleEncryptedMetaMessage(senderPeerId: string, meta: FileMetadataMessage, transport: 'webrtc' | 'relay') {
    const sender = this.peers.get(senderPeerId);
    const senderName = meta.senderName || sender?.name || 'Remote Device';

    try {
      const salt = hexToBuf(meta.saltHex);
      const key = await deriveEncryptionKey(this.roomSecret, salt);

      const transferItem: TransferItem = {
        id: meta.transferId,
        name: meta.name,
        size: meta.size,
        type: meta.mimeType,
        direction: 'receive',
        peerId: senderPeerId,
        peerName: senderName,
        status: 'transferring',
        progress: 0,
        transferredBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        startedAt: Date.now(),
        transportType: transport,
        encryption: 'AES-256-GCM',
        chunksCompleted: 0,
        totalChunks: meta.totalChunks,
      };

      this.activeTransfers.set(meta.transferId, transferItem);

      this.receivingFiles.set(meta.transferId, {
        metadata: meta,
        key,
        chunks: new Array(meta.totalChunks),
        receivedCount: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        lastBytes: 0,
        currentSpeed: 0,
        transferItem,
      });

      this.notify();
    } catch (err) {
      console.error('Failed to initialize incoming encrypted file transfer', err);
    }
  }

  private async handleEncryptedChunkMessage(chunkMsg: any) {
    const fileChunk: FileChunkMessage = chunkMsg.payload || chunkMsg;
    const receiving = this.receivingFiles.get(fileChunk.transferId);
    if (!receiving) return;

    let decryptedBuf: ArrayBuffer | null = null;

    try {
      // Decrypt chunk with AES-256-GCM
      decryptedBuf = await decryptChunk(
        receiving.key,
        fileChunk.encryptedBase64,
        fileChunk.ivHex
      );
    } catch (err: any) {
      // Self-healing: if the sender used the standard room-derived key (e.g. joined by room code),
      // attempt recovery with the deterministic room secret.
      try {
        const roomDerivedSecret = deriveSecretFromRoomCodeSync(this.roomId);
        const salt = hexToBuf(receiving.metadata.saltHex);
        const fallbackKey = await deriveEncryptionKey(roomDerivedSecret, salt);
        decryptedBuf = await decryptChunk(
          fallbackKey,
          fileChunk.encryptedBase64,
          fileChunk.ivHex
        );
        // Fallback succeeded! Adopt this key for all subsequent chunks
        receiving.key = fallbackKey;
        this.roomSecret = roomDerivedSecret;
        this.securityFingerprint = computeSecurityFingerprint(this.roomSecret);
        this.notify();
      } catch (fallbackErr) {
        // Fallback also failed
        console.error('Failed to decrypt received chunk:', err);
        receiving.transferItem.status = 'error';
        receiving.transferItem.error = 'Encryption key mismatch. Ensure both devices are in room ' + this.roomId;
        this.notify();
        return;
      }
    }

    if (!decryptedBuf) return;

    receiving.chunks[fileChunk.chunkIndex] = decryptedBuf;
    receiving.receivedCount++;

    const item = receiving.transferItem;
    item.chunksCompleted = receiving.receivedCount;
    item.transferredBytes = Math.min(
      receiving.metadata.size,
      item.transferredBytes + decryptedBuf.byteLength
    );
    item.progress =
      receiving.metadata.size === 0
        ? 100
        : Math.min(100, (item.transferredBytes / receiving.metadata.size) * 100);

    // Speed & ETA
    const now = Date.now();
    const deltaSec = (now - receiving.lastUpdate) / 1000;
    if (deltaSec >= 0.5 || receiving.receivedCount === receiving.metadata.totalChunks) {
      const deltaBytes = item.transferredBytes - receiving.lastBytes;
      item.speedBps = deltaSec > 0 ? deltaBytes / deltaSec : 0;
      const remainingBytes = receiving.metadata.size - item.transferredBytes;
      item.etaSeconds = item.speedBps > 0 ? remainingBytes / item.speedBps : 0;
      receiving.lastUpdate = now;
      receiving.lastBytes = item.transferredBytes;
      this.notify();
    }

    // Check if all chunks received
    if (receiving.receivedCount === receiving.metadata.totalChunks) {
      this.finalizeReceivedFile(receiving);
    }
  }

  private finalizeReceivedFile(receiving: ActiveReceivingFile) {
    const { metadata, chunks, transferItem, startTime } = receiving;
    transferItem.status = 'completed';
    transferItem.progress = 100;
    transferItem.endedAt = Date.now();
    const durationMs = transferItem.endedAt - startTime;
    transferItem.speedBps = durationMs > 0 ? (metadata.size / (durationMs / 1000)) : 0;

    // Create Blob from decrypted chunks
    const blob = new Blob(chunks, { type: metadata.mimeType || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    transferItem.blobUrl = blobUrl;

    // Trigger instant browser download
    this.triggerDownload(blobUrl, metadata.name);

    // Add to persistent History
    const historyEntry: TransferHistoryEntry = {
      id: metadata.transferId,
      name: metadata.name,
      size: metadata.size,
      type: metadata.mimeType,
      direction: 'receive',
      peerName: transferItem.peerName,
      status: 'completed',
      startedAt: startTime,
      endedAt: transferItem.endedAt,
      durationMs,
      avgSpeedBps: transferItem.speedBps,
      transportType: transferItem.transportType,
      encryption: 'AES-256-GCM',
      blobUrl,
    };

    this.history.unshift(historyEntry);
    this.saveHistory();
    this.playChime();
    this.receivingFiles.delete(metadata.transferId);
    this.notify();
  }

  public triggerDownload(blobUrl: string, fileName: string) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  }

  public pauseTransfer(transferId: string) {
    const ctrl = this.sendingControls.get(transferId);
    if (ctrl) {
      ctrl.paused = true;
      const item = this.activeTransfers.get(transferId);
      if (item) item.status = 'paused';
      this.notify();
    }
  }

  public resumeTransfer(transferId: string) {
    const ctrl = this.sendingControls.get(transferId);
    if (ctrl) {
      ctrl.paused = false;
      const item = this.activeTransfers.get(transferId);
      if (item) item.status = 'transferring';
      this.notify();
    }
  }

  public cancelTransfer(transferId: string) {
    const ctrl = this.sendingControls.get(transferId);
    if (ctrl) {
      ctrl.cancelled = true;
    }

    const pending = this.pendingOutgoingFiles.get(transferId);
    if (pending) {
      this.pendingOutgoingFiles.delete(transferId);
      const cancelMsg = {
        type: 'file-cancel-request',
        transferId,
      };
      const dc = this.dataChannels.get(pending.item.peerId);
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify(cancelMsg));
      } else {
        this.sendWs({
          type: 'relay-meta',
          targetPeerId: pending.item.peerId,
          metadata: cancelMsg,
        });
      }
    }

    this.activeTransfers.delete(transferId);
    this.sendingControls.delete(transferId);
    this.fileSources.delete(transferId);
    this.receivingFiles.delete(transferId);
    this.incomingRequests = this.incomingRequests.filter((r) => r.transferId !== transferId);
    this.notify();
  }

  public async retryTransfer(transferId: string) {
    const source = this.fileSources.get(transferId);
    const oldItem = this.activeTransfers.get(transferId);
    if (!source) {
      console.warn('Cannot retry: original file reference not found for transfer', transferId);
      return;
    }

    // Clean up the failed transfer entry
    this.activeTransfers.delete(transferId);
    this.sendingControls.delete(transferId);
    this.fileSources.delete(transferId);
    this.notify();

    // Verify destination peer availability
    let targetPeerId = source.targetPeerId;
    if (!this.peers.has(targetPeerId)) {
      const firstPeer = Array.from(this.peers.keys())[0];
      if (firstPeer) {
        targetPeerId = firstPeer;
      } else {
        if (oldItem) {
          const failedItem: TransferItem = {
            ...oldItem,
            status: 'error',
            error: 'Recipient device is not connected. Connect a device to retry.',
            canRetry: true,
          };
          this.activeTransfers.set(transferId, failedItem);
          this.fileSources.set(transferId, source);
          this.notify();
        }
        return;
      }
    }

    // Restart transfer directly using original File instance without re-selecting
    try {
      await this.sendFile(source.file, targetPeerId);
    } catch (err: any) {
      console.error('Failed to retry transfer:', err);
    }
  }

  private handleAckMessage(transferId: string, chunkIndex: number) {
    // Used for relay backpressure if needed
  }

  // --- QUICK ENCRYPTED TEXT / CLIPBOARD SHARING ---

  public async sendQuickText(text: string, targetPeerId?: string) {
    if (!text.trim()) return;

    let peerId = targetPeerId;
    if (!peerId) {
      const firstPeer = Array.from(this.peers.keys())[0];
      if (!firstPeer) {
        throw new Error('No device connected. Connect a device first.');
      }
      peerId = firstPeer;
    }

    const salt = generateSalt();
    const key = await deriveEncryptionKey(this.roomSecret, salt);
    const encrypted = await encryptText(key, text);

    const payload = {
      type: 'quick-text',
      id: 'txt_' + Math.random().toString(36).substring(2, 9),
      saltHex: bufToHex(salt),
      ivHex: encrypted.ivHex,
      cipherBase64: encrypted.cipherBase64,
      senderName: this.localPeer.name,
      timestamp: Date.now(),
    };

    const dc = this.dataChannels.get(peerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(payload));
    } else {
      this.sendWs({
        type: 'relay-chunk',
        targetPeerId: peerId,
        payload,
      });
    }

    this.quickTexts.unshift({
      type: 'quick-text',
      id: payload.id,
      text,
      senderName: 'You (' + this.localPeer.name + ')',
      timestamp: payload.timestamp,
    });
    this.notify();
  }

  private async handleQuickText(msg: any) {
    try {
      const salt = hexToBuf(msg.saltHex);
      const key = await deriveEncryptionKey(this.roomSecret, salt);
      const decrypted = await decryptText(key, msg.cipherBase64, msg.ivHex);

      this.quickTexts.unshift({
        type: 'quick-text',
        id: msg.id,
        text: decrypted,
        senderName: msg.senderName,
        timestamp: msg.timestamp || Date.now(),
      });
      this.playChime();
      this.notify();
    } catch (err) {
      console.error('Failed to decrypt quick text', err);
    }
  }

  // Attention chime for incoming transfer requests
  private playRequestChime() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5

      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }

  // Synthesized pleasant chime using Web Audio API (no external MP3 required)
  private playChime() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }
}

// Global singleton instance
export const connectionManager = new ConnectionManager();
