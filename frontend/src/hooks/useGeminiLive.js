import { useState, useRef, useEffect, useCallback } from 'react';

export function useGeminiLive(settings) {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState([]);
  const [subtitles, setSubtitles] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const speakingTimeoutRef = useRef(null);
  const currentModelTextRef = useRef('');

  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const stopConversation = useCallback(() => {
    setIsRecording(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    currentModelTextRef.current = '';
    nextPlayTimeRef.current = 0;
    if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
    }
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
  }, []);

  useEffect(() => {
    return () => stopConversation();
  }, [stopConversation]);

  const startConversation = async (overrideSettings = null) => {
    const activeSettings = overrideSettings || settings;
    const API_KEY = activeSettings?.api_key;
    
    if (!API_KEY) {
      alert("Please enter your Google Gemini API Key in the Settings menu first!");
      return;
    }

    setIsRecording(true);
    setSubtitles("");
    setNotes([]);
    setTranscript([]);
    
    // Connect directly to the Gemini Live WebSockets API
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
    wsRef.current = new WebSocket(url);
    
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    
    wsRef.current.onopen = async () => {
      console.log('Connected to Gemini Live API');
      
      // Send the initial Setup Message
      const setupMessage = {
        setup: {
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: activeSettings?.voice || "Aoede"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: `You are an expert, native ${(activeSettings?.learnLanguage || 'english').toLowerCase()} language tutor. We are having an open-ended audio conversation. The user's proficiency level in ${activeSettings?.learnLanguage || 'english'} is CEFR ${(activeSettings?.level || 'b1').toUpperCase()}. Crucially, the user's native language is ${activeSettings?.appLanguage || 'english'}. You must converse primarily in ${(activeSettings?.learnLanguage || 'english').toLowerCase()} to help them practice. However, when you correct a grammatical error or explain a rule, you should explain it in their native language (${activeSettings?.appLanguage || 'english'}) to ensure they fully understand. Keep your responses conversational, warm, and relatively brief. If you correct a mistake or teach a new word, you must autonomously use your save_note tool to save it for the user.` }]
          },
          tools: [{
            functionDeclarations: [{
              name: "save_note",
              description: "Use this tool to save a grammar rule, new vocabulary word, or correction to the user's notes. Do this autonomously whenever you teach them something new or correct a mistake.",
              parameters: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING", description: "Short title, e.g. 'Present Perfect Tense'" },
                  explanation: { type: "STRING", description: "Brief explanation of the rule or word" }
                },
                required: ["title", "explanation"]
              }
            }]
          }]
        }
      };
      
      wsRef.current.send(JSON.stringify(setupMessage));
      
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ 
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } 
        });
        
        await audioContextRef.current.audioWorklet.addModule('/pcm-processor.js');
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        processorRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
        
        processorRef.current.port.onmessage = (e) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             const base64Audio = arrayBufferToBase64(e.data);
             const clientContent = {
                 realtimeInput: {
                    audio: {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                    }
                 }
             };
             wsRef.current.send(JSON.stringify(clientContent));
          }
        };
        
        source.connect(processorRef.current);
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    };

    wsRef.current.onclose = (e) => console.log("Gemini WS Closed:", e.code, e.reason);
    wsRef.current.onerror = (e) => console.error("Gemini WS Error:", e);
    
    wsRef.current.onmessage = async (event) => {
        try {
            let textData = typeof event.data === "string" ? event.data : await event.data.text();
            const response = JSON.parse(textData);
            console.log("Gemini WS Response:", response);
            
            if (response.setupComplete) {
                const targetLang = (settings?.learnLanguage || 'english').toLowerCase();
                const greetings = {
                    english: "Hey there!",
                    spanish: "¡Hola!",
                    french: "Salut !",
                    japanese: "こんにちは！",
                    italian: "Ciao!",
                    german: "Hallo!",
                    chinese: "你好！"
                };
                const greeting = greetings[targetLang] || "Hey there!";
                
                // Send an initial invisible text prompt to make the AI speak first
                wsRef.current.send(JSON.stringify({
                    clientContent: {
                        turns: [{
                            role: "user",
                            parts: [{ text: `Hello! Please greet me by saying exactly '${greeting}' and nothing else.` }]
                        }],
                        turnComplete: true
                    }
                }));
            }
            
            if (response.serverContent?.modelTurn?.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const base64 = part.inlineData.data;
                        const binaryString = atob(base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const pcm16 = new Int16Array(bytes.buffer);
                        const float32 = new Float32Array(pcm16.length);
                        for (let i = 0; i < pcm16.length; i++) {
                            float32[i] = pcm16[i] / 32768.0; 
                        }
                        const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
                        audioBuffer.getChannelData(0).set(float32);
                        
                        const source = audioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(audioContextRef.current.destination);
                        
                        const currentTime = audioContextRef.current.currentTime;
                        if (nextPlayTimeRef.current < currentTime) {
                            nextPlayTimeRef.current = currentTime;
                        }
                        source.start(nextPlayTimeRef.current);
                        nextPlayTimeRef.current += audioBuffer.duration;
                        
                        if (!isSpeakingRef.current) {
                            setIsSpeaking(true);
                            isSpeakingRef.current = true;
                        }
                        if (speakingTimeoutRef.current) {
                            clearTimeout(speakingTimeoutRef.current);
                        }
                        
                        const timeUntilEndMs = Math.max(0, (nextPlayTimeRef.current - audioContextRef.current.currentTime) * 1000);
                        speakingTimeoutRef.current = setTimeout(() => {
                            setIsSpeaking(false);
                            isSpeakingRef.current = false;
                        }, timeUntilEndMs);
                    }
                    
                    if (part.text) {
                        setSubtitles(prev => prev + part.text);
                        currentModelTextRef.current += part.text;
                    }
                }
            }
            
            if (response.toolCall && response.toolCall.functionCalls) {
                for (const call of response.toolCall.functionCalls) {
                    if (call.name === "save_note") {
                        const args = call.args;
                        setNotes(prev => [{ title: args.title || "New Note", explanation: args.explanation || "" }, ...prev]);
                        
                        wsRef.current.send(JSON.stringify({
                            toolResponse: {
                                functionResponses: [{
                                    id: call.id,
                                    name: call.name,
                                    response: { result: "success, note saved to UI" }
                                }]
                            }
                        }));
                    }
                }
            }
            
            if (response.serverContent?.interrupted) {
                setSubtitles("");
            }
            
            if (response.serverContent?.turnComplete) {
                if (currentModelTextRef.current.trim()) {
                    const text = currentModelTextRef.current.trim();
                    setTranscript(prev => [...prev, { role: 'model', text }]);
                    currentModelTextRef.current = '';
                }
                setTimeout(() => setSubtitles(""), 3000);
            }
        } catch (e) {
            console.error("Error parsing websocket message:", e, event.data);
        }
    };
  };

  const toggleConversation = (overrideSettings = null) => {
    if (isRecording) {
      stopConversation();
    } else {
      startConversation(overrideSettings);
    }
  };

  return { isRecording, toggleConversation, notes, subtitles, isSpeaking, transcript };
}
