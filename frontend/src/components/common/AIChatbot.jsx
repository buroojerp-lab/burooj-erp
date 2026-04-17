// ============================================================
// BUROOJ HEIGHTS ERP — AI CHATBOT (Claude-powered)
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

export default function AIChatbot() {
  const { t, i18n } = useTranslation();
  const isUrdu = i18n.language === 'ur';

  const [open, setOpen]         = useState(false);
  const [minimized, setMin]     = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('aiWelcome') }
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [hasNew, setHasNew] = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setHasNew(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoad(true);

    try {
      const { data } = await api.post('/chat', {
        messages:  next,
        language:  i18n.language,
      });
      setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
      if (!open || minimized) setHasNew(true);
    } catch (err) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: err.response?.data?.error || 'Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setLoad(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => setMessages([{ role: 'assistant', content: t('aiWelcome') }]);

  // ── Floating Button ──────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#0098B4] hover:bg-[#007A91] text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 group"
        title="AI Assistant"
      >
        <Bot size={24} />
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">!</span>
        )}
        <span className="absolute right-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap shadow-lg">
          AI Assistant
        </span>
      </button>
    );
  }

  // ── Chat Window ──────────────────────────────────────────────
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col transition-all duration-200 ${
        minimized ? 'w-72 h-14' : 'w-96 h-[560px]'
      }`}
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0098B4] rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{t('aiAssistant')}</p>
            {!minimized && <p className="text-white/70 text-xs">Powered by Claude AI</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMin(m => !m)}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition">
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button onClick={() => setOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'assistant' ? 'bg-[#0098B4]' : 'bg-orange-500'
                }`}>
                  {msg.role === 'assistant'
                    ? <Bot size={14} className="text-white" />
                    : <User size={14} className="text-white" />}
                </div>
                {/* Bubble */}
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
                    : 'bg-[#0098B4] text-white rounded-tr-sm'
                }`}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0098B4] flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#0098B4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#0098B4] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#0098B4] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length === 1 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-1.5 overflow-x-auto">
              {[
                'Available units?',
                'This month revenue?',
                'Overdue installments?',
                'Total customers?',
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-xs bg-white border border-gray-200 text-gray-600 hover:border-[#0098B4] hover:text-[#0098B4] px-2.5 py-1.5 rounded-lg whitespace-nowrap transition flex-shrink-0">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white rounded-b-2xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t('typeMessage')}
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0098B4] transition max-h-24 overflow-y-auto"
                style={{ lineHeight: '1.4' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-[#0098B4] hover:bg-[#007A91] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition flex-shrink-0"
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-xs text-gray-400">Enter to send · Shift+Enter for new line</p>
              <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-500 transition">Clear</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
