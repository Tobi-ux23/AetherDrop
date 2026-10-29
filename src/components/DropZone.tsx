import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  X,
  Send,
  AlertCircle,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  MessageSquare,
} from 'lucide-react';
import { formatBytes } from '../utils/device';
import { MAX_FILE_SIZE } from '../services/connectionManager';
import { PeerInfo } from '../types';

export interface DropZoneHandle {
  openFilePicker: () => void;
  setTargetPeer: (peerId: string) => void;
  scrollTo: () => void;
}

interface DropZoneProps {
  onSendFile: (file: File, targetPeerId?: string) => Promise<void>;
  onSendQuickText: (text: string, targetPeerId?: string) => Promise<void>;
  peers: PeerInfo[];
  isConnected: boolean;
  onOpenQR: () => void;
}

export const DropZone = React.forwardRef<DropZoneHandle, DropZoneProps>(({
  onSendFile,
  onSendQuickText,
  peers,
  isConnected,
  onOpenQR,
}, ref) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Quick text sharing mode
  const [isTextMode, setIsTextMode] = useState(false);
  const [quickText, setQuickText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      fileInputRef.current?.click();
    },
    setTargetPeer: (peerId: string) => {
      setTargetPeerId(peerId);
    },
    scrollTo: () => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage className="w-5 h-5 text-cyan-400" />;
    if (file.type.startsWith('video/')) return <FileVideo className="w-5 h-5 text-indigo-400" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-5 h-5 text-emerald-400" />;
    if (file.name.match(/\.(zip|tar|gz|rar|7z)$/i)) return <FileArchive className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-slate-300" />;
  };

  const validateAndAddFiles = (fileList: FileList | File[]) => {
    setErrorMsg(null);
    const valid: File[] = [];

    Array.from(fileList).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`"${file.name}" exceeds the 500 MB limit (${formatBytes(file.size)}).`);
      } else {
        valid.push(file);
      }
    });

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = ''; // Reset input so same file can be selected again
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendAll = async () => {
    if (selectedFiles.length === 0) return;
    if (peers.length === 0) {
      setErrorMsg('No recipient device connected. Scan the QR code or share your room code to pair first.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    try {
      for (const file of selectedFiles) {
        await onSendFile(file, targetPeerId || undefined);
      }
      setSelectedFiles([]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch file transfer.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async () => {
    if (!quickText.trim()) return;
    if (peers.length === 0) {
      setErrorMsg('No recipient device connected. Pair with a phone or PC first.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    try {
      await onSendQuickText(quickText.trim(), targetPeerId || undefined);
      setQuickText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send text.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-7 shadow-xl shadow-black/20"
    >
      {/* Mode switch */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
          <button
            onClick={() => setIsTextMode(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              !isTextMode ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            File Transfer (up to 500MB)
          </button>
          <button
            onClick={() => setIsTextMode(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              isTextMode ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Encrypted Text / Link</span>
          </button>
        </div>

        {/* Peer target selection if multiple connected */}
        {peers.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Send to:</span>
            <select
              value={targetPeerId}
              onChange={(e) => setTargetPeerId(e.target.value)}
              className="bg-slate-950 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              <option value="">All Peers ({peers.length})</option>
              {peers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isTextMode ? (
        <div>
          {/* Drag & Drop Card */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center min-h-[220px] ${
              isDragOver
                ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
                : 'border-slate-700/80 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-base md:text-lg font-semibold text-slate-100 mb-1">
              {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
            </h3>

            <p className="text-xs md:text-sm text-slate-400 max-w-md mb-4">
              or tap to browse documents, videos, photos, or archives from your device
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Supports files up to 500 MB</span>
              <span aria-hidden="true">·</span>
              <span>AES-256-GCM Encrypted</span>
              <span aria-hidden="true">·</span>
              <span>Direct P2P</span>
            </div>
          </div>

          {/* Queue of selected files ready to send */}
          {selectedFiles.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Ready to send ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
                </span>
                <span>
                  Total:{' '}
                  {formatBytes(
                    selectedFiles.reduce((acc, f) => acc + f.size, 0)
                  )}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(file)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedFiles([])}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Clear Selection
                </button>

                <button
                  onClick={handleSendAll}
                  disabled={isSending || peers.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-all shadow-md shadow-cyan-950/30"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {peers.length === 0
                      ? 'Pair a Device to Send'
                      : isSending
                      ? 'Dispatching...'
                      : `Send ${selectedFiles.length} ${selectedFiles.length === 1 ? 'File' : 'Files'}`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Quick Encrypted Text Mode */
        <div className="space-y-4">
          <div className="relative">
            <textarea
              rows={4}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Paste a link, note, WiFi password, or secret code to securely transmit directly to your paired device..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Encrypted with room key before transmission
            </span>

            <button
              onClick={handleSendText}
              disabled={isSending || !quickText.trim() || peers.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Note</span>
            </button>
          </div>
        </div>
      )}

      {/* Helper when no peers are connected */}
      {peers.length === 0 && (
        <div className="mt-5 p-3.5 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            <span className="font-medium text-slate-300">Ready to transfer?</span> Open this page on your phone or PC to pair them.
          </div>
          <button
            onClick={onOpenQR}
            className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-950 border border-cyan-800/80 rounded-lg whitespace-nowrap transition-colors"
          >
            Show QR Code / Room Link
          </button>
        </div>
      )}
    </div>
  );
});

DropZone.displayName = 'DropZone';
