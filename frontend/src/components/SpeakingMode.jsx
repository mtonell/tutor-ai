import React, { useState, useEffect, useRef } from 'react';
import TutorOrb from './TutorOrb';
import ProfileDrawer from './ProfileDrawer';

function SpeakingMode({ settings, setSettings, t, setCurrentView, isRecording, toggleConversation, notes, handleSaveNote, subtitles, isSpeaking, transcript, errorBanner, profileProps }) {
  const [localSavedNotes, setLocalSavedNotes] = useState(new Set());
  const transcriptEndRef = useRef(null);

  useEffect(() => {
     transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const handleStopSpeaking = () => {
    if (isRecording) toggleConversation();
    setCurrentView('home');
  }

  return (
    <div className="app-container session-mode">
      {errorBanner}
      <header className="header minimalist" style={{ justifyContent: 'space-between' }}>
         <button className="end-btn" onClick={handleStopSpeaking}>
           {isRecording ? t('end_session') : t('back')}
         </button>
         <select 
            className="live-level-select"
            value={settings.level}
            onChange={(e) => {
               const newLevel = e.target.value;
               setSettings({...settings, level: newLevel});
               if (isRecording) {
                  toggleConversation({...settings, level: newLevel});
                  setTimeout(() => toggleConversation({...settings, level: newLevel}), 100);
               }
            }}
            style={{
              background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-light)',
              padding: '0.5rem 1rem', borderRadius: '50px', fontSize: '0.9rem', outline: 'none'
            }}
         >
            <option value="a1">A1</option>
            <option value="a2">A2</option>
            <option value="b1">B1</option>
            <option value="b2">B2</option>
            <option value="c1">C1</option>
         </select>
      </header>
      
      <main className="session-content">
         <div className="orb-wrapper" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
           <TutorOrb isRecording={isRecording} isSpeaking={isSpeaking} onToggle={() => toggleConversation()} />
           
           {subtitles && (
             <div className="subtitles-container">
               <p>{subtitles}</p>
             </div>
           )}
         </div>

         {transcript && transcript.length > 0 && (
            <div style={{
               maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-secondary)', 
               padding: '1rem', borderRadius: '12px', marginTop: '1rem', width: '100%', maxWidth: '600px'
            }}>
               {transcript.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '0.8rem', textAlign: 'left' }}>
                     <strong style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>AI Tutor</strong>
                     <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{msg.text}</p>
                  </div>
               ))}
               <div ref={transcriptEndRef} />
            </div>
         )}
         
         <div className="notes-toast-container">
           <h3>Live Notes</h3>
           {notes.length === 0 ? (
              <p style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>{t('no_live_notes')}</p>
           ) : (
              <div className="notes-list">
                {notes.map((note, idx) => {
                  const isSaved = localSavedNotes.has(idx);
                  return (
                  <div key={idx} className="note-card slide-in">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                       <h4>{note.title}</h4>
                       <button 
                          onClick={() => {
                             if (!isSaved) {
                                handleSaveNote({...note, source: 'speaking'});
                                setLocalSavedNotes(prev => new Set([...prev, idx]));
                             }
                          }}
                          style={{
                             background: isSaved ? 'var(--primary)' : 'transparent',
                             color: isSaved ? 'white' : 'var(--primary)',
                             border: `1px solid var(--primary)`,
                             padding: '0.2rem 0.6rem',
                             borderRadius: '12px',
                             fontSize: '0.75rem',
                             cursor: isSaved ? 'default' : 'pointer',
                             transition: 'all 0.2s'
                          }}
                       >
                          {isSaved ? 'Saved ✓' : 'Save'}
                       </button>
                    </div>
                    <p>{note.explanation}</p>
                  </div>
                )})}
              </div>
           )}
         </div>
      </main>
    </div>
  );
}

export default SpeakingMode;
