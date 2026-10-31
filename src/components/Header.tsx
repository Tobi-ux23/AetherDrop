import { QrCode, ShieldCheck, LogOut, PlusCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'transfer' | 'devices' | 'history' | 'security';
  setActiveTab: (tab: 'transfer' | 'devices' | 'history' | 'security') => void;
  onOpenQR: () => void;
  onOpenRoomModal: () => void;
  onOpenSignalingModal?: () => void;
  onLeaveRoom: () => void;
  peerCount: number;
  roomId: string;
  inRoom: boolean;
  signalingStatus?: unknown;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenQR,
  onOpenRoomModal,
  onLeaveRoom,
  peerCount,
  roomId,
  inRoom,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark */}
        <button
          onClick={() => setActiveTab('transfer')}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-cyan-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0">
              AetherDrop
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 flex items-center gap-2 ${
              activeTab === 'transfer' || activeTab === 'devices'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>Transfer & Devices</span>
            {inRoom && peerCount > 0 && (
              <span className="font-mono text-xs px-2 py-0.5 bg-cyan-950 text-cyan-300 rounded-full border border-cyan-800/60 font-semibold">
                {peerCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              activeTab === 'history'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Transfer Logs
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              activeTab === 'security'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            How It Works
          </button>
        </nav>

        {/* Zone 3: Primary Action & Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {inRoom ? (
            <>
              <button
                onClick={onOpenQR}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                title="Show QR Code and Pairing Details"
              >
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Pair Device</span>
                <span className="font-mono text-[11px] text-cyan-300 px-1 py-0.5 bg-slate-800 rounded">
                  {roomId}
                </span>
              </button>

              <button
                onClick={onLeaveRoom}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 hover:border-rose-400/80 rounded-lg transition-all shadow-sm hover:shadow-rose-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 shrink-0"
                title="Exit room"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Exit Room</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenRoomModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-cyan-950/40"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create or Join</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
