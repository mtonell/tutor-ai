import React, { useState, useEffect } from 'react';

function Settings({ settings, setSettings, t, setCurrentView, errorBanner }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [testingModel, setTestingModel] = useState(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelError, setModelError] = useState(null);

  useEffect(() => {
    if (!settings.api_key) return;
    let isMounted = true;
    const fetchModels = async () => {
      setIsFetchingModels(true);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${settings.api_key}`);
        if (res.ok && isMounted) {
           const data = await res.json();
           const validModels = data.models.filter(m => 
              m.supportedGenerationMethods?.includes('generateContent') || 
              m.supportedGenerationMethods?.includes('bidiGenerateContent')
           );
           setAvailableModels(validModels);
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
      if (isMounted) setIsFetchingModels(false);
    };
    fetchModels();
    return () => { isMounted = false; };
  }, [settings.api_key]);

  const handleModelSelect = async (modelName) => {
    if (testingModel) return;
    setTestingModel(modelName);
    try {
       const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${settings.api_key}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
       });
       if (res.ok || res.status === 429 || res.status === 503) {
          // Reachable or rate limited -> keep it and select it
          setSettings({...settings, model: modelName.replace('models/', '')});
       } else {
          // Unreachable -> remove it from the list
          setAvailableModels(prev => prev.filter(m => m.name !== modelName));
          setModelError(`Model ${modelName.replace('models/', '')} is not accessible with your current tier.`);
          setTimeout(() => setModelError(null), 3000);
       }
    } catch(e) {
       // Network error -> remove it
       setAvailableModels(prev => prev.filter(m => m.name !== modelName));
       setModelError(`Failed to reach ${modelName.replace('models/', '')}.`);
       setTimeout(() => setModelError(null), 3000);
    }
    setTestingModel(null);
  };

  return (
    <div className="app-container home-mode">
      {errorBanner}
      <header className="header top-nav">
        <div className="nav-links" style={{ marginLeft: 'auto' }}>
           <span onClick={() => setCurrentView('home')}>{t('home')}</span>
        </div>
      </header>

      <main className="settings-page">
        <h2>{t('settings')}</h2>
        <div className="settings-form">
          <div className="form-group">
            <label>Your Name</label>
            <input 
              type="text"
              placeholder="e.g. Marco"
              value={settings.username || ''} 
              onChange={(e) => setSettings({...settings, username: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Google Gemini API Key</label>
            <input 
              type="password"
              placeholder="AIzaSy..."
              value={settings.api_key || ''} 
              onChange={(e) => setSettings({...settings, api_key: e.target.value})}
            />
            <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem'}}>
              Stored locally. Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
            </p>
          </div>

          <div className="form-group">
            <label>{t('app_language')}</label>
            <select 
              value={settings.appLanguage} 
              onChange={(e) => setSettings({...settings, appLanguage: e.target.value})}
            >
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
              <option value="italian">Italian</option>
              <option value="japanese">Japanese</option>
              <option value="german">German</option>
              <option value="chinese">Chinese</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('learn_language')}</label>
            <select 
              value={settings.learnLanguage} 
              onChange={(e) => setSettings({...settings, learnLanguage: e.target.value})}
            >
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
              <option value="italian">Italian</option>
              <option value="japanese">Japanese</option>
              <option value="german">German</option>
              <option value="chinese">Chinese</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('level')}</label>
            <select 
              value={settings.level} 
              onChange={(e) => setSettings({...settings, level: e.target.value})}
            >
              <option value="a1">A1 (Beginner)</option>
              <option value="a2">A2 (Elementary)</option>
              <option value="b1">B1 (Intermediate)</option>
              <option value="b2">B2 (Upper Intermediate)</option>
              <option value="c1">C1 (Advanced)</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('voice')}</label>
            <select 
              value={settings.voice} 
              onChange={(e) => setSettings({...settings, voice: e.target.value})}
            >
              <option value="Aoede">Aoede — Warm female</option>
              <option value="Puck">Puck — Playful male</option>
              <option value="Charon">Charon — Deep male</option>
              <option value="Kore">Kore — Soft female</option>
              <option value="Fenrir">Fenrir — Strong male</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('model')}</label>
            {!settings.api_key ? (
               <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Enter an API key to view available models.</p>
            ) : isFetchingModels ? (
               <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Loading models...</p>
            ) : (
               <div style={{position: 'relative'}}>
                  <div 
                     onClick={() => !testingModel && setIsModelDropdownOpen(!isModelDropdownOpen)}
                     style={{
                        padding: '0.8rem', border: '1px solid var(--border-light)', borderRadius: '8px', 
                        background: 'var(--bg-secondary)', cursor: testingModel ? 'wait' : 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                     }}
                  >
                     <span>{settings.model}</span>
                     <span>{isModelDropdownOpen ? '▲' : '▼'}</span>
                  </div>
                  {testingModel && <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0'}}>Testing access to {testingModel.replace('models/', '')}...</p>}
                  {modelError && <p style={{fontSize: '0.8rem', color: 'var(--error)', margin: '0.5rem 0 0'}}>{modelError}</p>}
                  
                  {isModelDropdownOpen && (
                     <div style={{
                        position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                        maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)', borderRadius: '8px', zIndex: 10,
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.5)'
                     }}>
                        <div style={{
                           display: 'flex', 
                           justifyContent: 'space-between', 
                           padding: '0.5rem 0.8rem', 
                           borderBottom: '1px solid var(--border-light)', 
                           background: 'rgba(0,0,0,0.2)', 
                           fontSize: '0.75rem', 
                           textTransform: 'uppercase', 
                           color: 'var(--text-muted)',
                           fontWeight: 'bold',
                           position: 'sticky',
                           top: 0,
                           zIndex: 1
                        }}>
                           <div style={{flex: 1}}>Model Name</div>
                           <div style={{width: '50px', textAlign: 'center'}}>Cost</div>
                           <div style={{width: '70px', textAlign: 'right'}}>Speed</div>
                        </div>

                        {availableModels
                           .filter(m => {
                              const name = m.name.toLowerCase();
                              return !name.includes('nano') && 
                                     !name.includes('banana') && 
                                     !name.includes('robotic') && 
                                     !name.includes('lyria') && 
                                     !name.includes('deep-research') && 
                                     !name.includes('antigravity');
                           })
                           .sort((a, b) => b.name.localeCompare(a.name))
                           .map(model => {
                              let cost = '$$';
                              let speed = '🍃🍃';
                              
                              if (model.name.includes('pro')) {
                                 cost = '$$$';
                                 speed = '🍃';
                              } else if (model.name.includes('lite') || model.name.includes('8b')) {
                                 cost = '$';
                                 speed = '🍃🍃🍃';
                              }

                              return (
                                 <div 
                                    key={model.name} 
                                    onClick={() => {
                                       setIsModelDropdownOpen(false);
                                       handleModelSelect(model.name);
                                    }}
                                    style={{
                                       padding: '0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                 >
                                    <div style={{flex: 1}}>{model.displayName || model.name.replace('models/', '')}</div>
                                    <div style={{width: '50px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)'}}>{cost}</div>
                                    <div style={{width: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)'}}>{speed}</div>
                                 </div>
                              );
                        })}
                     </div>
                  )}
                  {testingModel && <p style={{fontSize: '0.85rem', color: 'var(--accent-teal)', marginTop: '0.5rem'}}>Testing reachability...</p>}
               </div>
            )}
          </div>
          <button className="save-btn" onClick={() => setCurrentView('home')}>{t('save_settings')}</button>
        </div>
      </main>
    </div>
  );
}

export default Settings;
