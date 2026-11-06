/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Laptop,
  Tablet,
  Check,
} from 'lucide-react';
import { PeerInfo } from '../types';

interface DeviceModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  localPeer: PeerInfo;
  onUpdateDeviceName: (name: string, isCustom?: boolean) => void;
}

export const DeviceModelModal: React.FC<DeviceModelModalProps> = ({
  isOpen,
  onClose,
  localPeer,
  onUpdateDeviceName,
}) => {
  const [nameInput, setNameInput] = useState(localPeer.name);

  useEffect(() => {
    setNameInput(localPeer.name);
  }, [localPeer.name, isOpen]);

  if (!isOpen) return null;

  const handleSave = (nameToSave: string, isCustom = true) => {
    const trimmed = nameToSave.trim();
    if (!trimmed) return;
    onUpdateDeviceName(trimmed, isCustom);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-5 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              {localPeer.deviceType === 'phone' ? (
                <Smartphone className="w-5 h-5" />
              ) : localPeer.deviceType === 'tablet' ? (
                <Tablet className="w-5 h-5" />
              ) : (
                <Laptop className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Device Model & Name</h2>
              <p className="text-xs text-slate-400">Set the display name shown to other devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(nameInput);
          }}
          className="space-y-3"
        >
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Device Name / Model
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. iPhone 17 Pro, Dell XPS 15, ThinkPad..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 font-medium"
              autoFocus
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-950/50"
            >
              <Check className="w-4 h-4" />
              <span>Apply</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
