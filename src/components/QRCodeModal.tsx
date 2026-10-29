import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Check, Copy, Smartphone } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  fingerprint?: { emojis: string; hex: string };
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  fingerprint,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const pairUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(pairUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#020617', // slate-950
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR Code', err));
    }
  }, [isOpen, roomId, pairUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Connect Phone or PC
              </h3>
              <p className="text-[11px] text-slate-400">
                Scan with camera to connect instantly
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Connection QR Code"
                className="w-56 h-56 rounded-lg object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs font-mono">
                Generating QR...
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs text-slate-400">Room Code:</span>
            <div className="font-mono text-xl font-bold tracking-wider text-cyan-400 mt-0.5">
              {roomId}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              1
            </span>
            <span>Open your phone's Camera or browser and point at this QR code.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              2
            </span>
            <span>Tap the link to join this encrypted peer session.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
              3
            </span>
            <span>Drag or select files up to 500 MB to send directly over P2P.</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied to Clipboard' : 'Copy Direct Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
