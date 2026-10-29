import React, { useState } from 'react';
import {
  Plus,
  ArrowRight,
  Laptop,
} from 'lucide-react';

interface RoomSelectorProps {
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  onCreateRoom,
  onJoinRoom,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let code = joinInput.trim();
    // Allow pasting a full URL like https://.../?room=ECHO-850
    if (code.includes('?room=')) {
      try {
        const url = new URL(code);
        const r = url.searchParams.get('room');
        if (r) code = r;
      } catch {}
    }

    if (!code) {
      setError('Please enter a room code');
      return;
    }

    onJoinRoom(code.toUpperCase());
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 md:py-8 space-y-8 animate-in fade-in duration-200">
      {/* Hero Headline */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white max-w-xl mx-auto" style={{ textWrap: 'balance' }}>
          Transfer files securely between Devices
        </h1>
      </div>

      {/* 2 Primary Action Cards: Create Room vs Join Room */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Create Room */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 md:p-8 flex flex-col justify-between transition-all shadow-xl shadow-black/20 group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-inner group-hover:scale-105 transition-transform">
              <Plus className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-100">Create Room</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Start a fresh transfer session. You will get a room code and a scannable QR code to instantly pair your phone or PC.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={onCreateRoom}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-md shadow-cyan-950/30 active:scale-[0.98]"
            >
              <span>Create New Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Join Room */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 md:p-8 flex flex-col justify-between transition-all shadow-xl shadow-black/20">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shadow-inner">
              <Laptop className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-100">Join Room</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Enter the 6-character room code shown on your other device, or paste a shared invite link.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3 pt-2">
              <div>
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  placeholder="e.g. ECHO-850"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-400 uppercase tracking-wider placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={!joinInput.trim()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all border border-slate-700/80 active:scale-[0.98]"
              >
                <span>Join Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
