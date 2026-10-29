import { DeviceType, PeerInfo } from '../types';

export function getDeviceInfo(): PeerInfo {
  const ua = navigator.userAgent;
  let deviceType: DeviceType = 'pc';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Device type detection
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    deviceType = 'phone';
  } else {
    deviceType = 'pc';
  }

  // OS detection
  if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser detection
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  }

  // Generate or retrieve persistent local Peer ID & Custom Name
  let peerId = sessionStorage.getItem('aetherdrop_peer_id');
  if (!peerId) {
    peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('aetherdrop_peer_id', peerId);
  }

  let savedName = localStorage.getItem('aetherdrop_device_name');
  if (!savedName) {
    if (deviceType === 'phone') {
      savedName = `${os} Phone (${browser})`;
    } else if (deviceType === 'tablet') {
      savedName = `${os} Tablet`;
    } else {
      savedName = `${os} PC (${browser})`;
    }
  }

  return {
    id: peerId,
    name: savedName,
    deviceType,
    os,
    browser,
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

export function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 B/s';
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}
