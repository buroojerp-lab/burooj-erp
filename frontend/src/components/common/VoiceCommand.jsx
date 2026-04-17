// ============================================================
// BUROOJ HEIGHTS ERP — VOICE COMMAND (Web Speech API)
// ============================================================
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, X, Loader, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../utils/api';

// ── Command parser ────────────────────────────────────────────
const parseCommand = (text) => {
  const t = text.toLowerCase().trim();

  // Navigation commands
  if (/\b(go to|open|show)\s+dashboard/i.test(t))   return { action: 'navigate', path: '/' };
  if (/\b(go to|open|show)\s+properties/i.test(t))   return { action: 'navigate', path: '/properties' };
  if (/\b(go to|open|show)\s+customers/i.test(t))    return { action: 'navigate', path: '/customers' };
  if (/\b(go to|open|show)\s+bookings/i.test(t))     return { action: 'navigate', path: '/bookings' };
  if (/\b(go to|open|show)\s+payments/i.test(t))     return { action: 'navigate', path: '/payments' };
  if (/\b(go to|open|show)\s+installments/i.test(t)) return { action: 'navigate', path: '/installments' };
  if (/\b(go to|open|show)\s+(hr|human resources)/i.test(t)) return { action: 'navigate', path: '/hr' };
  if (/\b(go to|open|show)\s+(reports?)/i.test(t))   return { action: 'navigate', path: '/reports' };
  if (/\b(go to|open|show)\s+(settings?)/i.test(t))  return { action: 'navigate', path: '/settings' };

  // Search client
  const clientMatch = t.match(/(?:search|find|look up|show)\s+(?:client|customer)\s+(.+)/i);
  if (clientMatch) return { action: 'search_customer', query: clientMatch[1].trim() };

  // Search unit
  const unitMatch = t.match(/(?:search|find|show|open)\s+unit\s+([a-z0-9-]+)/i);
  if (unitMatch) return { action: 'search_unit', query: unitMatch[1].trim() };

  // New booking
  if (/new booking|create booking|add booking/i.test(t)) return { action: 'navigate', path: '/bookings/new' };

  // Add unit
  if (/add unit|new unit/i.test(t)) return { action: 'navigate', path: '/properties' };

  return { action: 'unknown', raw: text };
};

export default function VoiceCommand({ onSearchResult }) {
  const { t } = useTranslation();
  const navigate   = useNavigate();
  const [open, setOpen]         = useState(false);
  const [listening, setListen]  = useState(false);
  const [transcript, setTrans]  = useState('');
  const [result, setResult]     = useState(null);
  const [supported, setSupp]    = useState(true);
  const recognRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupp(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error(t('voiceNotSupported')); return; }

    const recognition = new SR();
    recognRef.current = recognition;
    recognition.lang            = 'en-US';
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onstart  = () => { setListen(true); setTrans(''); setResult(null); };
    recognition.onend    = () => setListen(false);
    recognition.onerror  = (e) => { setListen(false); if (e.error !== 'no-speech') toast.error(`Voice error: ${e.error}`); };

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(' ');
      setTrans(text);

      if (event.results[event.results.length - 1].isFinal) {
        const cmd = parseCommand(text);
        executeCommand(cmd, text);
      }
    };

    recognition.start();
  }, [navigate, t]);

  const executeCommand = useCallback(async (cmd, rawText) => {
    setResult(cmd);

    if (cmd.action === 'navigate') {
      toast.success(`Navigating to ${cmd.path}`);
      setTimeout(() => { navigate(cmd.path); setOpen(false); }, 600);
      return;
    }

    if (cmd.action === 'search_customer') {
      try {
        const { data } = await api.get('/customers', { params: { search: cmd.query, limit: 5 } });
        const customers = data.data || [];
        if (customers.length === 1) {
          navigate(`/customers/${customers[0].id}`);
          setOpen(false);
        } else if (customers.length > 1) {
          setResult({ ...cmd, found: customers });
        } else {
          setResult({ ...cmd, found: [] });
        }
      } catch { toast.error('Search failed'); }
      return;
    }

    if (cmd.action === 'search_unit') {
      try {
        const { data } = await api.get('/property/units', { params: { search: cmd.query, limit: 5 } });
        const units = data.data || [];
        if (units.length === 1) {
          navigate(`/properties/units/${units[0].id}`);
          setOpen(false);
        } else if (units.length > 1) {
          setResult({ ...cmd, found: units });
        } else {
          setResult({ ...cmd, found: [] });
        }
      } catch { toast.error('Search failed'); }
      return;
    }

    // Unknown — show raw transcript
    setResult({ action: 'unknown', raw: rawText });
  }, [navigate]);

  const stop = () => { recognRef.current?.stop(); setListen(false); };

  return (
    <>
      {/* Trigger button — in top bar */}
      <button
        onClick={() => setOpen(true)}
        className={`p-2 rounded-lg transition ${supported ? 'hover:bg-gray-100 text-gray-500 hover:text-[#0098B4]' : 'opacity-30 cursor-not-allowed'}`}
        title={t('voiceSearch')}
        disabled={!supported}
      >
        <Mic size={18} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-[#0098B4] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${listening ? 'bg-white' : 'bg-white/20'}`}>
                  {listening
                    ? <Volume2 size={20} className="text-[#0098B4]" />
                    : <Mic size={20} className="text-white" />}
                </div>
                <div>
                  <p className="text-white font-semibold">{t('voiceSearch')}</p>
                  <p className="text-white/70 text-xs">
                    {listening ? t('listening') : t('voiceHint')}
                  </p>
                </div>
              </div>
              <button onClick={() => { stop(); setOpen(false); }}
                className="p-2 hover:bg-white/20 rounded-lg text-white transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Mic button */}
              <div className="flex justify-center">
                <button
                  onClick={listening ? stop : startListening}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    listening
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110'
                      : 'bg-[#0098B4] hover:bg-[#007A91] hover:scale-105'
                  }`}
                >
                  {listening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
                </button>
              </div>

              {/* Transcript */}
              {transcript && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Heard:</p>
                  <p className="text-gray-800 font-medium">"{transcript}"</p>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className={`rounded-xl p-4 border ${result.action === 'unknown' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                  {result.action === 'navigate' && (
                    <p className="text-green-700 text-sm font-medium">✓ Navigating...</p>
                  )}
                  {(result.action === 'search_customer' || result.action === 'search_unit') && result.found && (
                    <div>
                      {result.found.length === 0 ? (
                        <p className="text-yellow-700 text-sm">No results found for "{result.query}"</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-green-700 text-sm font-medium">{result.found.length} result(s) found:</p>
                          {result.found.map(item => (
                            <button key={item.id}
                              onClick={() => {
                                navigate(result.action === 'search_customer' ? `/customers/${item.id}` : `/properties/units/${item.id}`);
                                setOpen(false);
                              }}
                              className="w-full text-left p-2.5 bg-white rounded-lg border border-gray-200 hover:border-[#0098B4] text-sm text-gray-800 transition">
                              {item.name || item.unit_number} {item.phone ? `— ${item.phone}` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {result.action === 'unknown' && (
                    <p className="text-yellow-700 text-sm">Didn't understand: "{result.raw}". Try saying "show customers" or "search client Ahmed".</p>
                  )}
                </div>
              )}

              {/* Command help */}
              {!transcript && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Example commands</p>
                  {[
                    'Go to dashboard',
                    'Search client Ahmed',
                    'Show unit A-101',
                    'Open bookings',
                    'New booking',
                  ].map(cmd => (
                    <div key={cmd} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      "{cmd}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
