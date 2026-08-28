import { useState, useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { useGeminiLive } from './hooks/useGeminiLive'
import { translations } from './translations'
import Settings from './components/Settings'
import WritingMode from './components/WritingMode'
import ReadingMode from './components/ReadingMode'
import SpeakingMode from './components/SpeakingMode'
import NotebookMode from './components/NotebookMode'
import QuickChatWidget from './components/QuickChatWidget'
import Home from './components/Home'
import ProfileDrawer from './components/ProfileDrawer'

function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('lingua_settings');
      if (saved) {
         const parsed = JSON.parse(saved);
         if (parsed.language) {
             parsed.learnLanguage = parsed.language;
             delete parsed.language;
         }
         return { ...parsed, appLanguage: parsed.appLanguage || 'english', learnLanguage: parsed.learnLanguage || 'english' };
      }
      return { appLanguage: 'english', learnLanguage: 'english', level: 'b1', voice: 'Aoede', model: 'gemini-3.7-flash', api_key: '' };
    } catch {
      return { appLanguage: 'english', learnLanguage: 'english', level: 'b1', voice: 'Aoede', model: 'gemini-3.7-flash', api_key: '' };
    }
  });

  const t = (key) => translations[settings.appLanguage]?.[key] || translations['english'][key] || key;

  useEffect(() => {
    localStorage.setItem('lingua_settings', JSON.stringify(settings));
  }, [settings]);

  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('lingua_stats');
      let parsed = saved ? JSON.parse(saved) : {};
      if (typeof parsed.speaking === 'number') {
         // Migrate old flat stats
         return {
            [settings.learnLanguage || 'english']: {
               speaking: parsed.speaking || 0,
               writing: parsed.writing || 0,
               reading: parsed.reading || 0
            }
         };
      }
      return parsed;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('lingua_stats', JSON.stringify(stats));
  }, [stats]);

  const [savedNotes, setSavedNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('lingua_saved_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('lingua_saved_notes', JSON.stringify(savedNotes));
  }, [savedNotes]);

  const [notebooksData, setNotebooksData] = useState(() => {
    try {
      const saved = localStorage.getItem('lingua_notebooks_data');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('lingua_notebooks_data', JSON.stringify(notebooksData));
  }, [notebooksData]);

  const handleSaveNote = (note) => {
    const noteWithLang = { ...note, language: settings.learnLanguage, id: crypto.randomUUID() };
    setSavedNotes(prev => [noteWithLang, ...prev]);
  };

  const { isRecording, toggleConversation, notes, subtitles, isSpeaking, transcript } = useGeminiLive(settings);
  const [currentView, setCurrentView] = useState('home');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    const activeViews = ['writing', 'reading', 'live-session'];
    if (!isRecording && !activeViews.includes(currentView)) return;
    const interval = setInterval(() => {
       setStats(prev => {
          const lang = settings.learnLanguage || 'english';
          const langStats = prev[lang] || { speaking: 0, writing: 0, reading: 0 };
          const newStats = { ...langStats };
          if (isRecording) {
             newStats.speaking += 1;
          } else if (currentView === 'writing') {
             newStats.writing += 1;
          } else if (currentView === 'reading') {
             newStats.reading += 1;
          }
          return { ...prev, [lang]: newStats };
       });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, currentView, settings.learnLanguage]);

  const handleStartSpeaking = () => {
    setCurrentView('live-session');
  }

  const errorBanner = apiError && (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--error)', color: 'white', padding: '1rem 2rem', borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '1rem',
      maxWidth: '90%', width: '600px', lineHeight: '1.5'
    }}>
      <span>{apiError}</span>
      <button onClick={() => setApiError(null)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', marginLeft: 'auto'}}>✕</button>
    </div>
  );

  const profileProps = {
    isProfileOpen,
    setIsProfileOpen,
    stats,
    savedNotes,
    notebooksData,
    settings
  };

  const renderContent = () => {
    if (currentView === 'settings') {
      return <Settings settings={settings} setSettings={setSettings} t={t} setCurrentView={setCurrentView} errorBanner={errorBanner} />;
    }
    if (currentView === 'writing') {
      return <WritingMode settings={settings} t={t} setCurrentView={setCurrentView} setApiError={setApiError} errorBanner={errorBanner} profileProps={profileProps} handleSaveNote={handleSaveNote} />;
    }
    if (currentView === 'reading') {
      return <ReadingMode settings={settings} t={t} setCurrentView={setCurrentView} setApiError={setApiError} errorBanner={errorBanner} profileProps={profileProps} handleSaveNote={handleSaveNote} />;
    }
    if (currentView === 'live-session' || isRecording) {
      return <SpeakingMode settings={settings} setSettings={setSettings} t={t} setCurrentView={setCurrentView} isRecording={isRecording} toggleConversation={toggleConversation} notes={notes} handleSaveNote={handleSaveNote} subtitles={subtitles} isSpeaking={isSpeaking} transcript={transcript} errorBanner={errorBanner} profileProps={profileProps} />;
    }
    if (currentView === 'notebook') {
       return <NotebookMode settings={settings} t={t} setCurrentView={setCurrentView} savedNotes={savedNotes} setSavedNotes={setSavedNotes} notebooksData={notebooksData} setNotebooksData={setNotebooksData} errorBanner={errorBanner} />;
    }
    return <Home t={t} setCurrentView={setCurrentView} handleStartSpeaking={handleStartSpeaking} setIsProfileOpen={setIsProfileOpen} errorBanner={errorBanner} profileProps={profileProps} />;
  };

  const showWidget = !['settings', 'live-session'].includes(currentView) && !isRecording;

  return (
    <>
      {renderContent()}
      {showWidget && <QuickChatWidget settings={settings} />}
      <ProfileDrawer {...profileProps} t={t} />
      <Analytics />
    </>
  );
}

export default App
