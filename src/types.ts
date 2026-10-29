export type DeviceType = 'phone' | 'pc' | 'tablet';

export interface PeerInfo {
  id: string;
  name: string;
  deviceType: DeviceType;
  os: string;
  browser: string;
}

export type TransferStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'encrypting'
  | 'transferring'
  | 'decrypting'
  | 'completed'
  | 'paused'
  | 'declined'
  | 'error'
  | 'cancelled';

export interface TransferItem {
  id: string;
  name: string;
  size: number;
  type: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  status: TransferStatus;
  progress: number; // 0 - 100
  transferredBytes: number;
  speedBps: number;
  etaSeconds: number;
  startedAt: number;
  endedAt?: number;
  blobUrl?: string;
  error?: string;
  transportType: 'webrtc' | 'relay';
  encryption: 'AES-256-GCM';
  chunksCompleted: number;
  totalChunks: number;
  canRetry?: boolean;
}

export interface IncomingTransferRequest {
  transferId: string;
  senderPeerId: string;
  senderName: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  saltHex: string;
  fingerprintHex?: string;
  transportType: 'webrtc' | 'relay';
  requestedAt: number;
}

export interface TransferHistoryEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  direction: 'send' | 'receive';
  peerName: string;
  status: 'completed' | 'cancelled' | 'declined' | 'error';
  startedAt: number;
  endedAt: number;
  durationMs: number;
  avgSpeedBps: number;
  transportType: 'webrtc' | 'relay';
  encryption: 'AES-256-GCM';
  blobUrl?: string; // transient in memory if available
}

export interface FileRequestMessage {
  type: 'file-request';
  transferId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  saltHex: string;
  senderName: string;
  fingerprintHex?: string;
}

export interface FileResponseMessage {
  type: 'file-response';
  transferId: string;
  accepted: boolean;
  receiverName: string;
  reason?: string;
}

export interface FileMetadataMessage {
  type: 'file-metadata';
  transferId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  saltHex: string;
  senderName: string;
  fingerprintHex?: string;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  ivHex: string;
  encryptedBase64: string;
}

export interface FileAckMessage {
  type: 'file-ack';
  transferId: string;
  chunkIndex: number;
}

export interface QuickTextMessage {
  type: 'quick-text';
  id: string;
  text: string;
  senderName: string;
  timestamp: number;
}
