/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mqtt, { MqttClient } from 'mqtt';
import { PeerInfo } from '../types';

export type SignalingMode = 'auto' | 'cloud' | 'custom' | 'native';
export type ActiveTransportType = 'none' | 'native-ws' | 'cloud-broker' | 'custom-ws';

export interface SignalingStatus {
  isConnected: boolean;
  mode: SignalingMode;
  activeTransport: ActiveTransportType;
  serverUrl: string;
  reconnectAttempts: number;
  lastError: string | null;
}

export type MessageHandler = (msg: any) => void;
export type StatusListener = (status: SignalingStatus) => void;

// Public reliable MQTT over WebSocket brokers for zero-server WebRTC signaling
const PRIMARY_CLOUD_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const FALLBACK_CLOUD_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const TERTIARY_CLOUD_BROKER = 'wss://test.mosquitto.org:8081/mqtt';

export class SignalingService {
  private mode: SignalingMode = 'cloud';
  private customUrl: string = '';
  private activeTransport: ActiveTransportType = 'cloud-broker';
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private lastError: string | null = null;

  // Native / Custom WebSocket state
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;

  // Cloud Broker (MQTT over WS) state
  private mqttClient: MqttClient | null = null;
  private currentBrokerIndex: number = 0;
  private cloudBrokers = [PRIMARY_CLOUD_BROKER, FALLBACK_CLOUD_BROKER, TERTIARY_CLOUD_BROKER];
  private heartbeatTimer: any = null;
  private peerHeartbeats: Map<string, number> = new Map();

  // Current session context
  private currentRoomId: string = '';
  private localPeer: PeerInfo | null = null;

