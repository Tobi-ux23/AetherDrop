import { DeviceType, PeerInfo } from '../types';

// Detect WebGL GPU unmasked renderer to help distinguish Laptop GPUs from Desktop GPUs
function getGpuRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    return (gl as any).getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
  } catch {
    return '';
  }
}

// Detect specific iPhone & iPad models based on viewport points and pixel density
function detectIosModel(deviceType: DeviceType): string {
  if (typeof window === 'undefined') return deviceType === 'tablet' ? 'iPad' : 'iPhone';

  const w = Math.min(window.screen.width, window.screen.height);
  const h = Math.max(window.screen.width, window.screen.height);
  const dpr = window.devicePixelRatio || 1;

  if (deviceType === 'tablet') {
    if (w === 1024 && h === 1366) return 'iPad Pro 12.9"';
    if (w === 834 && h === 1194) return 'iPad Pro 11"';
    if (w === 834 && h === 1112) return 'iPad Pro 10.5"';
    if (w === 820 && h === 1180) return 'iPad Air (10.9")';
    if (w === 810 && h === 1080) return 'iPad (10th/9th Gen)';
    if (w === 744 && h === 1133) return 'iPad mini (6th Gen)';
    return 'iPad';
  }

  // iPhones
  if (w === 440 && h === 956) return 'iPhone 17 Pro Max / 16 Pro Max';
  if (w === 402 && h === 874) return 'iPhone 17 Pro / 16 Pro';
  if (w === 430 && h === 932) return 'iPhone 16 Plus / 15 Pro Max';
  if (w === 393 && h === 852) return 'iPhone 16 / 15 Pro / 15';
  if (w === 428 && h === 926) return 'iPhone 14 Plus / 13 Pro Max';
  if (w === 390 && h === 844) return 'iPhone 14 / 13 / 13 Pro';
  if (w === 375 && h === 812) return 'iPhone 13 mini / 12 mini';
  if (w === 414 && h === 896) {
    return dpr >= 3 ? 'iPhone 11 Pro Max / XS Max' : 'iPhone 11 / XR';
  }
  if (w === 414 && h === 736) return 'iPhone 8 Plus';
  if (w === 375 && h === 667) return 'iPhone SE (3rd Gen)';

  return 'iPhone';
}

// Map common Android model codes to friendly marketing names
const ANDROID_MODEL_MAP: Record<string, string> = {
  // Samsung Galaxy S series
  'SM-S928': 'Samsung Galaxy S24 Ultra',
  'SM-S926': 'Samsung Galaxy S24+',
  'SM-S921': 'Samsung Galaxy S24',
  'SM-S918': 'Samsung Galaxy S23 Ultra',
  'SM-S916': 'Samsung Galaxy S23+',
  'SM-S911': 'Samsung Galaxy S23',
  'SM-S908': 'Samsung Galaxy S22 Ultra',
  'SM-S906': 'Samsung Galaxy S22+',
  'SM-S901': 'Samsung Galaxy S22',
  'SM-G998': 'Samsung Galaxy S21 Ultra',
  'SM-G996': 'Samsung Galaxy S21+',
  'SM-G991': 'Samsung Galaxy S21',
  'SM-F946': 'Samsung Galaxy Z Fold5',
  'SM-F936': 'Samsung Galaxy Z Fold4',
  'SM-F731': 'Samsung Galaxy Z Flip5',
  'SM-F721': 'Samsung Galaxy Z Flip4',
  'SM-A556': 'Samsung Galaxy A55 5G',
  'SM-A546': 'Samsung Galaxy A54 5G',
  'SM-A346': 'Samsung Galaxy A34 5G',

  // Google Pixel
  'Pixel 9 Pro Fold': 'Google Pixel 9 Pro Fold',
  'Pixel 9 Pro XL': 'Google Pixel 9 Pro XL',
  'Pixel 9 Pro': 'Google Pixel 9 Pro',
  'Pixel 9': 'Google Pixel 9',
  'Pixel 8 Pro': 'Google Pixel 8 Pro',
  'Pixel 8': 'Google Pixel 8',
  'Pixel 8a': 'Google Pixel 8a',
  'Pixel 7 Pro': 'Google Pixel 7 Pro',
  'Pixel 7': 'Google Pixel 7',
  'Pixel 7a': 'Google Pixel 7a',
  'Pixel 6 Pro': 'Google Pixel 6 Pro',
  'Pixel 6': 'Google Pixel 6',

  // OnePlus & Xiaomi
  'CPH2581': 'OnePlus 12',
  'CPH2449': 'OnePlus 11',
  'OnePlus 12': 'OnePlus 12',
  'OnePlus 11': 'OnePlus 11',
  '23127PN0CG': 'Xiaomi 14',
  '23116PN5BC': 'Xiaomi 14 Pro',
};

