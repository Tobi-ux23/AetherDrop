import React from 'react';
import { Shield } from 'lucide-react';

export const SecurityGuide: React.FC = () => {
  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          <span>How AetherDrop Protects Your Privacy</span>
        </h3>
        <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
          Designed from the ground up for zero-knowledge, direct peer-to-peer transmission between phones and computers over the internet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">
            Direct WebRTC DataChannel (No Cloud Storage)
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your files stream directly through a secure SCTP DataChannel established between your phone and PC. No servers ever store or touch your files on any disk.
          </p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">
            End-to-End Encryption (AES-256-GCM)
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every 64KB chunk of your file is encrypted client-side using standard Web Crypto API AES-GCM 256-bit with unique random IVs. The encryption secret stays in your browser URL fragment and is never sent to signaling servers.
          </p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">
            500 MB Chunked Streaming & Backpressure
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Files up to 500 MB are sliced into dynamic memory-efficient chunks. The transfer monitor regulates sender buffer pressure to avoid browser crashes and cellular throttling on mobile devices.
          </p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">
            Cryptographic Visual Fingerprints
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Both the phone and computer display identical 4-emoji verification codes derived from your shared session key. This allows you to verify that no man-in-the-middle can intercept your session.
          </p>
        </div>
      </div>
    </div>
  );
};
