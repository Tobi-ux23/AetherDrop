import React, { useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  FileText,
  Trash2,
  FileSpreadsheet,
  Lock,
  Clock,
  Zap,
} from 'lucide-react';
import { TransferHistoryEntry } from '../types';
import { formatBytes, formatDuration, formatSpeed } from '../utils/device';

interface TransferHistoryProps {
  history: TransferHistoryEntry[];
  onClearHistory: () => void;
  onDownloadAgain: (blobUrl: string, name: string) => void;
}

export const TransferHistory: React.FC<TransferHistoryProps> = ({
  history,
  onClearHistory,
  onDownloadAgain,
}) => {
  const [filter, setFilter] = useState<'all' | 'send' | 'receive'>('all');

  const filtered = history.filter((item) => {
    if (filter === 'all') return true;
    return item.direction === filter;
  });

  const exportCSV = () => {
    if (history.length === 0) return;
    const headers = [
      'ID',
      'Filename',
      'Size (Bytes)',
      'Direction',
      'Device',
      'Status',
      'Duration (ms)',
      'Avg Speed (Bps)',
      'Transport',
      'Encryption',
      'Timestamp',
    ];
    const rows = history.map((item) => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.size,
      item.direction,
      `"${item.peerName.replace(/"/g, '""')}"`,
      item.status,
      item.durationMs,
      item.avgSpeedBps,
      item.transportType,
      item.encryption,
      new Date(item.startedAt).toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aetherdrop-transfer-logs-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (history.length === 0) return;
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aetherdrop-transfer-logs-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Transfer Logs & History
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit logs stored locally in your browser memory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter segment */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setFilter('send')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'send'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sent ({history.filter((h) => h.direction === 'send').length})
            </button>
            <button
              onClick={() => setFilter('receive')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'receive'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Received ({history.filter((h) => h.direction === 'receive').length})
            </button>
          </div>

          {history.length > 0 && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                title="Export audit log as CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={onClearHistory}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Clear all logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* History List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-2">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">No transfer logs recorded</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When you send or receive files, their encrypted transfer timestamps, sizes, and speed metrics will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 pl-2">File</th>
                <th className="pb-3 px-3">Size</th>
                <th className="pb-3 px-3">Device</th>
                <th className="pb-3 px-3">Speed & Time</th>
                <th className="pb-3 px-3">Security</th>
                <th className="pb-3 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.map((item) => {
                const isSend = item.direction === 'send';
                const dateStr = new Date(item.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={item.id} className="hover:bg-slate-950/50 transition-colors group">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSend
                              ? 'bg-cyan-950/70 text-cyan-400'
                              : 'bg-emerald-950/70 text-emerald-400'
                          }`}
                        >
                          {isSend ? (
                            <ArrowUpCircle className="w-4 h-4" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-[200px] sm:max-w-xs">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isSend ? 'Sent' : 'Received'} · {dateStr}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-slate-300">
                      {formatBytes(item.size)}
                    </td>

                    <td className="py-3 px-3 text-slate-300 truncate max-w-[140px]">
                      {item.peerName}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                      <div className="flex flex-col text-[11px]">
                        <span className="text-cyan-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {formatSpeed(item.avgSpeedBps)}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(item.durationMs)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-400">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <Lock className="w-3 h-3" />
                        AES-256
                      </span>
                    </td>

                    <td className="py-3 pr-2 text-right">
                      {item.blobUrl && (
                        <button
                          onClick={() => onDownloadAgain(item.blobUrl!, item.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                          title="Save file again"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