function formatAndroidModel(rawModel: string): string {
  const clean = rawModel.trim();
  for (const [key, name] of Object.entries(ANDROID_MODEL_MAP)) {
    if (clean.includes(key) || clean.startsWith(key)) {
      return name;
    }
  }

  if (/^SM-[A-Z0-9]+/i.test(clean)) {
    return `Samsung Galaxy (${clean})`;
  }
  if (/Pixel/i.test(clean)) {
    return clean.startsWith('Google') ? clean : `Google ${clean}`;
  }
  if (/OnePlus/i.test(clean)) {
    return clean;
  }
  if (/Xiaomi|Redmi|POCO/i.test(clean)) {
    return clean;
  }

  return clean || 'Android Phone';
}

function detectAndroidModel(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;

  // Extract from User-Agent string: e.g. Android 14; SM-S928B Build/...
  const match = ua.match(/Android [^;]+; (?:[a-zA-Z]{2,3}-[a-zA-Z]{2,3}; )?([^;)]+) Build/i);
  if (match && match[1]) {
    return formatAndroidModel(match[1]);
  }

  return null;
}

// Detect PC Model (Laptop vs Desktop)
function detectPcModel(os: string): string {
  if (typeof window === 'undefined') return `${os} PC`;

  const gpu = getGpuRenderer().toLowerCase();
  const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const w = window.screen.width;
  const h = window.screen.height;

  // Check laptop GPU signatures
  const isLaptopGpu =
    gpu.includes('laptop') ||
    gpu.includes('mobile') ||
    gpu.includes('max-q') ||
    gpu.includes('iris') ||
    gpu.includes('radeon 780m') ||
    gpu.includes('radeon 680m') ||
    gpu.includes('uhd graphics');

  const isDesktopGpu =
    (gpu.includes('rtx 40') || gpu.includes('rtx 30') || gpu.includes('radeon rx')) &&
    !gpu.includes('laptop') &&
    !gpu.includes('mobile');

  if (os === 'macOS') {
    // Apple Silicon / Intel MacBooks typically have 16:10 or 14:9 aspect ratios
    const ratio = Math.max(w, h) / Math.min(w, h);
    const isMacBookRatio = ratio >= 1.5 && ratio <= 1.65;
    if (isMacBookRatio || w <= 1728) {
      return 'MacBook Pro';
    }
    return 'iMac / Mac';
  }

  if (os === 'Windows') {
    if (isTouch || isLaptopGpu || (!isDesktopGpu && w <= 1920 && h <= 1200)) {
      return 'Windows Laptop';
    }
    return 'Windows Desktop';
  }

  if (os === 'Linux') {
    if (isLaptopGpu || isTouch) return 'Linux Laptop';
    return 'Linux PC';
  }

  return `${os} PC`;
}

// Check if a saved device name is an old generic auto-generated fallback that should be upgraded
export function isLegacyGenericName(name: string): boolean {
  if (!name) return true;
  return (
    /^(Windows|macOS|iOS|Android|Linux) (PC|Phone|Tablet)/i.test(name) ||
    /\((Chrome|Safari|Firefox|Edge|Opera)\)$/i.test(name) ||
    name === 'Windows PC' ||
    name === 'Unknown Device'
  );
}

