import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, HelpCircle } from "lucide-react";

interface VoiceControllerProps {
  onCommandReceived: (command: string) => void;
  language: string;
  voiceSuggestions: string[];
  isSpeaking?: boolean;
  handsFree?: boolean;
  onHandsFreeChange?: (val: boolean) => void;
}

export default function VoiceController({ 
  onCommandReceived, 
  language, 
  voiceSuggestions, 
  isSpeaking = false,
  handsFree: propHandsFree,
  onHandsFreeChange: propOnHandsFreeChange
}: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputVal, setTextInputVal] = useState("");
  const [localHandsFree, setLocalHandsFree] = useState(true);
  
  const handsFree = propHandsFree !== undefined ? propHandsFree : localHandsFree;
  const setHandsFree = propOnHandsFreeChange !== undefined ? propOnHandsFreeChange : setLocalHandsFree;
  const recognitionRef = useRef<any>(null);
  const [pulse, setPulse] = useState(1);

  // Use refs to prevent stale closure problems inside async callbacks
  const handsFreeRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const isActiveListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const isBlockedRef = useRef(false);
  const onCommandReceivedRef = useRef(onCommandReceived);

  useEffect(() => {
    onCommandReceivedRef.current = onCommandReceived;
  }, [onCommandReceived]);

  useEffect(() => {
    handsFreeRef.current = handsFree;
    isBlockedRef.current = false; // Reset block when handsFree is manually changed
    if (handsFree && !isSpeakingRef.current && !isActiveListeningRef.current) {
      startMicSafe();
    } else if (!handsFree && isActiveListeningRef.current) {
      stopMicSafe();
    }
  }, [handsFree]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const startMicSafe = () => {
    if (!recognitionRef.current) return;
    if (isActiveListeningRef.current || isSpeakingRef.current || isStartingRef.current) return;
    isBlockedRef.current = false; // Reset block when manually starting
    isStartingRef.current = true;
    
    // Safety guard to prevent speech recognition from freezing in starting mode
    const startTimeout = setTimeout(() => {
      if (isStartingRef.current && !isActiveListeningRef.current) {
        console.warn("Speech recognition start timeout. Resetting starting state.");
        isStartingRef.current = false;
      }
    }, 3000);

    try {
      recognitionRef.current.start();
    } catch (e) {
      clearTimeout(startTimeout);
      isStartingRef.current = false;
      console.warn("startMicSafe failed to start:", e);
    }
  };

  const stopMicSafe = () => {
    if (!recognitionRef.current) return;
    if (!isActiveListeningRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn("stopMicSafe failed to stop:", e);
    }
  };

  useEffect(() => {
    if (isSpeaking) {
      if (isActiveListeningRef.current) {
        stopMicSafe();
      }
    } else {
      // Once speaking ends, if hands-free is checked, restart listening
      if (handsFree && !isActiveListeningRef.current && !isBlockedRef.current) {
        const timer = setTimeout(() => {
          if (handsFreeRef.current && !isSpeakingRef.current && !isActiveListeningRef.current && !isBlockedRef.current) {
            startMicSafe();
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }

    if (!handsFree) {
      if (isActiveListeningRef.current) {
        stopMicSafe();
      }
    }
  }, [isSpeaking, handsFree]);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;

      let recognitionLang = "en-US";
      if (language === "Hindi") recognitionLang = "hi-IN";
      else if (language === "Kannada") recognitionLang = "kn-IN";
      else if (language === "Telugu") recognitionLang = "te-IN";
      else if (language === "Tamil") recognitionLang = "ta-IN";
      else if (language === "Malayalam") recognitionLang = "ml-IN";
      else if (language === "Marathi") recognitionLang = "mr-IN";
      else if (language === "Gujarati") recognitionLang = "gu-IN";
      else if (language === "Bengali") recognitionLang = "bn-IN";
      else if (language === "Punjabi") recognitionLang = "pa-IN";
      else if (language === "Odia") recognitionLang = "or-IN";

      rec.lang = recognitionLang;

      rec.onstart = () => {
        if (recognitionRef.current !== rec) return;
        isStartingRef.current = false;
        isActiveListeningRef.current = true;
        setIsListening(true);
        setTranscript("Listening for commands...");
      };

      rec.onresult = (event: any) => {
        if (recognitionRef.current !== rec) return;
        const resultIndex = event.resultIndex !== undefined ? event.resultIndex : event.results.length - 1;
        const resultText = event.results[resultIndex][0].transcript;
        setTranscript(`Heard: "${resultText}"`);
        // Map transcription to our core actions
        processVoiceCommand(resultText);
      };

      rec.onerror = (err: any) => {
        if (recognitionRef.current !== rec) return;
        isStartingRef.current = false;
        console.warn("Speech recognition error event:", err.error);
        
        if (err.error === "not-allowed" || err.error === "service-not-allowed") {
          setTranscript("Microphone permission needed. Tap mic button to allow!");
          isBlockedRef.current = true; // Avoid infinite auto-restart loop
          setIsListening(false);
          isActiveListeningRef.current = false;
        } else if (err.error === "no-speech") {
          setTranscript("Still listening... Say a command.");
        } else if (err.error === "aborted") {
          console.log("Speech recognition aborted intentionally.");
        } else {
          setTranscript(`Speech helper: ${err.error}. Type below if needed.`);
          setShowTextInput(true);
        }
      };

      rec.onend = () => {
        if (recognitionRef.current !== rec) return;
        isStartingRef.current = false;
        isActiveListeningRef.current = false;
        setIsListening(false);

        // Auto-restart if hands-free is enabled and we are not speaking and not blocked
        if (handsFreeRef.current && !isSpeakingRef.current && !isBlockedRef.current) {
          const timer = setTimeout(() => {
            if (handsFreeRef.current && !isSpeakingRef.current && !isActiveListeningRef.current && !isStartingRef.current && !isBlockedRef.current && recognitionRef.current === rec) {
              try {
                isStartingRef.current = true;
                rec.start();
              } catch (e) {
                isStartingRef.current = false;
                console.warn("Auto-restart onend failed:", e);
              }
            }
          }, 800);
        }
      };

      recognitionRef.current = rec;
      
      // Auto-start listening on load if handsFree is active and not speaking and not blocked
      if (handsFree && !isSpeaking && !isBlockedRef.current) {
        try {
          isStartingRef.current = true;
          rec.start();
        } catch (e) {
          isStartingRef.current = false;
          console.warn("Failed automatic speech recognition start on load:", e);
        }
      }
    } else {
      setIsSupported(false);
      setShowTextInput(true);
    }

    return () => {
      try {
        recognitionRef.current?.abort();
      } catch (e) {}
    };
  }, [language]);

  // Handle command mapping logic
  const processVoiceCommand = (rawText: string) => {
    // DO NOT process commands while the companion is actively speaking to prevent echo loops
    const isActuallySpeaking = isSpeakingRef.current && 
      (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking);

    if (isActuallySpeaking) {
      console.log("Ignored voice command during active SpeechSynthesis output:", rawText);
      return;
    }

    const text = rawText.toLowerCase().trim();
    
    // 1. Truth or Dare (High Priority, check first to prevent select/play overrides)
    if (
      text.includes("truth") || 
      text.includes("sach") || 
      text.includes("satya") || 
      text.includes("sathya") || 
      text.includes("nija") || 
      text.includes("sachai") || 
      text.includes("सच") || 
      text.includes("सत्य") || 
      text.includes("सच्चाई") || 
      text.includes("ಟ್ರುಥ್") || 
      text.includes("ಸತ್ಯ") || 
      text.includes("ನಿಜ") || 
      text.includes("ಸತ್ಯದ")
    ) {
      onCommandReceivedRef.current("truth");
    } else if (
      text.includes("dare") || 
      text.includes("himmat") || 
      text.includes("saahas") || 
      text.includes("sahas") || 
      text.includes("dhairya") || 
      text.includes("dhairyada") || 
      text.includes("साहस") || 
      text.includes("हिम्मत") || 
      text.includes("डेयर") || 
      text.includes("ಡೇರ್") || 
      text.includes("ಧೈರ್ಯ") || 
      text.includes("ಸಾಹಸ")
    ) {
      onCommandReceivedRef.current("dare");
    } else if (text.includes("next") || text.includes("another") || text.includes("generate") || text.includes("badlo") || text.includes("dusra")) {
      onCommandReceivedRef.current("another");
    } else if (text.includes("new game") || text.includes("create game") || text.includes("restart") || text.includes("reset") || text.includes("nayan khel") || text.includes("naya khel")) {
      onCommandReceivedRef.current("new game");
    } else if (text.includes("harder") || text.includes("mushkil")) {
      onCommandReceivedRef.current("harder");
    } else if (text.includes("easier") || text.includes("aasan")) {
      onCommandReceivedRef.current("easier");
    } else if (text.includes("language") || text.includes("bhasha") || text.includes("switch")) {
      onCommandReceivedRef.current("switch language");
    } else if (text.startsWith("remove player") || text.startsWith("delete player") || text.startsWith("remove ") || text.startsWith("delete ") || text.includes("nikalo") || text.includes("hatao")) {
      const name = rawText
          .replace(/remove player/i, "")
          .replace(/delete player/i, "")
          .replace(/remove/i, "")
          .replace(/delete/i, "")
          .replace(/nikalo/i, "")
          .replace(/hatao/i, "")
          .trim();
      if (name) {
        onCommandReceivedRef.current(`remove player:${name}`);
      }
    } else if (
      text.includes("add player") ||
      text.includes("add players") ||
      text.includes("new player") ||
      text.startsWith("add ") ||
      text.startsWith("player ")
    ) {
      // Robust regex-based player name extraction that prevents leaving trailing "s" or "a player"
      const addPhrases = [
        /add a new player named/i,
        /add a player named/i,
        /add new player named/i,
        /add player named/i,
        /add a new player/i,
        /add a player/i,
        /add new player/i,
        /add players/i,
        /add player/i,
        /new player/i,
        /^add\s+/i,
        /^player\s+/i
      ];

      let name = rawText;
      for (const phrase of addPhrases) {
        if (phrase.test(name)) {
          name = name.replace(phrase, "");
          break; // Match the longest / most specific phrase first
        }
      }
      name = name.trim();

      if (name) {
        // Intelligent splitting of names (e.g., "Chethan and Rahul" or "Chethan, Rahul")
        const names = name.split(/\s+and\s+|\s+,\s+|\s*,\s*|\s+aur\s+/i).map(n => n.trim()).filter(Boolean);
        names.forEach(n => {
          onCommandReceivedRef.current(`add player:${n}`);
        });
      } else {
        onCommandReceivedRef.current("add player");
      }
    } else if (text.startsWith("select player") || text.startsWith("select ") || text.startsWith("choose ")) {
      // Extract player name
      const name = rawText.replace(/select player/i, "").replace(/select/i, "").replace(/choose/i, "").trim();
      const lowerName = name.toLowerCase();
      // Ensure we don't accidentally match truth or dare as a player name
      if (name && 
          lowerName !== "truth" && 
          lowerName !== "dare" && 
          lowerName !== "sach" && 
          lowerName !== "satya" && 
          lowerName !== "sathya" && 
          lowerName !== "nija" && 
          lowerName !== "himmat" && 
          lowerName !== "sahas" && 
          lowerName !== "dhairya" &&
          !["सच", "सत्य", "साहस", "हिम्मत", "ಸತ್ಯ", "ಧೈರ್ಯ", "ನಿಜ", "ಸಾಹಸ"].includes(name)
      ) {
        onCommandReceivedRef.current(`select player:${name}`);
      }
    } else if (text.includes("start game") || text.includes("play game") || text.includes("enter playground") || text.includes("play") || text.includes("start") || text.includes("shuru")) {
      onCommandReceivedRef.current("play");
    } else if (
      text.includes("spin") || 
      text.includes("wheel") || 
      text.includes("guma") || 
      text.includes("ghumao") || 
      text.includes("roll") ||
      text.includes("tirugu") ||
      text.includes("tirugisu")
    ) {
      onCommandReceivedRef.current("spin");
    } else if (text.includes("open camera") || text.includes("camera") || text.includes("camera assist") || text.includes("optical")) {
      onCommandReceivedRef.current("camera");
    } else if (text.includes("play mini game") || text.includes("open game") || text.includes("arcade") || text.includes("mini game") || text.includes("game")) {
      onCommandReceivedRef.current("minigame");
    } else if (text.includes("move left") || text.includes("go left") || text === "left") {
      onCommandReceivedRef.current("left");
    } else if (text.includes("move right") || text.includes("go right") || text === "right") {
      onCommandReceivedRef.current("right");
    } else if (text.includes("pop") || text.includes("tap") || text.includes("click") || text.includes("shoot") || text.includes("catch") || text.includes("hit")) {
      onCommandReceivedRef.current("tap");
    } else if (text.includes("back") || text.includes("close") || text.includes("exit") || text.includes("return")) {
      onCommandReceivedRef.current("back");
    } else if (text.includes("claim bonus") || text.includes("claim") || text.includes("accept") || text.includes("verify")) {
      onCommandReceivedRef.current("claim");
    } else if (
      text.includes("complete") || 
      text.includes("done") || 
      text.includes("finish") || 
      text.includes("khoob") || 
      text.includes("ho gaya") || 
      text.includes("purna") || 
      text.includes("completed") ||
      text.includes("khatam") ||
      text.includes("pura") ||
      text.includes("mugiyitu") ||
      text.includes("aayitu")
    ) {
      onCommandReceivedRef.current("complete");
    } else if (
      text.includes("pass") || 
      text.includes("skip") || 
      text.includes("chod") ||
      text.includes("chodo") ||
      text.includes("jane do") ||
      text.includes("bidu") ||
      text.includes("munde")
    ) {
      onCommandReceivedRef.current("pass");
    } else {
      // General custom voice intent passed back to Gemini API
      onCommandReceivedRef.current(`custom:${rawText}`);
    }
  };

  const toggleListening = () => {
    if (!isSupported) {
      setTranscript("Speech recognition not supported. Type below!");
      setShowTextInput(true);
      return;
    }

    if (isListening) {
      setHandsFree(false); // Turn off hands-free mode if they manually stop the mic so it doesn't auto-restart
      stopMicSafe();
    } else {
      setTranscript("Initializing microphone...");
      startMicSafe();
    }
  };

  const handleTextSubmit = () => {
    if (!textInputVal.trim()) return;
    setTranscript(`Command: "${textInputVal}"`);
    processVoiceCommand(textInputVal);
    setTextInputVal("");
  };

  // Pulse animation for the listening wave effect
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setPulse((p) => (p === 1 ? 1.4 : 1));
    }, 400);
    return () => clearInterval(interval);
  }, [isListening]);

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden" id="voice-controller">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Speech Companion</h4>
        </div>
        <div className="flex items-center gap-3">
          {/* Hands-Free Toggle Switch */}
          {isSupported && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-[9px] font-mono font-bold text-slate-400">HANDS-FREE</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={handsFree}
                  onChange={(e) => setHandsFree(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
              </div>
            </label>
          )}
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full">
            <span>{isSupported ? "SPEECH ONLINE" : "MANUAL MODE"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Toggle Speech Mic Button */}
        <button
          onClick={toggleListening}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening 
              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105"
          }`}
          style={{ transform: `scale(${isListening ? pulse : 1})` }}
          title={isSupported ? "Click to speak commands" : "Enter a custom voice command manually"}
        >
          {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Text output transcript HUD */}
        <div className="flex-1 min-w-0">
          {transcript ? (
            <div className="text-xs font-semibold text-slate-100 truncate animate-pulse bg-slate-950/50 py-1.5 px-3 rounded-xl border border-slate-800/50">
              {transcript}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-400 leading-relaxed">
              Tap mic or use input: <span className="text-indigo-400 font-bold font-mono">"Another"</span>, <span className="text-indigo-400 font-bold font-mono">"Harder"</span>, <span className="text-indigo-400 font-bold font-mono">"Add player"</span>
            </div>
          )}
        </div>
      </div>

      {/* Helpful hands-free status banner */}
      {handsFree && !isListening && isSupported && (
        <div className="mt-3 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-2.5 rounded-2xl flex items-center gap-2 animate-pulse" id="handsfree-activation-notice">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Hands-Free is **armed**! Modern browsers block microphones until you interact. **Tap the Mic button once** to start.</span>
        </div>
      )}

      {/* Sleek inline text input field as fallback/alternative */}
      {(showTextInput || !isSupported) && (
        <div className="mt-4 flex gap-2 animate-fade-in">
          <input
            type="text"
            value={textInputVal}
            onChange={(e) => setTextInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            placeholder="Type a command (e.g. 'Spin', 'Next', 'Add player: Chethan')"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-100 placeholder:text-slate-600"
          />
          <button
            onClick={handleTextSubmit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition duration-300"
          >
            Send
          </button>
        </div>
      )}

      {/* Voice suggestions list */}
      {voiceSuggestions && voiceSuggestions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono text-slate-500 font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Recommended spoken commands ({language})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {voiceSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setTranscript(`Selected: "${s}"`);
                  processVoiceCommand(s);
                }}
                className="text-[11px] font-medium bg-slate-950 hover:bg-indigo-500/10 text-slate-300 hover:text-indigo-400 py-1 px-2.5 rounded-lg border border-slate-800 hover:border-indigo-500/30 transition text-left"
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
