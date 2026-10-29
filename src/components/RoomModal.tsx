import React, { useState } from 'react';
import { X, Plus, LogIn, ArrowRight } from 'lucide-react';
import { generateRoomCode } from '../utils/crypto';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [roomInput, setRoomInput] = useState('');
  const [previewCode, setPreviewCode] = useState(generateRoomCode());

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreateRoom();
    onClose();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      onJoinRoom(roomInput.trim().toUpperCase());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-100">
            {currentRoomId ? 'Switch or Join Room' : 'Start Transfer Room'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle: Create vs Join */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'create'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Room</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'join'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Join Room</span>
          </button>
        </div>

        {/* Tab 1: Create Room */}
        {tab === 'create' && (
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center space-y-2">
              <span className="text-[11px] text-slate-400">Generated Room Code</span>
              <div className="font-mono text-xl font-bold tracking-wider text-cyan-400">
                {previewCode}
              </div>
              <p className="text-[11px] text-slate-500">
                A QR code will be generated to pair your phone or PC in seconds.
              </p>
            </div>

            <button
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors shadow-md shadow-cyan-950/30"
            >
              <span>Create & Enter Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 2: Join Room */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Enter Room Code
              </label>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="e.g. ECHO-850"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-cyan-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                autoFocus
                required
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Type the 6-character room code from your other device.
              </p>
            </div>

            <button
              type="submit"
              disabled={!roomInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors"
            >
              <span>Join Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
