import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  Check,
  Copy,
  Edit2,
  Wifi,
  QrCode,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { PeerInfo } from '../types';

interface ConnectedDevicesProps {
  localPeer: PeerInfo;
  peers: PeerInfo[];
  peerTransports: Map<string, 'webrtc' | 'relay'>;
  roomId: string;
  fingerprint?: { emojis: string; hex: string };
  onUpdateDeviceName: (name: string) => void;
  onOpenQR: () => void;
  onOpenRoomModal: () => void;
  onLeaveRoom: () => void;
  onSelectPeerForSend: (peerId: string) => void;
}

export const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({
  localPeer,
  peers,
  peerTransports,
  roomId,
  fingerprint,
  onUpdateDeviceName,
  onOpenQR,
  onOpenRoomModal,
  onLeaveRoom,
  onSelectPeerForSend,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(localPeer.name);
  const [copiedLink, setCopiedLink] = useState(false);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-indigo-400" />;
      default:
        return <Laptop className="w-5 h-5 text-emerald-400" />;
    }
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onUpdateDeviceName(nameInput.trim());
      setIsEditingName(false);
    }
  };

  const handleCopyLink = () => {
    const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      {/* Room and Security Status Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Current Room Code:</span>
              <span className="font-mono text-sm font-bold text-cyan-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                {roomId}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Devices with this room code and secret can transfer files directly.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Room Link'}</span>
            </button>

            <button
              onClick={onOpenQR}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950 hover:bg-cyan-900/80 border border-cyan-800/80 rounded-lg transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR</span>
            </button>

            <button
              onClick={onOpenRoomModal}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Switch Room
            </button>

            <button
              onClick={onLeaveRoom}
              className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Local Device */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            This Device (You)
          </span>
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            Online
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
              {getDeviceIcon(localPeer.deviceType)}
            </div>

            <div className="min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="text-xs px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-100 truncate">
                    {localPeer.name}
                  </h4>
                  <button
                    onClick={() => {
                      setNameInput(localPeer.name);
                      setIsEditingName(true);
                    }}
                    className="text-slate-500 hover:text-slate-300 p-1"
                    title="Edit device name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{localPeer.os}</span>
                <span aria-hidden="true">·</span>
                <span>{localPeer.browser}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-slate-500">{localPeer.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remote Devices */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Connected Devices ({peers.length})
          </span>
          <span className="text-xs text-slate-400">
            {peers.length === 0 ? 'Waiting for device' : 'Ready to transfer'}
          </span>
        </div>

        {peers.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">
                No other devices connected yet
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Scan the QR code with your phone camera, or open this page on another PC in the same room.
              </p>
            </div>
            <button
              onClick={onOpenQR}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Code to Connect</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {peers.map((peer) => {
              const transport = peerTransports.get(peer.id) || 'webrtc';
              return (
                <div
                  key={peer.id}
                  className="flex items-center justify-between gap-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      {getDeviceIcon(peer.deviceType)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-100 truncate">
                        {peer.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{peer.os}</span>
                        <span aria-hidden="true">·</span>
                        <span>{peer.browser}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 text-[11px] font-medium">
                          {transport === 'webrtc' ? 'Direct P2P DataChannel' : 'Encrypted Relay'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectPeerForSend(peer.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Send File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
