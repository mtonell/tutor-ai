import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import ProfileDrawer from './ProfileDrawer';

function WritingMode({ settings, t, setCurrentView, setApiError, errorBanner, profileProps, handleSaveNote }) {
  const [writingText, setWritingText] = useState(() => localStorage.getItem('lingua_writing_draft') || '');
  const [draftRestored, setDraftRestored] = useState(() => !!localStorage.getItem('lingua_writing_draft'));
  const [writingFeedback, setWritingFeedback] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [localSavedNotes, setLocalSavedNotes] = useState(new Set());

  const submitWriting = async () => {
    setIsEvaluating(true);
    setApiError(null);
    setLocalSavedNotes(new Set());
    try {
       const wordCount = writingText.trim().split(/\s+/).length;
       const prompt = `You are an expert ${settings.learnLanguage} tutor. The user is currently at CEFR level ${settings.level} in ${settings.learnLanguage}. Their native language is ${settings.appLanguage}. They wrote the following text for practice (${wordCount} words): "${writingText}" 
       Evaluate their writing. Correct their grammar, spelling, and phrasing to sound more native, but keep it appropriate for their level. 
       IMPORTANT FOR CORRECTED_TEXT: You must use HTML tags to show exactly what you changed, like a teacher's red pen. 
       - Wrap any words you deleted or replaced from the user's text in <del> (e.g. <del>wrong word</del>)
       - Wrap any new words you added in <ins> (e.g. <ins>correct word</ins>)
       Provide all explanations in their native language (${settings.appLanguage}), but ensure the corrected_text is in ${settings.learnLanguage}.
       For "general_feedback", provide just a small feedback on the text overall.
       For "evaluation", estimate their CEFR level based on the text. If the text is less than 50 words, return an empty string "".
       For "notes", list ONLY errors and rules. Avoid general feedback and things they did well. These notes will be saved as flashcards.`;
       
       const responseSchema = {
           type: "OBJECT",
           properties: {
               corrected_text: { type: "STRING" },
               general_feedback: { type: "STRING" },
               evaluation: { type: "STRING" },
               notes: {
                   type: "ARRAY",
                   items: { type: "STRING" }
               }
           },
           required: ["corrected_text", "general_feedback", "evaluation", "notes"]
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
       const parsedData = JSON.parse(textOutput);
       setWritingFeedback(parsedData);
       localStorage.removeItem('lingua_writing_draft');
    } catch (e) {
       console.error("Error submitting writing:", e);
       setApiError(e.message || "Failed to connect to Google API.");
       setWritingFeedback({corrected_text: "There was an error processing your request.", feedback: [e.message]});
    }
    setIsEvaluating(false);
  }



  return (
    <div className="app-container session-mode">
      {errorBanner}
      <header className="header minimalist">
         <button className="end-btn" onClick={() => { setCurrentView('home'); setWritingFeedback(null); }}>
           {t('back')}
         </button>
      </header>
      
      <main className="writing-layout">
         <div className="writing-editor">
           <h2>{t('writing_title')}</h2>
           <p>{t('writing_desc')}</p>
            <textarea 
              className="writing-textarea"
              value={writingText} 
              onChange={(e) => {
                setWritingText(e.target.value);
                localStorage.setItem('lingua_writing_draft', e.target.value);
                if (draftRestored) setDraftRestored(false);
              }} 
              onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter' && writingText.trim() && !isEvaluating) submitWriting(); }}
              placeholder="... (Ctrl+Enter to submit)"
            ></textarea>
            {draftRestored && <p style={{fontSize:'0.8rem', color:'var(--text-muted)', margin:'0.25rem 0 0'}}>Draft restored</p>}
             <button 
               className="submit-writing-btn" 
               onClick={submitWriting} 
               disabled={isEvaluating || !writingText.trim()}
            >
               {isEvaluating ? t('evaluating') : t('submit')}
            </button>
          </div>
         
         {writingFeedback && (
           <div className="writing-feedback slide-in">
             <h3>{t('red_pen')}</h3>
             <div className="corrected-text-box">
                <p style={{margin:0, lineHeight: '1.8'}} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(writingFeedback.corrected_text, { ALLOWED_TAGS: ['del', 'ins'], ALLOWED_ATTR: [] }) }}></p>
             </div>

             <div style={{display: 'flex', gap: '1.5rem', marginTop: '1.5rem', flexWrap: 'wrap'}}>
                {writingFeedback.general_feedback && (
                   <div style={{flex: '1 1 300px', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px'}}>
                      <h4 style={{marginTop: 0, color: 'var(--primary)'}}>Feedback</h4>
                      <p style={{margin: 0, lineHeight: '1.5'}}>{writingFeedback.general_feedback}</p>
                   </div>
                )}
                {writingFeedback.evaluation && (
                   <div style={{flex: '1 1 200px', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px'}}>
                      <h4 style={{marginTop: 0, color: 'var(--primary)'}}>Evaluation</h4>
                      <div style={{fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0'}}>{writingFeedback.evaluation}</div>
                      <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)'}}>Estimated CEFR Level</p>
                   </div>
                )}
             </div>

             <div className="feedback-points" style={{marginTop: '2rem'}}>
               <h4 style={{marginTop: 0, color: 'var(--primary)', marginBottom: '1rem'}}>{t('tutor_notes')}</h4>
               {(!writingFeedback.notes || writingFeedback.notes.length === 0) ? (
                 <p style={{color: 'var(--text-muted)'}}>No specific grammar errors to note. Great job!</p>
               ) : (
                 <ul style={{listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                   {writingFeedback.notes.map((point, idx) => {
                      const isSaved = localSavedNotes.has(idx);
                      return (
                      <li key={idx} style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem'}}>
                         <span style={{lineHeight: '1.5', flex: 1}}>{point}</span>
                         <button 
                            onClick={() => {
                               if (!isSaved) {
                                  handleSaveNote({ title: 'Writing Rule', explanation: point, language: settings.learnLanguage, source: 'writing' });
                                  setLocalSavedNotes(prev => new Set([...prev, idx]));
                               }
                            }}
                            style={{
                               background: isSaved ? 'var(--primary)' : 'transparent',
                               color: isSaved ? 'white' : 'var(--primary)',
                               border: `1px solid var(--primary)`,
                               padding: '0.3rem 0.8rem',
                               borderRadius: '12px',
                               fontSize: '0.8rem',
                               cursor: isSaved ? 'default' : 'pointer',
                               transition: 'all 0.2s',
                               whiteSpace: 'nowrap'
                            }}
                         >
                            {isSaved ? 'Saved ✓' : 'Save'}
                         </button>
                      </li>
                   )})}
                 </ul>
               )}
             </div>
           </div>
         )}
      </main>
    </div>
  );
}

export default WritingMode;