export function detectSmartDeviceModel(deviceType: DeviceType, os: string): string {
  if (os === 'iOS') {
    return detectIosModel(deviceType);
  }
  if (os === 'Android') {
    const model = detectAndroidModel();
    if (model) return model;
    return deviceType === 'tablet' ? 'Android Tablet' : 'Android Phone';
  }
  return detectPcModel(os);
}

export function getDeviceInfo(): PeerInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
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

  // Detect specific hardware model (e.g. iPhone 17 Pro, Windows Laptop, etc.)
  const detectedModel = detectSmartDeviceModel(deviceType, os);

  // Generate or retrieve persistent local Peer ID
  let peerId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aetherdrop_peer_id') : null;
  if (!peerId) {
    peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    try {
      sessionStorage.setItem('aetherdrop_peer_id', peerId);
    } catch {}
  }

  // Check saved device name
  let savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('aetherdrop_device_name') : null;
  const isCustom = typeof localStorage !== 'undefined' ? localStorage.getItem('aetherdrop_device_name_is_custom') === 'true' : false;

  // If there is no saved name or it's an old generic name like "Windows PC (Chrome)", upgrade to the detected model!
  if (!savedName || (!isCustom && isLegacyGenericName(savedName))) {
    savedName = detectedModel;
    try {
      localStorage.setItem('aetherdrop_device_name', savedName);
    } catch {}
  }

  return {
    id: peerId,
    name: savedName,
    deviceType,
    os,
    browser,
    model: detectedModel,
  };
}

// Asynchronously enhance device model using modern Client Hints & Battery API
export async function enhanceDeviceInfoAsync(onUpdate: (updatedPeer: PeerInfo) => void) {
  if (typeof navigator === 'undefined') return;

  const currentInfo = getDeviceInfo();
  const isCustom = typeof localStorage !== 'undefined' ? localStorage.getItem('aetherdrop_device_name_is_custom') === 'true' : false;

  let refinedModel = currentInfo.model || detectSmartDeviceModel(currentInfo.deviceType, currentInfo.os);

  try {
    // 1. Try High Entropy Client Hints (Chrome / Edge / Android)
    const uaData = (navigator as any).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
      const hints = await uaData.getHighEntropyValues(['model', 'platform', 'platformVersion', 'formFactor']);
      if (hints.model && hints.model.trim()) {
        refinedModel = formatAndroidModel(hints.model);
      } else if (hints.formFactor && Array.isArray(hints.formFactor)) {
        if (hints.formFactor.includes('laptop')) {
          refinedModel = `${currentInfo.os} Laptop`;
        } else if (hints.formFactor.includes('desktop')) {
          refinedModel = `${currentInfo.os} Desktop`;
        }
      }
    }

    // 2. Try Battery API to verify Laptop status
    if (currentInfo.deviceType === 'pc' && 'getBattery' in navigator) {
      const battery = await (navigator as any).getBattery?.();
      if (battery && typeof battery.charging === 'boolean') {
        // Device has a battery -> it is a laptop!
        if (currentInfo.os === 'Windows' && !refinedModel.includes('Laptop')) {
          refinedModel = 'Windows Laptop';
        } else if (currentInfo.os === 'macOS' && !refinedModel.includes('MacBook')) {
          refinedModel = 'MacBook Pro';
        }
      }
    }
  } catch {
    // Fall back to current model
  }

  const updatedPeer: PeerInfo = {
    ...currentInfo,
    model: refinedModel,
    name: isCustom ? currentInfo.name : refinedModel,
  };

  if (!isCustom && currentInfo.name !== refinedModel) {
    try {
      localStorage.setItem('aetherdrop_device_name', refinedModel);
    } catch {}
    onUpdate(updatedPeer);
  }
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
