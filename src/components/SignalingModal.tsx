/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Wifi,
  Cloud,
  Server,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  signalingService,
  SignalingStatus,
  SignalingMode,
} from '../services/signalingService';

interface SignalingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignalingModal: React.FC<SignalingModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<SignalingStatus>(signalingService.getStatus());
  const [selectedMode, setSelectedMode] = useState<SignalingMode>(status.mode);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = signalingService.subscribeStatus((newStatus) => {
      setStatus(newStatus);
      setSelectedMode(newStatus.mode);
      if (newStatus.serverUrl && newStatus.mode === 'custom') {
        setCustomUrlInput(newStatus.serverUrl);
      }
    });

    const savedUrl = localStorage.getItem('aetherdrop_signaling_url') || '';
    setCustomUrlInput(savedUrl);

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = (mode: SignalingMode, customUrl?: string) => {
    setIsSaving(true);
    signalingService.setMode(mode, customUrl);
    setTimeout(() => {
      setIsSaving(false);
    }, 400);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    handleApply('custom', customUrlInput.trim());
  };

  const getTransportBadge = () => {
    switch (status.activeTransport) {
      case 'cloud-broker':
        return {
          label: 'Global Cloud Broker (Vercel-Ready)',
          color: 'text-cyan-300 bg-cyan-950/70 border-cyan-800/80',
          icon: Cloud,
        };
      case 'native-ws':
        return {
          label: 'Native WebSocket Server (/ws)',
          color: 'text-indigo-300 bg-indigo-950/70 border-indigo-800/80',
          icon: Server,
        };
      case 'custom-ws':
        return {
          label: 'Custom WebSocket Server',
          color: 'text-emerald-300 bg-emerald-950/70 border-emerald-800/80',
          icon: Server,
        };
      default:
        return {
          label: 'Connecting / Offline',
          color: 'text-amber-300 bg-amber-950/70 border-amber-800/80',
          icon: AlertCircle,
        };
    }
  };

  const badge = getTransportBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Signaling Network Settings</h2>
              <p className="text-xs text-slate-400">WebRTC peer discovery & relay infrastructure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Card */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {status.isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    status.isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                />
              </span>
              <span className="text-sm font-semibold text-white">
                {status.isConnected ? 'Connected & Ready' : 'Connecting to signaling network...'}
              </span>
            </div>

            <button
              onClick={() => signalingService.connect()}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors py-1 px-2 rounded hover:bg-slate-900"
              title="Refresh connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Reconnect</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${badge.color}`}>
              <BadgeIcon className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
            </span>
            {status.serverUrl && (
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-xs" title={status.serverUrl}>
                {status.serverUrl}
              </span>
            )}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Signaling Mode
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Option 1: Cloud Broker (Default for personal use) */}
            <button
              type="button"
              onClick={() => handleApply('cloud')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                selectedMode === 'cloud'
                  ? 'bg-cyan-950/40 border-cyan-500/80 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center shrink-0">
                {selectedMode === 'cloud' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">Global Cloud Broker (Personal Use Default)</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Permanent serverless signaling over secure global cloud brokers (EMQX & HiveMQ). Zero server setup needed. Works 100% on Vercel, Netlify, mobile phones, and laptops across different networks.
                </p>
              </div>
            </button>

            {/* Option 3: Local WebSocket */}
            <button
              type="button"
              onClick={() => handleApply('native')}
              className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                selectedMode === 'native'
                  ? 'bg-cyan-950/40 border-cyan-500/80 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center shrink-0">
                {selectedMode === 'native' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-slate-100">Local WebSocket Server (/ws)</span>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Connects to the bundled Node.js server running on your current domain. Requires a continuous server environment (like Cloud Run or Docker).
                </p>
              </div>
            </button>

            {/* Option 4: Custom URL */}
            <div
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                selectedMode === 'custom'
                  ? 'bg-cyan-950/40 border-cyan-500/80 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setSelectedMode('custom')}
              >
                <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center shrink-0">
                  {selectedMode === 'custom' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-100">Custom WebSocket URL</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect to a self-hosted signaling server on Render, Railway, or Fly.io
                  </p>
                </div>
              </div>

              {selectedMode === 'custom' && (
                <form onSubmit={handleCustomSubmit} className="flex gap-2 pt-1 pl-7">
                  <input
                    type="text"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="wss://my-signaling-server.com/ws"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Save & Connect
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Vercel Info Box */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Why did Vercel show "Reconnecting"?</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Vercel is a serverless platform that serves static frontends and does not run continuous Node.js WebSocket daemons. With our new <strong>Global Cloud Broker</strong> (built right in), AetherDrop now works seamlessly on Vercel out-of-the-box with zero configuration and zero servers to manage!
          </p>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
