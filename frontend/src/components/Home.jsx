import React from 'react';
import ProfileDrawer from './ProfileDrawer';

function Home({ t, setCurrentView, handleStartSpeaking, setIsProfileOpen, errorBanner, profileProps }) {
  const { streak, practicedToday } = (() => {
    try {
      const today = new Date().toDateString();
      const data = JSON.parse(localStorage.getItem('lingua_streak') || '{}');
      const lastDate = data.lastDate;
      const lastStreak = data.streak || 0;
      if (lastDate === today) {
        return { streak: lastStreak, practicedToday: true };
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate === yesterday.toDateString()) {
        return { streak: lastStreak, practicedToday: false };
      }
      return { streak: 0, practicedToday: false };
    } catch { return { streak: 0, practicedToday: false }; }
  })();

  const markPracticed = () => {
    const today = new Date().toDateString();
    const data = JSON.parse(localStorage.getItem('lingua_streak') || '{}');
    if (data.lastDate === today) return; // already counted
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const newStreak = data.lastDate === yesterday.toDateString() ? (data.streak || 0) + 1 : 1;
    localStorage.setItem('lingua_streak', JSON.stringify({ lastDate: today, streak: newStreak }));
  };

  return (
    <div className="app-container home-mode">
      {errorBanner}
      <header className="header top-nav" style={{ position: 'relative' }}>
        {streak > 1 && (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              padding: '0.3rem 0.8rem', borderRadius: '20px',
              fontSize: '0.85rem', fontWeight: 'bold'
            }}>
              🔥 {streak} day streak
            </span>
            {!practicedToday && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Practice today!
              </span>
            )}
          </div>
        )}
        <div className="nav-links" style={{ marginLeft: 'auto' }}>
           <span onClick={() => setCurrentView('settings')}>{t('settings')}</span>
           <span onClick={() => setIsProfileOpen(true)}>{t('profile')}</span>
        </div>
      </header>

      <main className="hero-section">
        <h1 className="hero-title">{t('title')}</h1>

        {!profileProps?.savedNotes && !window.localStorage.getItem('lingua_settings')?.includes('"api_key":"AIza') ? null : null}

        {/* API Key Warning Banner */}
        {(() => {
          try {
            const s = JSON.parse(localStorage.getItem('lingua_settings') || '{}');
            if (!s.api_key || s.api_key.trim().length < 10) {
              return (
                <div onClick={() => setCurrentView('settings')} style={{
                  cursor: 'pointer', background: 'color-mix(in srgb, var(--error) 15%, transparent)',
                  border: '1px solid var(--error)', borderRadius: '12px', padding: '1rem 1.5rem',
                  marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem',
                  transition: 'var(--transition)'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 25%, transparent)'}
                onMouseOut={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'}
                >
                  <span style={{fontSize: '1.5rem'}}>🔑</span>
                  <div>
                    <strong style={{color: 'var(--text-main)', display: 'block'}}>No API Key set</strong>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Click here to go to Settings and add your Google Gemini API key to use the app.</span>
                  </div>
                  <span style={{marginLeft: 'auto', color: 'var(--text-muted)'}}>→</span>
                </div>
              );
            }
          } catch { return null; }
          return null;
        })()}
        
        <div className="feature-row">
           <div 
             className="card mode-card-speaking clickable slide-in stagger-1" 
             onClick={() => { markPracticed(); handleStartSpeaking(); }}
           >
             <div className="card-icon">🎙️</div>
             <h3>{t('speaking')}</h3>
           </div>
           
           <div 
             className="card mode-card-reading clickable slide-in stagger-2" 
             onClick={() => { markPracticed(); setCurrentView('reading'); }}
           >
             <div className="card-icon">📖</div>
             <h3>{t('reading')}</h3>
           </div>
           
           <div 
             className="card mode-card-writing clickable slide-in stagger-3" 
             onClick={() => { markPracticed(); setCurrentView('writing'); }}
           >
             <div className="card-icon">✍️</div>
             <h3>{t('writing')}</h3>
           </div>
        </div>
      </main>
      
      {/* Side Tab for Notebook */}
      <div 
        className="notebook-side-tab"
        onClick={() => setCurrentView('notebook')}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: '60px',
          background: 'color-mix(in srgb, var(--primary) 10%, var(--bg-secondary))',
          borderRight: '1px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'var(--transition)',
          zIndex: 40
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 20%, var(--bg-secondary))';
          e.currentTarget.style.width = '70px';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 10%, var(--bg-secondary))';
          e.currentTarget.style.width = '60px';
        }}
      >
        <div style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap', fontWeight: '800', letterSpacing: '6px', color: 'var(--primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>NOTEBOOK</span>
          <span style={{transform: 'rotate(90deg)'}}>📓</span>
        </div>
      </div>
    </div>
  );
}

export default Home;
