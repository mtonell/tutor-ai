import React, { useState } from 'react';



function ProfileDrawer({ isProfileOpen, setIsProfileOpen, stats, savedNotes, notebooksData, settings, t }) {
  const [selectedLang, setSelectedLang] = useState(null);

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const noteLangs = (savedNotes || []).map(n => n.language).filter(Boolean);
  const notebookLangs = Object.keys(notebooksData || {}).filter(lang => (notebooksData[lang] || '').length > 50);
  const statLangs = Object.keys(stats || {}).filter(k => typeof stats[k] === 'object');
  
  const allLangs = Array.from(new Set([...noteLangs, ...notebookLangs, ...statLangs])).filter(l => l && l.toLowerCase() !== 'all');

  let displayStats = { speaking: 0, writing: 0, reading: 0 };
  
  if (selectedLang && stats && stats[selectedLang]) {
    displayStats = stats[selectedLang];
  } else {
    if (stats && typeof stats.speaking === 'number') {
       displayStats.speaking = stats.speaking || 0;
       displayStats.writing = stats.writing || 0;
       displayStats.reading = stats.reading || 0;
    } else {
       Object.values(stats || {}).forEach(langStats => {
          if (langStats && typeof langStats === 'object') {
             displayStats.speaking += (langStats.speaking || 0);
             displayStats.writing += (langStats.writing || 0);
             displayStats.reading += (langStats.reading || 0);
          }
       });
    }
  }

  const totalTime = (displayStats.speaking || 0) + (displayStats.writing || 0) + (displayStats.reading || 0);

  return (
    <>
      {isProfileOpen && <div className="drawer-overlay" onClick={() => setIsProfileOpen(false)}></div>}
      <div className={`profile-drawer ${isProfileOpen ? 'open' : ''}`}>
        <div className="drawer-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
           <h2>{settings?.username ? settings.username : 'My Profile'}</h2>
           <button className="close-btn" onClick={() => setIsProfileOpen(false)}>✕</button>
        </div>
        
        <div className="drawer-content" style={{ paddingTop: '1rem' }}>
           {allLangs.length > 0 && (
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                {allLangs.map(lang => (
                   <button 
                      key={lang}
                      onClick={() => setSelectedLang(selectedLang === lang ? null : lang)}
                      style={{
                         background: selectedLang === lang ? 'var(--primary)' : 'var(--bg-secondary)',
                         color: selectedLang === lang ? 'white' : 'var(--text-main)',
                         border: `1px solid ${selectedLang === lang ? 'var(--primary)' : 'var(--border-light)'}`,
                         padding: '0.4rem 0.8rem',
                         borderRadius: '20px',
                         fontSize: '0.9rem',
                         fontWeight: 'bold',
                         textTransform: 'capitalize',
                         cursor: 'pointer',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '0.3rem',
                         transition: 'all 0.2s'
                      }}
                   >
                      {lang}
                   </button>
                ))}
             </div>
           )}

           <div className="stat-card">
              <div className="stat-label">{t('total_time')}</div>
              <div className="stat-value">{formatTime(totalTime)}</div>
           </div>
           
           <div className="stat-breakdown">
              <div className="stat-row">
                 <span>{t('speaking')}</span> 
                 <span>{formatTime(displayStats.speaking || 0)}</span>
              </div>
              <div className="stat-row">
                 <span>{t('writing')}</span> 
                 <span>{formatTime(displayStats.writing || 0)}</span>
              </div>
              <div className="stat-row">
                 <span>{t('reading')}</span> 
                 <span>{formatTime(displayStats.reading || 0)}</span>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}

export default ProfileDrawer;
