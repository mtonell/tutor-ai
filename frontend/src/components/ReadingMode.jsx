import React, { useState, useRef, useEffect } from 'react';
import ProfileDrawer from './ProfileDrawer';

function ReadingMode({ settings, t, setCurrentView, setApiError, errorBanner, profileProps, handleSaveNote }) {
  const [readingTopic, setReadingTopic] = useState("");
  const [readingLength, setReadingLength] = useState("short"); // 'short', 'mid', 'long'
  const [readingData, setReadingData] = useState(null);
  const [readingAnswers, setReadingAnswers] = useState({});
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [allowTranslation, setAllowTranslation] = useState(true);
  const [translationLang, setTranslationLang] = useState(settings.appLanguage !== settings.learnLanguage ? settings.appLanguage : "");
  const [translationCache, setTranslationCache] = useState({});
  const [activeTranslation, setActiveTranslation] = useState(null);
  const [localSavedWords, setLocalSavedWords] = useState(new Set());
  const [storyHistory, setStoryHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('lingua_stories') || '[]'); } catch { return []; } });
  const [showHistory, setShowHistory] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => { if (readingSubmitted) { setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); } }, [readingSubmitted]);

  const resetReading = () => {
    setReadingData(null);
    setReadingAnswers({});
    setReadingSubmitted(false);
    setReadingTopic("");
    setReadingLength("short");
    setApiError(null);
    setActiveTranslation(null);
    setLocalSavedWords(new Set());
  }

  const handleWordClick = async (word, event) => {
    if (!allowTranslation || !translationLang) return;
    
    const wordLower = word.toLowerCase();
    
    // Position popover fixed to the mouse pointer
    const popoverPosition = {
        top: event.clientY - 40,
        left: event.clientX
    };

    if (translationCache[wordLower]) {
        setActiveTranslation({ word, translation: translationCache[wordLower], loading: false, pos: popoverPosition });
        return;
    }

    setActiveTranslation({ word, translation: null, loading: true, pos: popoverPosition });

    try {
        const selectedModel = settings.model || 'gemini-3.7-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.api_key}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Translate the word "${word}" from ${settings.learnLanguage} to ${translationLang}. Return ONLY the translated word in lowercase, nothing else. No punctuation.` }] }]
            })
        });
        const data = await res.json();
        const translation = data.candidates[0].content.parts[0].text.trim().toLowerCase();
        
        setTranslationCache(prev => ({...prev, [wordLower]: translation}));
        setActiveTranslation({ word, translation, loading: false, pos: popoverPosition });
    } catch (err) {
        setActiveTranslation({ word, translation: "Error", loading: false, pos: popoverPosition });
    }
  };

  const renderClickableText = (text) => {
    const parts = text.split(/([\s.,!?;:"'()-]+)/g);
    return parts.map((part, index) => {
      if (/^[\s.,!?;:"'()-]+$/.test(part) || part === '') {
        return <span key={index}>{part}</span>;
      }
      return (
        <span 
          key={index} 
          className="clickable-word" 
          onClick={(e) => handleWordClick(part, e)}
        >
          {part}
        </span>
      );
    });
  };

  const generateReading = async () => {
    setIsGeneratingReading(true);
    setReadingData(null);
    setReadingAnswers({});
    setReadingSubmitted(false);
    setApiError(null);
    try {
       const topicText = readingTopic.trim() ? `about ${readingTopic}` : "about a random interesting topic";
       let wordCount = 100;
       if (readingLength === 'mid') wordCount = 250;
       if (readingLength === 'long') wordCount = 500;

       const prompt = `You are an expert ${settings.learnLanguage} tutor. The user is at CEFR level ${settings.level}. Write a short, engaging text (about ${wordCount} words) ${topicText} in ${settings.learnLanguage}. Then, generate 3 multiple-choice comprehension questions in ${settings.learnLanguage}. Provide explanations for the correct answers in ${settings.appLanguage}. 
       Return ONLY a valid JSON object with exactly this structure:
       {
          "text": "The story text here...",
          "questions": [
             {
                "question": "Question text in learnLanguage",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer_index": 0,
                "explanation": "Explanation in appLanguage why option A is correct"
             }
          ]
       }`;
       const responseSchema = {
           type: "OBJECT",
           properties: {
               text: { type: "STRING" },
               questions: {
                   type: "ARRAY",
                   items: {
                       type: "OBJECT",
                       properties: {
                           question: { type: "STRING" },
                           options: { type: "ARRAY", items: { type: "STRING" } },
                           correct_answer_index: { type: "INTEGER" },
                           explanation: { type: "STRING" }
                       },
                       required: ["question", "options", "correct_answer_index", "explanation"]
                   }
               }
           },
           required: ["text", "questions"]
       };

       const selectedModel = settings.model || 'gemini-3.7-flash';
       let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.api_key}`, {
           method: 'POST',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({
               contents: [{ parts: [{ text: prompt }] }],
               generationConfig: { responseMimeType: "application/json", responseSchema }
           })
       });
       
       if (res.status === 503 || res.status === 429) {
           console.log("High demand on 3.7-flash. Falling back to 3.5-flash-lite...");
           res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${settings.api_key}`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({
                   contents: [{ parts: [{ text: prompt }] }],
                   generationConfig: { responseMimeType: "application/json", responseSchema }
               })
           });
       }
       
       const responseData = await res.json();
       if (!res.ok) {
           throw new Error(responseData.error?.message || "Failed to call Gemini API");
       }
       
       const textOutput = responseData.candidates[0].content.parts[0].text;
       
       // Because we are using strict responseSchema and application/json, 
       // textOutput is guaranteed to be a pure JSON string.
       const parsedData = JSON.parse(textOutput);
       setReadingData(parsedData);
       const newEntry = { id: Date.now(), topic: readingTopic || 'No topic', title: readingTopic || 'Story', text: parsedData.text, date: new Date().toLocaleDateString() };
       const updated = [newEntry, ...storyHistory].slice(0, 20);
       setStoryHistory(updated);
       localStorage.setItem('lingua_stories', JSON.stringify(updated));
    } catch (e) {
       console.error("Error generating reading:", e);
       setApiError("Error generating reading. Please check your API key, or wait if there is high demand for the Google service. Details: " + e.message);
    }
    setIsGeneratingReading(false);
  }

  return (
    <div className="app-container session-mode">
      {errorBanner}
      <header className="header minimalist">
         <button className="end-btn" onClick={() => { setCurrentView('home'); resetReading(); }}>
           {t('back')}
         </button>
         {readingData && (
           <button
             className="end-btn"
             style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
             onClick={resetReading}
           >
             {t('create_new_story')}
           </button>
         )}
      </header>
      
      <main 
         style={{ flex: 1, padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
         onClick={(e) => {
            if (!e.target.classList.contains('clickable-word') && !e.target.closest('.translation-popover')) {
               setActiveTranslation(null);
            }
         }}
      >
         {/* Translation Popover - solid black box */}
         {activeTranslation && (
            <div className="translation-popover slide-in" style={{
               position: 'fixed',
               top: activeTranslation.pos.top,
               left: activeTranslation.pos.left,
               transform: 'translate(-50%, -100%)',
               background: '#000',
               border: '1px solid rgba(255,255,255,0.15)',
               padding: '0.7rem 1rem',
               borderRadius: '10px',
               boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
               zIndex: 50,
               display: 'flex',
               alignItems: 'center',
               gap: '1rem',
               minWidth: '140px'
            }}>
               <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                 <span style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px'}}>{activeTranslation.word}</span>
                 <span style={{fontSize: '1.1rem', fontWeight: 'bold', color: 'white'}}>
                   {activeTranslation.loading ? '...' : activeTranslation.translation}
                 </span>
               </div>
               {!activeTranslation.loading && (
                 <button 
                    onClick={() => {
                       const wordLower = activeTranslation.word.toLowerCase();
                       if (!localSavedWords.has(wordLower)) {
                          handleSaveNote({
                             title: 'Vocabulary Word',
                             explanation: `${activeTranslation.word} = ${activeTranslation.translation}`,
                             language: settings.learnLanguage,
                             source: 'reading'
                          });
                          setLocalSavedWords(prev => new Set([...prev, wordLower]));
                       }
                    }}
                    style={{
                       background: 'transparent',
                       color: localSavedWords.has(activeTranslation.word.toLowerCase()) ? '#22c55e' : 'rgba(255,255,255,0.6)',
                       border: `1px solid ${localSavedWords.has(activeTranslation.word.toLowerCase()) ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                       padding: '0.25rem 0.6rem',
                       borderRadius: '6px',
                       fontSize: '0.75rem',
                       cursor: localSavedWords.has(activeTranslation.word.toLowerCase()) ? 'default' : 'pointer',
                       whiteSpace: 'nowrap',
                       fontWeight: 'bold',
                       transition: 'all 0.2s'
                    }}
                 >
                    {localSavedWords.has(activeTranslation.word.toLowerCase()) ? 'Saved ✓' : 'Save'}
                 </button>
               )}
            </div>
         )}

         {!readingData && (
           <div className="writing-editor" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
             <h2>{t('reading_title')}</h2>
             <p>{t('reading_desc')}</p>
             
             <div className="settings-form" style={{marginTop: '2rem'}}>
               <div className="form-group" style={{textAlign: 'left'}}>
                  <label>Topic</label>
                  <input 
                    type="text" 
                    placeholder={t('topic_placeholder')} 
                    value={readingTopic}
                    onChange={(e) => setReadingTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isGeneratingReading) generateReading(); }}
                  />
               </div>
               
               <div className="form-group" style={{textAlign: 'left'}}>
                  <label>{t('story_length')}</label>
                  <select 
                     value={readingLength}
                     onChange={(e) => setReadingLength(e.target.value)}
                  >
                     <option value="short">{t('short')}</option>
                     <option value="mid">{t('mid')}</option>
                     <option value="long">{t('long')}</option>
                  </select>
               </div>

               <button 
                 className="submit-writing-btn" 
                 onClick={generateReading} 
                 disabled={isGeneratingReading}
               >
                 {isGeneratingReading ? t('generating') : t('generate_story')}
               </button>
             </div>
           </div>
         )}

          {!readingData && storyHistory.length > 0 && (
            <div className="writing-editor" style={{ maxWidth: '600px', margin: '1.5rem auto 0', textAlign: 'center' }}>
              <button
                className="end-btn"
                style={{ marginBottom: '1rem', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.95rem' }}
                onClick={() => setShowHistory(h => !h)}
              >
                📚 Previous Stories ({storyHistory.length})
              </button>
              {showHistory && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                  {storyHistory.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => { setReadingData({ text: entry.text, title: entry.title, questions: [] }); setShowHistory(false); }}
                      style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{entry.date}</div>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{entry.title}</div>
                      {entry.topic !== entry.title && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{entry.topic}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

         {readingData && (
            <div className="reading-split-layout slide-in">
               {/* LEFT SIDE: STORY */}
               <div style={{ flex: '1 1 500px' }}>
                 <div className="story-box" style={{position: 'relative'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                          <input type="checkbox" checked={allowTranslation} onChange={(e) => setAllowTranslation(e.target.checked)} />
                          Tap to Translate
                       </label>
                       
                       {allowTranslation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                             <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>To:</span>
                             <select 
                                value={translationLang} 
                                onChange={(e) => setTranslationLang(e.target.value)}
                                style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-light)', fontSize: '0.85rem', outline: 'none' }}
                             >
                                <option value="" disabled>Select Language</option>
                                <option value="english">English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="italian">Italian</option>
                                <option value="japanese">Japanese</option>
                                <option value="german">German</option>
                                <option value="chinese">Chinese</option>
                             </select>
                          </div>
                       )}
                    </div>
                    <p style={{whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.8'}}>
                       {renderClickableText(readingData.text)}
                    </p>
                 </div>
               </div>
               
               {/* RIGHT SIDE: QUIZ */}
               <div ref={resultsRef} className="quiz-container" style={{ flex: '1 1 500px' }}>
                  {readingData.questions.map((q, qIdx) => (
                     <div key={qIdx} className="quiz-card">
                        <h4>{q.question}</h4>
                        <div className="quiz-options">
                           {q.options.map((opt, optIdx) => {
                              let btnClass = "quiz-btn";
                              
                              if (readingSubmitted) {
                                 if (optIdx === q.correct_answer_index) {
                                    btnClass += " correct";
                                 } else if (readingAnswers[qIdx] === optIdx) {
                                    btnClass += " incorrect";
                                 }
                              } else if (readingAnswers[qIdx] === optIdx) {
                                 btnClass += " selected";
                              }

                              return (
                                <button 
                                  key={optIdx}
                                  className={btnClass}
                                  onClick={() => !readingSubmitted && setReadingAnswers({...readingAnswers, [qIdx]: optIdx})}
                                  disabled={readingSubmitted}
                                >
                                  {opt}
                                </button>
                              )
                           })}
                        </div>
                        {readingSubmitted && (
                           <div className="quiz-explanation">
                              <strong style={{color: readingAnswers[qIdx] === q.correct_answer_index ? 'var(--success)' : 'var(--error)'}}>
                                 {readingAnswers[qIdx] === q.correct_answer_index ? t('correct') : t('incorrect')}
                              </strong>
                              <p style={{marginTop: '0.5rem', marginBottom: 0}}>
                                 <strong>{t('explanation')}</strong> {q.explanation}
                              </p>
                           </div>
                        )}
                     </div>
                  ))}
               
                  {!readingSubmitted && Object.keys(readingAnswers).length === readingData.questions.length && (
                     <button 
                        className="submit-writing-btn" 
                        onClick={() => setReadingSubmitted(true)}
                     >
                        {t('check_answers')}
                     </button>
                  )}
               </div>
            </div>
         )}
      </main>
    </div>
  );
}

export default ReadingMode;
