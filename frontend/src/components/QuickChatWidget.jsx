import React, { useState, useRef, useEffect } from 'react';

function QuickChatWidget({ settings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'model', text: `Need a quick help?` }]);
    }
    if (!isOpen) {
      // Clear history when closed per user request
      setMessages([]);
    }
  }, [isOpen, settings.learnLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      history.push({ role: 'user', parts: [{ text: userMessage }] });

      const selectedModel = settings.model || 'gemini-3.7-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `You are a helpful language tutor for a user learning ${settings.learnLanguage}. The user's native language is ${settings.appLanguage}. Keep your answers short, concise, and helpful.` }]
          },
          contents: history
        })
      });

      if (res.status === 503 || res.status === 429) {
          console.log("High demand on 3.7-flash. Falling back to 3.5-flash-lite...");
          const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${settings.api_key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  systemInstruction: {
                      parts: [{ text: `You are a helpful language tutor for a user learning ${settings.learnLanguage}. The user's native language is ${settings.appLanguage}. Keep your answers short, concise, and helpful.` }]
                  },
                  contents: history
              })
          });
          const data = await fallbackRes.json();
          if (!fallbackRes.ok) throw new Error(data.error?.message || 'API Error');
          const reply = data.candidates[0].content.parts[0].text;
          setMessages(prev => [...prev, { role: 'model', text: reply }]);
          setIsLoading(false);
          return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'API Error');

      const reply = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {isOpen && (
        <div className="slide-in" style={{
          width: '350px',
          height: '450px',
          backgroundColor: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Tutor Chat</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
          </div>
          
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                color: 'var(--text-main)',
                padding: '0.7rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                lineHeight: '1.5',
                fontSize: '0.9rem'
              }}>
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Typing...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={{ padding: '0.8rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }}
            />
            <button type="submit" disabled={isLoading} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '1rem' }}>
              ➤
            </button>
          </form>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: isOpen ? 'rgba(99,102,241,0.8)' : 'rgba(10,10,10,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: isOpen ? 'white' : 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: isOpen ? '0 4px 20px rgba(99,102,241,0.4)' : '0 4px 20px rgba(0,0,0,0.4)',
          cursor: 'pointer', fontSize: '1.4rem', display: 'flex', justifyContent: 'center', alignItems: 'center',
          transition: 'all 0.3s',
          animation: isOpen ? 'none' : 'pulse-glow 4s infinite'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        title="Need a quick help?"
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  );
}

export default QuickChatWidget;
