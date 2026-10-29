import React from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Clock,
  RotateCw,
} from 'lucide-react';
import { TransferItem } from '../types';
import { formatBytes, formatEta, formatSpeed } from '../utils/device';

interface ActiveTransfersProps {
  transfers: TransferItem[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDownload: (url: string, name: string) => void;
  onRetry?: (id: string) => void;
}

export const ActiveTransfers: React.FC<ActiveTransfersProps> = ({
  transfers,
  onPause,
  onResume,
  onCancel,
  onDownload,
  onRetry,
}) => {
  if (transfers.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold text-slate-300">
          Active Transfers ({transfers.length})
        </span>
        <span className="text-[11px]">E2EE AES-256-GCM active</span>
      </div>

      <div className="space-y-3">
        {transfers.map((item) => {
          const isSend = item.direction === 'send';
          const isDone = item.status === 'completed';
          const isError = item.status === 'error';
          const isPaused = item.status === 'paused';
          const isAwaiting = item.status === 'awaiting_approval';
          const isDeclined = item.status === 'declined';
          const isFailed = isError || isDeclined;
          const canRetry = Boolean(item.canRetry ?? (isSend && isFailed));

          return (
            <div
              key={item.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg shadow-black/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : isFailed
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                        : isAwaiting
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                        : isSend
                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60'
                        : 'bg-indigo-950 text-indigo-400 border border-indigo-800/60'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : isAwaiting ? (
                      <Clock className="w-5 h-5 animate-pulse" />
                    ) : isSend ? (
                      <ArrowUpCircle className="w-5 h-5" />
                    ) : (
                      <ArrowDownCircle className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-100 truncate">
                      {item.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{isSend ? `To: ${item.peerName}` : `From: ${item.peerName}`}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(item.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <Lock className="w-3 h-3" />
                        AES-256
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status indicator & controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {canRetry && onRetry && (
                    <button
                      onClick={() => onRetry(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-200 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 rounded-lg transition-all shadow-sm shadow-cyan-950/40 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      title="Restart transfer without re-selecting file"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Retry</span>
                    </button>
                  )}

                  {isSend && !isDone && !isFailed && !isAwaiting && (
                    <button
                      onClick={() => (isPaused ? onResume(item.id) : onPause(item.id))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title={isPaused ? 'Resume transfer' : 'Pause transfer'}
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  )}

                  {!isDone && (
                    <button
                      onClick={() => onCancel(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors"
                      title={isAwaiting ? 'Cancel request' : isFailed ? 'Dismiss transfer' : 'Cancel transfer'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {isDone && item.blobUrl && (
                    <button
                      onClick={() => onDownload(item.blobUrl!, item.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-400'
                        : isDeclined || isError
                        ? 'bg-rose-500'
                        : isPaused
                        ? 'bg-amber-400'
                        : isAwaiting
                        ? 'bg-amber-400/80 animate-pulse'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                    }`}
                    style={{
                      width: isAwaiting ? '100%' : `${Math.min(100, Math.max(2, item.progress))}%`,
                    }}
                  />
                </div>

                {/* Progress metadata */}
                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {isAwaiting ? (
                      <span className="text-amber-300 font-sans font-medium flex items-center gap-1.5 truncate">
                        <Clock className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                        Waiting for {item.peerName} to accept...
                      </span>
                    ) : isDeclined ? (
                      <span className="text-rose-400 font-sans font-medium flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {item.error || 'Declined by recipient'}
                      </span>
                    ) : isError ? (
                      <span className="text-rose-400 font-sans font-medium flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {item.error || 'Transfer failed'}
                      </span>
                    ) : (
                      <>
                        <span className="text-slate-200 font-semibold">
                          {item.progress.toFixed(1)}%
                        </span>
                        <span>
                          ({formatBytes(item.transferredBytes)} / {formatBytes(item.size)})
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {!isDone && !isFailed && !isPaused && !isAwaiting && (
                      <>
                        <span className="text-cyan-400">{formatSpeed(item.speedBps)}</span>
                        <span>ETA: {formatEta(item.etaSeconds)}</span>
                      </>
                    )}
                    {isPaused && <span className="text-amber-400">Paused</span>}
                    {isDone && <span className="text-emerald-400">Transfer Completed</span>}
                    {isFailed && (
                      <span className="text-rose-400 text-[11px] font-sans font-medium">
                        {canRetry ? 'Tap Retry to resend' : 'Transfer failed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
