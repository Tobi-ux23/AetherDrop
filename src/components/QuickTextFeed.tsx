import React, { useState } from 'react';
import { Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import { QuickTextMessage } from '../types';

interface QuickTextFeedProps {
  texts: QuickTextMessage[];
}

export const QuickTextFeed: React.FC<QuickTextFeedProps> = ({ texts }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (texts.length === 0) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <MessageSquare className="w-4 h-4 text-cyan-400" />
        <span>Encrypted Notes & Links ({texts.length})</span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {texts.map((item) => {
          const isLink = isUrl(item.text);
          return (
            <div
              key={item.id}
              className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                  <span className="font-medium text-slate-400">{item.senderName}</span>
                  <span>·</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-slate-200 font-mono break-all whitespace-pre-wrap select-all">
                  {item.text}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isLink && (
                  <a
                    href={item.text}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Open link in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleCopy(item.id, item.text)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
