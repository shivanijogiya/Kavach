import { useRef, useState, useEffect } from 'react';
import { MessageSquare, X, Send, Mic } from 'lucide-react';
import { answer } from '../lib/copilot';

export default function Copilot({ ctx, suggestions }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ from: 'bot', text: ctx.role === 'supervisor' ? 'Site copilot here. I answer from live site data.' : 'Hi. I can tell you about your machine, tasks, weather and safety procedures.' }]);
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, open]);

  const ask = (text) => {
    if (!text.trim()) return;
    const reply = answer(text, ctx);
    setMsgs((m) => [...m, { from: 'me', text }, { from: 'bot', text: reply }]);
    setQ('');
    if ('speechSynthesis' in window && listening === 'voice') {
      const u = new SpeechSynthesisUtterance(reply); u.lang = 'en-IN'; window.speechSynthesis.speak(u);
    }
  };

  const voice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { from: 'bot', text: 'Voice input needs Chrome or Edge. You can type your question instead.' }]); return; }
    const r = new SR(); r.lang = 'en-IN'; r.interimResults = false;
    setListening(true);
    r.onresult = (e) => { setListening('voice'); ask(e.results[0][0].transcript); setTimeout(() => setListening(false), 100); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening((l) => (l === true ? false : l));
    r.start();
  };

  return (
    <>
      {open && (
        <div className="copilot" role="dialog" aria-label="Site copilot">
          <header>
            <div><h3>Site copilot</h3><div className="small muted">Answers from live data. Safety alerts always come from the engines.</div></div>
            <button className="btn ghost sm" onClick={() => setOpen(false)} aria-label="Close copilot"><X size={16} /></button>
          </header>
          <div className="msgs" ref={box}>
            {msgs.map((m, i) => <div key={i} className={`msg ${m.from}`}>{m.text}</div>)}
          </div>
          <div className="suggest">
            {suggestions.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <button type="button" className="btn sm" onClick={voice} aria-label="Ask by voice" style={listening === true ? { background: 'var(--danger)', color: '#fff' } : undefined}><Mic size={15} /></button>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" aria-label="Question" />
            <button className="btn primary sm" aria-label="Send"><Send size={15} /></button>
          </form>
        </div>
      )}
      <button className="copilot-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <MessageSquare size={17} /> Copilot
      </button>
    </>
  );
}