  // Handlers & Listeners
  private onMessageCallback: MessageHandler | null = null;
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {
    this.loadSettings();

    // Auto-resume connection when personal devices (phones/laptops) wake up or reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.isConnected) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected) {
          this.connect();
        }
      });
    }
  }

  private loadSettings() {
    try {
      const savedMode = localStorage.getItem('aetherdrop_signaling_mode') as SignalingMode;
      // Default to 'cloud' for serverless personal use across all devices
      if (savedMode === 'custom' && localStorage.getItem('aetherdrop_signaling_url')) {
        this.mode = 'custom';
      } else {
        this.mode = 'cloud';
        localStorage.setItem('aetherdrop_signaling_mode', 'cloud');
      }

      const savedUrl = localStorage.getItem('aetherdrop_signaling_url');
      if (savedUrl) {
        this.customUrl = savedUrl;
      }
    } catch {
      this.mode = 'cloud';
      this.customUrl = '';
    }
  }

  public getStatus(): SignalingStatus {
    let serverUrl = '';
    if (this.activeTransport === 'cloud-broker') {
      serverUrl = this.cloudBrokers[this.currentBrokerIndex] || PRIMARY_CLOUD_BROKER;
    } else if (this.activeTransport === 'custom-ws') {
      serverUrl = this.customUrl;
    } else if (this.activeTransport === 'native-ws') {
      serverUrl = this.getNativeWsUrl();
    }

    return {
      isConnected: this.isConnected,
      mode: this.mode,
      activeTransport: this.activeTransport,
      serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => fn(status));
  }

  public setMessageHandler(handler: MessageHandler) {
    this.onMessageCallback = handler;
  }

  public setMode(newMode: SignalingMode, customUrl?: string) {
    this.mode = newMode;
    localStorage.setItem('aetherdrop_signaling_mode', newMode);

    if (customUrl !== undefined) {
      this.customUrl = customUrl.trim();
      localStorage.setItem('aetherdrop_signaling_url', this.customUrl);
    }

    this.reconnectAttempts = 0;
    this.lastError = null;
    this.disconnect();
    this.connect();
  }

  public setCustomUrl(url: string) {
    this.customUrl = url.trim();
    localStorage.setItem('aetherdrop_signaling_url', this.customUrl);
    if (this.mode === 'custom') {
      this.reconnectAttempts = 0;
      this.disconnect();
      this.connect();
    }
  }

  public updateContext(localPeer: PeerInfo, roomId: string) {
    const roomChanged = this.currentRoomId !== roomId;
    this.localPeer = localPeer;
    this.currentRoomId = roomId;

    if (roomChanged && this.isConnected) {
      if (this.activeTransport === 'cloud-broker') {
        this.setupMqttRoomSubscriptions();
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN && roomId) {
        this.sendNativeWs({
          type: 'join-room',
          roomId,
          peerInfo: localPeer,
        });
      }
    }
  }

  public connect() {
    this.clearTimers();

    // Determine target transport
    const target = this.resolveTransport();
    this.activeTransport = target;

    if (target === 'cloud-broker') {
      this.connectCloudBroker();
    } else {
      this.connectWebSocket(target === 'custom-ws');
    }
  }

  public disconnect() {
    this.clearTimers();

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.mqttClient) {
      try {
        if (this.currentRoomId && this.localPeer) {
          // Announce peer leaving
          this.publishMqttBroadcast({
            type: 'peer-left',
            peerId: this.localPeer.id,
          });
        }
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }

    this.isConnected = false;
    this.notifyStatus();
  }

  private clearTimers() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private isStaticOrVercelHost(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return (
      host.endsWith('.vercel.app') ||
      host.endsWith('.github.io') ||
      host.endsWith('.netlify.app') ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.surge.sh')
    );
  }

  private getNativeWsUrl(): string {
    const envUrl = (import.meta as any).env?.VITE_SIGNALING_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  private resolveTransport(): 'cloud-broker' | 'native-ws' | 'custom-ws' {
    if (this.mode === 'custom' && this.customUrl) {
      return 'custom-ws';
    }
    if (this.mode === 'native') {
      return 'native-ws';
    }
    // Default for personal use on Vercel and across all personal devices: Global Cloud Broker
    return 'cloud-broker';
  }

  // --- NATIVE / CUSTOM WEBSOCKET IMPLEMENTATION ---

  private connectWebSocket(isCustom: boolean) {
    const wsUrl = isCustom ? this.customUrl : this.getNativeWsUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.activeTransport = isCustom ? 'custom-ws' : 'native-ws';
        this.reconnectAttempts = 0;
        this.lastError = null;

        if (this.currentRoomId && this.localPeer) {
          this.sendNativeWs({
            type: 'join-room',
            roomId: this.currentRoomId,
            peerInfo: this.localPeer,
          });
        }
        this.notifyStatus();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.onMessageCallback?.(msg);
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.activeTransport = 'none';
        this.notifyStatus();

        this.reconnectAttempts++;

        // In Auto mode: if Native WebSocket fails after 2 attempts, seamlessly switch to Cloud Broker!
        if (this.mode === 'auto' && this.reconnectAttempts >= 2) {
          console.warn('Native WebSocket failed to connect. Falling back to Global Cloud Broker...');
          this.connectCloudBroker();
          return;
        }

        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
        this.wsReconnectTimer = setTimeout(() => {
          this.connect();
        }, delay);
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        this.lastError = 'Unable to establish WebSocket connection';
      };
    } catch (err: any) {
      console.warn('Error initiating WebSocket:', err);
      this.lastError = err?.message || 'WebSocket initialization failed';
      if (this.mode === 'auto') {
        this.connectCloudBroker();
      }
    }
  }

  private sendNativeWs(msg: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // --- CLOUD BROKER (MQTT OVER WEBSOCKET) IMPLEMENTATION ---

  private connectCloudBroker() {
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }

    const brokerUrl = this.cloudBrokers[this.currentBrokerIndex] || PRIMARY_CLOUD_BROKER;
    const clientId = 'aether_' + (this.localPeer?.id || Math.random().toString(36).substring(2, 9));

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        keepalive: 20,
        reconnectPeriod: 3000,
        connectTimeout: 8000,
        clean: true,
      });

      this.mqttClient.on('connect', () => {
        this.isConnected = true;
        this.activeTransport = 'cloud-broker';
        this.reconnectAttempts = 0;
        this.lastError = null;

        if (this.currentRoomId && this.localPeer) {
          this.setupMqttRoomSubscriptions();
        }

        this.startMqttHeartbeat();
        this.notifyStatus();
      });

      this.mqttClient.on('message', (topic, payload) => {
        try {
          const raw = payload.toString();
          const msg = JSON.parse(raw);
          this.handleMqttMessage(topic, msg);
        } catch (e) {
          console.warn('Failed to parse MQTT message', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('MQTT Cloud broker error:', err);
        this.lastError = 'Retrying with backup cloud broker...';
        this.currentBrokerIndex = (this.currentBrokerIndex + 1) % this.cloudBrokers.length;
        if (!this.isConnected) {
          setTimeout(() => {
            if (!this.isConnected && this.mode === 'cloud') {
              this.connectCloudBroker();
            }
          }, 1500);
        }
      });

      this.mqttClient.on('close', () => {
        this.isConnected = false;
        this.notifyStatus();
      });
    } catch (err: any) {
      console.error('Failed to initialize MQTT Cloud broker:', err);
      this.lastError = err?.message || 'Failed to initialize cloud broker';
      this.notifyStatus();
    }
  }

  private getMqttTopics(roomId: string) {
    // Prefix room ID to create clean, isolated broadcast and direct channels
    const cleanRoom = roomId.trim().toUpperCase();
    return {
      broadcast: `aetherdrop/v1/${cleanRoom}/broadcast`,
      direct: `aetherdrop/v1/${cleanRoom}/peer/${this.localPeer?.id || 'unknown'}`,
      targetDirect: (targetPeerId: string) => `aetherdrop/v1/${cleanRoom}/peer/${targetPeerId}`,
    };
  }

  private setupMqttRoomSubscriptions() {
    if (!this.mqttClient || !this.isConnected || !this.currentRoomId || !this.localPeer) {
      return;
    }

    const topics = this.getMqttTopics(this.currentRoomId);

    this.mqttClient.subscribe([topics.broadcast, topics.direct], { qos: 0 }, (err) => {
      if (err) {
        console.warn('Failed to subscribe to room topics:', err);
        return;
      }

      // Broadcast room join announcement
      this.publishMqttBroadcast({
        type: 'announce',
        peer: this.localPeer,
        timestamp: Date.now(),
      });
    });
  }

  private publishMqttBroadcast(msg: Record<string, any>) {
    if (!this.mqttClient || !this.currentRoomId) return;
    const topics = this.getMqttTopics(this.currentRoomId);
    this.mqttClient.publish(topics.broadcast, JSON.stringify(msg), { qos: 0 });
  }

  private publishMqttDirect(targetPeerId: string, msg: Record<string, any>) {
    if (!this.mqttClient || !this.currentRoomId) return;
    const topics = this.getMqttTopics(this.currentRoomId);
    this.mqttClient.publish(topics.targetDirect(targetPeerId), JSON.stringify(msg), { qos: 0 });
  }

  private handleMqttMessage(topic: string, msg: any) {
    if (!this.currentRoomId || !this.localPeer) return;

    // Direct message targeted specifically to this local peer
    if (msg.targetPeerId && msg.targetPeerId !== this.localPeer.id) {
      return;
    }

    switch (msg.type) {
      case 'announce': {
        const remotePeer: PeerInfo = msg.peer;
        if (remotePeer && remotePeer.id !== this.localPeer.id) {
          this.peerHeartbeats.set(remotePeer.id, Date.now());

          // Tell the newcomer that we are already here in the room!
          this.publishMqttDirect(remotePeer.id, {
            type: 'welcome',
            peer: this.localPeer,
            timestamp: Date.now(),
          });

          // Dispatch peer-joined to local connectionManager
          this.onMessageCallback?.({
            type: 'peer-joined',
            peer: remotePeer,
          });
        }
        break;
      }

      case 'welcome': {
        const remotePeer: PeerInfo = msg.peer;
        if (remotePeer && remotePeer.id !== this.localPeer.id) {
          this.peerHeartbeats.set(remotePeer.id, Date.now());

          // Dispatch peer-joined to local connectionManager
          this.onMessageCallback?.({
            type: 'peer-joined',
            peer: remotePeer,
          });
        }
        break;
      }

      case 'heartbeat': {
        if (msg.peerId && msg.peerId !== this.localPeer.id) {
          this.peerHeartbeats.set(msg.peerId, Date.now());
        }
        break;
      }

      case 'peer-left': {
        const peerId = msg.peerId;
        if (peerId && peerId !== this.localPeer.id) {
          this.peerHeartbeats.delete(peerId);
          this.onMessageCallback?.({
            type: 'peer-left',
            peerId,
          });
        }
        break;
      }

      // Forward WebRTC signaling & relay fallback packets
      case 'signal':
      case 'relay-meta':
      case 'relay-response':
      case 'relay-chunk':
      case 'relay-ack': {
        this.onMessageCallback?.(msg);
        break;
      }

      default: {
        this.onMessageCallback?.(msg);
        break;
      }
    }
  }

  private startMqttHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected || !this.mqttClient || !this.currentRoomId || !this.localPeer) {
        return;
      }

      // 1. Send heartbeat
      this.publishMqttBroadcast({
        type: 'heartbeat',
        peerId: this.localPeer.id,
        timestamp: Date.now(),
      });

      // 2. Check for timed out peers (no heartbeat in 25s)
      const now = Date.now();
      for (const [peerId, lastSeen] of this.peerHeartbeats.entries()) {
        if (now - lastSeen > 25000) {
          this.peerHeartbeats.delete(peerId);
          this.onMessageCallback?.({
            type: 'peer-left',
            peerId,
          });
        }
      }
    }, 8000);
  }

  // --- UNIFIED MESSAGE SEND METHOD ---

  public sendMessage(msg: Record<string, any>) {
    if (this.activeTransport === 'cloud-broker') {
      if (msg.type === 'join-room') {
        this.setupMqttRoomSubscriptions();
      } else if (msg.type === 'ping') {
        // no-op for MQTT
      } else if (msg.targetPeerId) {
        // Route directly to target peer's MQTT topic
        this.publishMqttDirect(msg.targetPeerId, {
          ...msg,
          senderPeerId: this.localPeer?.id,
        });
      } else {
        // Broadcast
        this.publishMqttBroadcast(msg);
      }
    } else {
      // Native or Custom WebSocket
      this.sendNativeWs(msg);
    }
  }
}

export const signalingService = new SignalingService();
