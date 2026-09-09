'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, Copy, Check, AlertTriangle, ShieldCheck, HelpCircle, Code2, Terminal, ShieldAlert } from 'lucide-react';

const MAX_MESSAGES = 10;

export default function FindingChatModal({ finding, scanId, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your AI Security Assistant assigned specifically to **"${finding.title}"**.\n\n**Issue Summary**: ${finding.description || 'Security configuration issue detected.'}\n\n**Recommended Fix**: ${finding.remediation || 'Apply standard security header or configuration updates.'}\n\nAsk me any follow-up questions about real-world risk, code snippets, or framework fixes!`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);

  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const isCapReached = userMsgCount >= MAX_MESSAGES;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (customPrompt) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || loading || isCapReached) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');

      const res = await fetch(`${API_URL}/api/scan/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          scanId,
          finding,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) throw new Error('Failed to fetch AI response');
      const data = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Sorry, I could not complete that request. Please try asking again.\n\n*Default Remediation*: ${finding.remediation}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPills = [
    { icon: HelpCircle, label: 'Real-world attack risk?', prompt: 'What is the real-world attack risk and impact if an attacker exploits this?' },
    { icon: Code2, label: 'Next.js / React fix', prompt: 'Show me the exact copy-paste code fix for a Next.js / React application.' },
    { icon: Terminal, label: 'NGINX / Express config', prompt: 'Show me the configuration snippet for NGINX and Node/Express.js.' },
    { icon: ShieldAlert, label: 'How to verify fix?', prompt: 'How can I verify and test if my fix is working properly?' }
  ];

  return (
    <div
      onClick={onClose}
      className="fixed top-16 right-0 left-0 bottom-0 z-40 flex justify-end finding-chat-modal-overlay transition-opacity duration-300"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg h-full finding-chat-modal-drawer shadow-2xl overflow-hidden flex flex-col border-l border-slate-800/80 transition-transform duration-300"
        style={{ backgroundColor: '#090d16', color: '#f8fafc' }}
      >
        
        {/* Header with Radial Gradient */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 flex items-start justify-between gap-3 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 pointer-events-none" />
          <div className="flex items-start gap-3 min-w-0 relative z-10 flex-1">
            <div className="p-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0 mt-0.5 shadow-lg shadow-indigo-500/10">
              <Sparkles className="h-4 w-4 animate-pulse text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono tracking-wider shrink-0">
                  AI Remediation Coach
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  finding.severity === 'critical' || finding.severity === 'high'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {finding.severity}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug line-clamp-2" title={finding.title}>
                {finding.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all shrink-0 relative z-10 border border-transparent hover:border-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Notice */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0 font-medium">
          <span className="flex items-center gap-1.5 text-slate-350">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            Scoped to this bug • Max 350 tokens/reply
          </span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${isCapReached ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
            {userMsgCount} / {MAX_MESSAGES} msgs
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-sm ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none font-medium'
                    : 'bg-slate-950/90 border border-slate-800/90 text-slate-200 rounded-tl-none relative group'
                }`}
              >
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopyCode(msg.content, idx)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title="Copy response"
                  >
                    {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
                <div className="whitespace-pre-wrap font-sans space-y-2">
                  {msg.content}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-indigo-400 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
              <div className="h-7 w-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
              <span className="animate-pulse font-medium text-slate-300">Analyzing vulnerability context & generating advice...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Pills */}
        {!isCapReached && (
          <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-thin shrink-0">
            {quickPills.map((pill, idx) => {
              const Icon = pill.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(pill.prompt)}
                  disabled={loading}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 px-3 py-1.5 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Icon className="h-3 w-3 text-indigo-400 shrink-0" />
                  {pill.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 shrink-0">
          {isCapReached ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-400 flex items-center justify-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Chat session limit reached ({MAX_MESSAGES} messages) for this finding.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about fixing this vulnerability... (e.g. 'Show Next.js code fix')"
                value={input}
                maxLength={300}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold transition-all disabled:opacity-40 shrink-0 shadow-md shadow-indigo-500/20 hover:scale-[1.02]"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
