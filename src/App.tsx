/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  History,
  Shield,
  WifiOff,
} from 'lucide-react';
import { connectionManager } from './services/connectionManager';
import { Header } from './components/Header';
import { RoomSelector } from './components/RoomSelector';
import { DropZone, DropZoneHandle } from './components/DropZone';
import { ActiveTransfers } from './components/ActiveTransfers';
import { ConnectedDevices } from './components/ConnectedDevices';
import { TransferHistory } from './components/TransferHistory';
import { SecurityGuide } from './components/SecurityGuide';
import { QRCodeModal } from './components/QRCodeModal';
import { RoomModal } from './components/RoomModal';
import { QuickTextFeed } from './components/QuickTextFeed';
import { IncomingTransferModal } from './components/IncomingTransferModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'transfer' | 'devices' | 'history' | 'security'>('transfer');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const dropZoneRef = useRef<DropZoneHandle>(null);

  // Sync state with connection manager
  const [, setTick] = useState(0);

  useEffect(() => {
    // Initialize WebSocket connection
    connectionManager.connectWebSocket();

    const unsubscribe = connectionManager.subscribe(() => {
      setTick((t) => t + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const peers = Array.from(connectionManager.peers.values());
  const activeTransfersList = Array.from(connectionManager.activeTransfers.values());

  const handleCreateRoom = () => {
    connectionManager.createRoom();
    setIsQrOpen(true);
  };

  const handleJoinRoom = (roomCode: string) => {
    connectionManager.joinRoom(roomCode);
  };

  const handleLeaveRoom = () => {
    connectionManager.leaveRoom();
  };

  const handleSendFile = async (file: File, targetPeerId?: string) => {
    await connectionManager.sendFile(file, targetPeerId);
  };

  const handleSendQuickText = async (text: string, targetPeerId?: string) => {
    await connectionManager.sendQuickText(text, targetPeerId);
  };

  const handleAcceptTransfer = (transferId: string) => {
    connectionManager.acceptTransfer(transferId);
  };

  const handleDeclineTransfer = (transferId: string) => {
    connectionManager.declineTransfer(transferId);
  };

  const handleSelectPeerForSend = (peerId: string) => {
    dropZoneRef.current?.setTargetPeer(peerId);
    dropZoneRef.current?.scrollTo();
    dropZoneRef.current?.openFilePicker();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-20 md:pb-8 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQR={() => setIsQrOpen(true)}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        onLeaveRoom={handleLeaveRoom}
        peerCount={peers.length}
        roomId={connectionManager.roomId}
        inRoom={connectionManager.inRoom}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Offline / Connecting Warning Banner if WS drops */}
        {!connectionManager.isConnected && (
          <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Connecting to signaling network... (retrying automatically)</span>
            </div>
            <button
              onClick={() => connectionManager.connectWebSocket()}
              className="text-amber-300 underline hover:text-amber-100"
            >
              Reconnect Now
            </button>
          </div>
        )}

        {/* Combined: Transfer Files & Connected Devices view */}
        {(activeTab === 'transfer' || activeTab === 'devices') && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {!connectionManager.inRoom ? (
              /* Create or Join Room Landing View */
              <RoomSelector
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
              />
            ) : (
              /* In-Room Transfer Experience */
              <>
                {/* Active transfers progress bars */}
                <ActiveTransfers
                  transfers={activeTransfersList}
                  onPause={(id) => connectionManager.pauseTransfer(id)}
                  onResume={(id) => connectionManager.resumeTransfer(id)}
                  onCancel={(id) => connectionManager.cancelTransfer(id)}
                  onDownload={(url, name) => connectionManager.triggerDownload(url, name)}
                  onRetry={(id) => connectionManager.retryTransfer(id)}
                />

                {/* Drag and Drop files card */}
                <DropZone
                  ref={dropZoneRef}
                  onSendFile={handleSendFile}
                  onSendQuickText={handleSendQuickText}
                  peers={peers}
                  isConnected={connectionManager.isConnected}
                  onOpenQR={() => setIsQrOpen(true)}
                />

                {/* Connected Devices (shown below the drag & drop files section) */}
                <ConnectedDevices
                  localPeer={connectionManager.localPeer}
                  peers={peers}
                  peerTransports={connectionManager.peerTransports}
                  roomId={connectionManager.roomId}
                  fingerprint={connectionManager.securityFingerprint}
                  onUpdateDeviceName={(name) => connectionManager.setDeviceName(name)}
                  onOpenQR={() => setIsQrOpen(true)}
                  onOpenRoomModal={() => setIsRoomModalOpen(true)}
                  onLeaveRoom={handleLeaveRoom}
                  onSelectPeerForSend={handleSelectPeerForSend}
                />

                {/* Quick text / links transferred in room */}
                <QuickTextFeed texts={connectionManager.quickTexts} />
              </>
            )}
          </div>
        )}

        {/* Tab 2: Transfer History Logs */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-150">
            <TransferHistory
              history={connectionManager.history}
              onClearHistory={() => connectionManager.clearHistory()}
              onDownloadAgain={(url, name) => connectionManager.triggerDownload(url, name)}
            />
          </div>
        )}

        {/* Tab 3: How It Works & Security */}
        {activeTab === 'security' && (
          <div className="animate-in fade-in duration-150">
            <SecurityGuide />
          </div>
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-3 items-center h-16 px-2">
        <button
          onClick={() => setActiveTab('transfer')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] relative transition-colors ${
            activeTab === 'transfer' || activeTab === 'devices' ? 'text-cyan-400 font-medium' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <UploadCloud className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Transfer</span>
          {connectionManager.inRoom && peers.length > 0 && (
            <span className="absolute top-2.5 right-6 sm:right-10 w-2 h-2 rounded-full bg-cyan-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'history' ? 'text-cyan-400 font-medium' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'security' ? 'text-cyan-400 font-medium' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Privacy</span>
        </button>
      </nav>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        roomId={connectionManager.roomId}
        fingerprint={connectionManager.securityFingerprint}
      />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        currentRoomId={connectionManager.roomId}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />

      {/* Incoming File Transfer Approval Prompt */}
      <IncomingTransferModal
        requests={connectionManager.incomingRequests}
        onAccept={handleAcceptTransfer}
        onDecline={handleDeclineTransfer}
      />
    </div>
  );
}
