import React from 'react';
import {
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileText,
  File as FileIcon,
  Check,
  X,
  ShieldCheck,
  Download,
  AlertCircle,
} from 'lucide-react';
import { IncomingTransferRequest } from '../types';
import { formatBytes } from '../utils/device';

interface IncomingTransferModalProps {
  requests: IncomingTransferRequest[];
  onAccept: (transferId: string) => void;
  onDecline: (transferId: string) => void;
}

export const IncomingTransferModal: React.FC<IncomingTransferModalProps> = ({
  requests,
  onAccept,
  onDecline,
}) => {
  if (requests.length === 0) return null;

  const getFileIcon = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return <FileImage className="w-8 h-8 text-cyan-400" />;
    }
    if (mimeType.startsWith('video/') || fileName.match(/\.(mp4|mkv|mov|avi|webm)$/i)) {
      return <FileVideo className="w-8 h-8 text-indigo-400" />;
    }
    if (mimeType.startsWith('audio/') || fileName.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
      return <FileAudio className="w-8 h-8 text-emerald-400" />;
    }
    if (fileName.match(/\.(zip|tar|gz|rar|7z)$/i)) {
      return <FileArchive className="w-8 h-8 text-amber-400" />;
    }
    return <FileText className="w-8 h-8 text-slate-300" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-100">
              Incoming File Transfer ({requests.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Action Required</span>
        </div>

        {/* Requests list (showing first or stacked) */}
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.transferId}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner"
            >
              {/* File Info */}
              <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                  {getFileIcon(req.mimeType, req.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-100 truncate" title={req.name}>
                    {req.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                    <span className="font-mono tabular-nums text-slate-300 font-medium">
                      {formatBytes(req.size)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">From {req.senderName}</span>
                  </div>
                </div>
              </div>

              {/* Security info */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 rounded-xl px-3 py-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>End-to-End Encrypted (AES-256-GCM) · Direct P2P</span>
              </div>

              {/* Accept & Decline Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => onDecline(req.transferId)}
                  className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-rose-300 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 rounded-xl transition-colors active:scale-[0.98]"
                >
                  <X className="w-4 h-4 text-rose-400" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={() => onAccept(req.transferId)}
                  className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-950/40 active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept File</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
