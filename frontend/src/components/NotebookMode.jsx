import React, { useState } from 'react';
import ProfileDrawer from './ProfileDrawer';

function NotebookMode({ settings, t, setCurrentView, savedNotes, setSavedNotes, notebooksData, setNotebooksData, errorBanner }) {
  const [activeLanguage, setActiveLanguage] = useState(settings.learnLanguage || 'all');
  const [isProcessing, setIsProcessing] = useState(null);
  
  // Edit & Render Mode
  const [isEditing, setIsEditing] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Reorganize Modal
  const [isReorgModalOpen, setIsReorgModalOpen] = useState(false);
  const [reorgInstructions, setReorgInstructions] = useState('');
  const [reorgSections, setReorgSections] = useState('Grammar Rules, Verbs, Speaking Rules, Vocabulary');
  const [isReorganizing, setIsReorganizing] = useState(false);

  const textareaRef = React.useRef(null);

  const notesByLanguage = (savedNotes || []).reduce((acc, note) => {
    const lang = note.language || 'General';
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(note);
    return acc;
  }, {});

  const languages = Object.keys(notesByLanguage);

  // Force activeLanguage to be valid. 
  // If the user's learnLanguage has no notes yet, it is still the default. 
  // If they have notes in other languages, we ensure they are in the dropdown.
  const currentLang = activeLanguage === 'all' ? (settings.learnLanguage || 'english') : activeLanguage;
  
  // Create a unique set of languages: notes languages + currentLang
  const availableLanguages = Array.from(new Set([...languages, currentLang]));
  const activeNotes = notesByLanguage[currentLang] || [];

  const [isInboxOpen, setIsInboxOpen] = useState(activeNotes.length > 0);
  const [expandedNoteId, setExpandedNoteId] = useState(null);

  const handleDelete = (id) => {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
  };

  const initialStructure = `## Grammar\n\n## Spelling\n\n## Vocabulary\n`;
  const currentNotebookText = (notebooksData[currentLang] || initialStructure);

  const rawChapters = currentNotebookText.split(/(?=^##\s+)/m).filter(p => p.trim() !== '');
  
  const chapterData = rawChapters.map(chap => {
      const match = chap.match(/^##\s+(.*)/);
      const title = match ? match[1] : 'Introduction';
      return { title, content: chap };
  });

  const safeChapterIndex = activeChapterIndex >= chapterData.length ? Math.max(0, chapterData.length - 1) : activeChapterIndex;
  const currentChapter = chapterData[safeChapterIndex] || { title: 'Empty', content: '' };

  const updateNotebookText = (newText) => {
    setNotebooksData(prev => ({ ...prev, [currentLang]: newText }));
  };

  const handleChapterEdit = (e) => {
      const newChapters = [...rawChapters];
      newChapters[safeChapterIndex] = e.target.value;
      updateNotebookText(newChapters.join(''));
  };

  const handleAddToNotebook = async (note) => {
     if (isProcessing) return;
     setIsProcessing(note.id);
     try {
        const prompt = `You are a meticulous AI secretary managing a student's language notebook. The student is learning ${currentLang}.
Here is their current notebook (in plain text markdown):

${currentNotebookText}

Here is a new raw note they want to add:
Title: ${note.title}
Explanation: ${note.explanation}
Source context: ${note.source}

Your task:
1. Find the correct category for this note in the notebook (Grammar Rules, Verbs, Speaking Rules, or Vocabulary).
2. Insert the note clearly under that header. If it's vocabulary, strictly use 'word = translation' format. 
3. If there is already a very similar note in that category, gracefully merge them instead of duplicating.
4. CRITICAL: You MUST output the ENTIRE notebook text including all existing sections, headers, and previous notes. Do not omit or summarize any existing information!
5. Return ONLY the fully updated notebook markdown text. Do not wrap your response in \`\`\`markdown or \`\`\` blocks, just return the raw text.`;

        const selectedModel = settings.model || 'gemini-3.7-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.api_key}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await res.json();
        let newText = data.candidates[0].content.parts[0].text.trim();
        
        // Safely strip any markdown code block wrappers the model might still add
        if (newText.startsWith('```')) {
            const lines = newText.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            newText = lines.join('\n').trim();
        }

        updateNotebookText(newText);
        handleDelete(note.id);
     } catch (err) {
        console.error("Failed to add note to notebook", err);
        alert("Failed to add note to notebook. Please try again.");
     }
     setIsProcessing(null);
  };

  const handleReorganize = async () => {
     if (isReorganizing) return;
     setIsReorganizing(true);
     try {
        const prompt = `You are a meticulous AI secretary. Reorganize this language notebook for a student learning ${currentLang}.
Clean up the formatting, fix any duplicate entries, and alphabetize the vocabulary.

USER REFACORING INSTRUCTIONS:
${reorgInstructions || 'Just clean up and organize the notes efficiently.'}

SECTIONS TO USE:
Ensure the structure EXACTLY follows these headers (create them if missing, remove others if requested in instructions):
${reorgSections.split(',').map(s => `## ${s.trim()}`).join('\n')}

Here is the current notebook:
${currentNotebookText}

CRITICAL: You MUST output the ENTIRE notebook text including all existing sections and content. Do not omit any existing information that isn't a duplicate.
Return ONLY the fully updated notebook markdown text. Do not wrap your response in \`\`\`markdown or \`\`\` blocks, just return the raw text.`;

        const selectedModel = settings.model || 'gemini-3.7-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${settings.api_key}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await res.json();
        let newText = data.candidates[0].content.parts[0].text.trim();
        
        // Safely strip any markdown code block wrappers the model might still add
        if (newText.startsWith('```')) {
            const lines = newText.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            newText = lines.join('\n').trim();
        }

        updateNotebookText(newText);
        setIsReorgModalOpen(false);
     } catch (err) {
        console.error("Failed to reorganize notebook", err);
        alert("Failed to reorganize notebook. Please try again.");
     }
     setIsReorganizing(false);
  };

  const handleExport = () => {
    const content = currentNotebookText;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notebook-${currentLang}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMarkdown = (text) => {
      return text.split('\n').map((line, i) => {
          if (line.startsWith('## ')) return <h2 key={i} id={line.substring(3).trim()} style={{color: 'var(--primary)', marginTop: i === 0 ? '0' : '2.5rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-light)', paddingBottom: '0.5rem'}}>{line.substring(3)}</h2>;
          if (line.startsWith('# ')) return <h1 key={i} style={{marginBottom: '1rem'}}>{line.substring(2)}</h1>;
          if (line.trim() === '') return <br key={i} />;
          
          // Bold rendering trick
          if (line.includes('**')) {
              const parts = line.split('**');
              return (
                 <div key={i} style={{lineHeight: '1.7', marginBottom: '0.5rem', color: 'var(--text-main)'}}>
                    {parts.map((part, j) => j % 2 === 1 ? <strong key={j} style={{color: 'white'}}>{part}</strong> : part)}
                 </div>
              );
          }
          return <div key={i} style={{lineHeight: '1.7', marginBottom: '0.5rem', color: 'var(--text-secondary)'}}>{line}</div>;
      });
  };

  const sourceConfig = {
     reading: { color: 'var(--mode-reading)' },
     writing: { color: 'var(--mode-writing)' },
     speaking: { color: 'var(--mode-speaking)' },
     other: { color: 'var(--primary)' }
  };

  return (
    <div className="app-container session-mode slide-in-left" style={{background: 'var(--bg-main)'}}>
      {errorBanner}
      <header className="header minimalist" style={{ justifyContent: 'flex-end' }}>
         <button className="end-btn" onClick={() => setCurrentView('home')}>
           {t('back')}
         </button>
      </header>
      
      {/* FIXED LEFT SIDEBAR - Inbox */}
      {!isInboxOpen ? (
         <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '40px', background: 'var(--bg-primary)', borderRight: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, transition: 'var(--transition)', boxShadow: '2px 0 10px rgba(0,0,0,0.2)' }}>
            <button 
               onClick={() => setIsInboxOpen(true)}
               style={{
                  background: 'transparent', border: 'none', color: activeNotes.length > 0 ? 'var(--text-main)' : 'var(--text-muted)', 
                  cursor: 'pointer',
                  fontSize: '1rem', fontWeight: 'bold', letterSpacing: '6px', textTransform: 'uppercase',
                  transform: 'rotate(-90deg)', whiteSpace: 'nowrap', transition: 'var(--transition)'
               }}
               onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.5)'}
               onMouseOut={e => e.currentTarget.style.filter = 'none'}
            >
               NOTES ({activeNotes.length})
            </button>
         </div>
      ) : (
         <div className="slide-in-left" style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '380px', background: 'var(--bg-primary)', borderRight: '1px solid var(--border-light)', padding: '2rem 1.5rem', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '10px 0 40px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h3 style={{ margin: 0, color: 'var(--text-main)', textTransform: 'uppercase', fontSize: '1rem', letterSpacing: '1px'}}>Raw Notes Inbox</h3>
               <button onClick={() => setIsInboxOpen(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem 0.8rem', fontWeight: 'bold' }}>{'<'}</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
               {(!activeNotes || activeNotes.length === 0) ? (
                  <div style={{textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)'}}>
                     <p>Inbox is empty.</p>
                  </div>
               ) : (
                  activeNotes.map((note, idx) => {
                     const sColor = sourceConfig[note.source]?.color || sourceConfig.other.color;
                     const isAdding = isProcessing === note.id;
                     const isExpanded = expandedNoteId === note.id;
                     return (
                        <div 
                           key={note.id} 
                           className={`slide-in stagger-${(idx % 5) + 1}`} 
                           onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                           style={{
                              background: 'var(--bg-secondary)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid var(--border-light)',
                              borderLeft: `4px solid ${sColor}`, position: 'relative', opacity: isAdding ? 0.5 : 1,
                              display: 'flex', flexDirection: 'column', gap: '0.6rem', cursor: 'pointer', transition: 'var(--transition)'
                           }}
                        >
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{fontSize: '0.7rem', textTransform: 'uppercase', color: sColor, fontWeight: 'bold', letterSpacing: '1px'}}>
                                 {note.source || 'other'}
                              </span>
                              
                              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                                    style={{
                                       background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', 
                                       color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Delete Note"
                                 >
                                    🗑️
                                 </button>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddToNotebook(note); }}
                                    disabled={isAdding}
                                    style={{
                                       width: '24px', height: '24px', minWidth: '24px', borderRadius: '50%', background: 'color-mix(in srgb, var(--primary) 20%, transparent)', 
                                       border: `1px solid var(--primary)`, color: 'var(--primary)', 
                                       display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isAdding ? 'not-allowed' : 'pointer', transition: 'var(--transition)'
                                    }}
                                    onMouseOver={(e) => { if(!isAdding) { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; } }}
                                    onMouseOut={(e) => { if(!isAdding) { e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 20%, transparent)'; e.currentTarget.style.color = 'var(--primary)'; } }}
                                    title="Add to Notebook"
                                 >
                                    {isAdding ? '⏳' : '+'}
                                 </button>
                              </div>
                           </div>
                           
                           <p style={{ 
                              margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', 
                              whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap', 
                              overflow: 'hidden', textOverflow: 'ellipsis', 
                              lineHeight: '1.4'
                           }}>
                              {note.explanation || note.text || note.title || "Empty note"}
                           </p>
                        </div>
                     );
                  })
               )}
            </div>
         </div>
      )}

      <main style={{ flex: 1, padding: '2rem 2rem 2rem 5rem', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
         
         {/* MAIN NOTEBOOK CONTENT */}
         <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h1 style={{ fontSize: '2rem', margin: 0, background: 'linear-gradient(135deg, #fff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {currentLang === 'all' ? 'Global' : currentLang.charAt(0).toUpperCase() + currentLang.slice(1)} Notebook
               </h1>
               <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                     onClick={() => setIsEditing(!isEditing)}
                     style={{
                        background: isEditing ? 'var(--primary)' : 'var(--bg-elevated)', color: isEditing ? 'white' : 'var(--text-main)', border: `1px solid ${isEditing ? 'var(--primary)' : 'var(--border-light)'}`,
                        padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'var(--transition)'
                     }}
                  >
                     {isEditing ? 'View Mode' : 'Edit'}
                  </button>
                   <button 
                      onClick={() => setIsReorgModalOpen(true)}
                      style={{
                         background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-light)',
                         padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                         display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'var(--transition)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                   >
                      <span>✨</span> Reorganize
                   </button>
                   <button onClick={handleExport} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>⬇ Export</button>
                   <button 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to clear this entire notebook? This cannot be undone.')) {
                          setNotebooksData(prev => ({ ...prev, [currentLang]: '' }));
                          setIsEditing(false);
                        }
                      }}
                      style={{
                         background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-light)',
                         padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                         display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'var(--transition)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'; e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                   >
                      🗑️ Clear
                   </button>
                </div>
            </div>

            {/* Chapter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
               {chapterData.slice(0, 8).map((chap, i) => (
                  <button
                     key={i}
                     onClick={() => setActiveChapterIndex(i)}
                     style={{
                        padding: '0.6rem 1.2rem', background: safeChapterIndex === i ? 'var(--primary)' : 'transparent',
                        color: safeChapterIndex === i ? 'white' : 'var(--text-secondary)',
                        border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 'bold',
                        whiteSpace: 'nowrap', transition: 'var(--transition)'
                     }}
                     onMouseOver={e => { if (safeChapterIndex !== i) e.currentTarget.style.color = 'var(--text-main)'; }}
                     onMouseOut={e => { if (safeChapterIndex !== i) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                     {chap.title}
                  </button>
               ))}
            </div>
            
            {isEditing ? (
               <textarea
                  value={currentChapter.content}
                  onChange={handleChapterEdit}
                  spellCheck="false"
                  style={{
                     flex: 1, width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-main)',
                     padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-light)',
                     fontSize: '1.05rem', lineHeight: '1.7', fontFamily: 'monospace', resize: 'none',
                     outline: 'none', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.2)'
                  }}
               />
            ) : (
               <div style={{
                     flex: 1, width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-main)',
                     padding: '2rem 3rem', borderRadius: '16px', border: '1px solid var(--border-light)',
                     fontSize: '1.1rem', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
               }}>
                  {renderMarkdown(currentChapter.content)}
               </div>
            )}
         </div>
      </main>

      {/* REORGANIZE MODAL */}
      {isReorgModalOpen && (
         <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
         }}>
            <div className="slide-in" style={{
               background: 'var(--bg-main)', padding: '2.5rem', borderRadius: '16px', width: '500px', 
               maxWidth: '90%', border: '1px solid var(--border-light)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
               <h2 style={{marginTop: 0, color: 'var(--text-main)'}}>✨ Reorganize Notebook</h2>
               <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>Instruct the AI on how to structure your notes.</p>
               
               <div style={{marginBottom: '1.5rem'}}>
                  <label style={{display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold'}}>Refactoring Instructions (Optional)</label>
                  <textarea 
                     value={reorgInstructions}
                     onChange={(e) => setReorgInstructions(e.target.value)}
                     placeholder="e.g. Focus on business terms, make it simpler..."
                     style={{
                        width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-light)', color: 'var(--text-main)', resize: 'vertical', minHeight: '80px'
                     }}
                  />
               </div>

               <div style={{marginBottom: '2rem'}}>
                  <label style={{display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold'}}>Sections (Comma Separated)</label>
                  <input 
                     type="text"
                     value={reorgSections}
                     onChange={(e) => setReorgSections(e.target.value)}
                     style={{
                        width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-light)', color: 'var(--text-main)'
                     }}
                  />
               </div>

               <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem'}}>
                  <button 
                     onClick={() => setIsReorgModalOpen(false)}
                     style={{padding: '0.6rem 1.2rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold'}}
                  >
                     Cancel
                  </button>
                  <button 
                     onClick={handleReorganize}
                     disabled={isReorganizing}
                     style={{
                        padding: '0.6rem 1.5rem', background: 'var(--primary)', border: 'none', color: 'white', 
                        borderRadius: '8px', cursor: isReorganizing ? 'not-allowed' : 'pointer', fontWeight: 'bold'
                     }}
                  >
                     {isReorganizing ? 'Processing...' : 'Run Refactor'}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default NotebookMode;
