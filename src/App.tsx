import { useState, useEffect, useRef } from "react";
import { TRANSLATIONS } from "./translations";
import { Player, ChallengeData, GameView } from "./types";
import SpinningWheel from "./components/SpinningWheel";
import CanvasAnimation from "./components/CanvasAnimation";
import MiniGamePlayground from "./components/MiniGamePlayground";
import CameraAssistant from "./components/CameraAssistant";
import VoiceController from "./components/VoiceController";
import {
  Users,
  User,
  Plus,
  Trash2,
  Award,
  Sparkles,
  Trophy,
  ArrowRight,
  Shuffle,
  ChevronLeft,
  Volume2,
  Video,
  Play,
  RotateCcw,
  RefreshCw,
  CheckCircle,
  Accessibility,
  Clock
} from "lucide-react";

const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6"  // teal
];

const CATEGORIES = ["Friends", "Kids (7-12)", "Teens (13-17)", "Young Adults (18-35)", "Family", "Office", "Party", "Festival"];
const LANGUAGES = ["English", "Kannada", "Hindi", "Telugu", "Tamil", "Malayalam", "Marathi", "Gujarati", "Bengali", "Punjabi", "Odia"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function App() {
  // Game Setup States
  const gameMode = "multi";
  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "Chethan", score: 0, color: AVATAR_COLORS[0] },
    { id: "2", name: "Priya", score: 0, color: AVATAR_COLORS[4] }
  ]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [category, setCategory] = useState("Friends");
  const [language, setLanguage] = useState("English");
  const [difficulty, setDifficulty] = useState("Medium");

  // Game Engine Runtime States
  const [currentView, setCurrentView] = useState<GameView>("setup");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [claimedBonus, setClaimedBonus] = useState({ camera: false, miniGame: false });
  const [challengeScore, setChallengeScore] = useState(0);
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<{ command: string; timestamp: number } | null>(null);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentUtteranceIdRef = useRef<number>(0);
  const [challengeTimer, setChallengeTimer] = useState<number>(45);

  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  // Warmup Speech Voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const handleVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoices);
      };
    }
  }, []);

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    
    currentUtteranceIdRef.current += 1;
    const utteranceId = currentUtteranceIdRef.current;
    
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    activeUtterancesRef.current = [];
    
    // Clean up text (remove asterisks, markdown headings, inline formats, emojis)
    const cleanText = text
      .replace(/\*+/g, "")
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterancesRef.current.push(utterance);

    // To prevent garbage collection of SpeechSynthesisUtterance in Chrome/Safari
    if (!(window as any)._activeUtterances) {
      (window as any)._activeUtterances = [];
    }
    (window as any)._activeUtterances.push(utterance);

    let voiceLang = "en-US";
    if (language === "Hindi") voiceLang = "hi-IN";
    else if (language === "Kannada") voiceLang = "kn-IN";
    else if (language === "Telugu") voiceLang = "te-IN";
    else if (language === "Tamil") voiceLang = "ta-IN";
    else if (language === "Malayalam") voiceLang = "ml-IN";
    else if (language === "Marathi") voiceLang = "mr-IN";
    else if (language === "Gujarati") voiceLang = "gu-IN";
    else if (language === "Bengali") voiceLang = "bn-IN";
    else if (language === "Punjabi") voiceLang = "pa-IN";
    else if (language === "Odia") voiceLang = "or-IN";

    utterance.lang = voiceLang;

    // Load available voices
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang === voiceLang || v.lang.startsWith(voiceLang));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    // Safety fallback timer to prevent permanent locks
    const estimatedDuration = Math.max(3000, cleanText.length * 85 + 1200);
    const safetyTimer = setTimeout(() => {
      if (currentUtteranceIdRef.current === utteranceId) {
        setIsSpeaking(false);
      }
    }, estimatedDuration);

    utterance.onend = () => {
      clearTimeout(safetyTimer);
      activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== utterance);
      if ((window as any)._activeUtterances) {
        (window as any)._activeUtterances = (window as any)._activeUtterances.filter((u: any) => u !== utterance);
      }
      if (currentUtteranceIdRef.current === utteranceId) {
        setIsSpeaking(false);
      }
    };
    utterance.onerror = (e) => {
      console.warn("Speech synthesis error event:", e);
      clearTimeout(safetyTimer);
      activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== utterance);
      if ((window as any)._activeUtterances) {
        (window as any)._activeUtterances = (window as any)._activeUtterances.filter((u: any) => u !== utterance);
      }
      if (currentUtteranceIdRef.current === utteranceId) {
        setIsSpeaking(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const speakEvent = (event: "player_selected" | "challenge_loaded" | "round_completed" | "round_passed", data?: any) => {
    let text = "";
    const pName = data?.playerName || "";
    const challenge = data?.challenge || "";
    const points = data?.points || 0;
    const mode = data?.mode || "Truth";

    if (language === "English") {
      if (event === "player_selected") {
        text = `${pName}, it is your turn! Say: select Truth, or: select Dare.`;
      } else if (event === "challenge_loaded") {
        text = `${pName}, here is your ${mode} challenge. ${challenge}. Say complete, when you are done!`;
      } else if (event === "round_completed") {
        text = `Great job, ${pName}! You have scored ${points} points.`;
      } else if (event === "round_passed") {
        text = `Round passed. Next player turn.`;
      }
    } else if (language === "Hindi") {
      if (event === "player_selected") {
        text = `${pName}, आपकी बारी है! सच या साहस चुनें।`;
      } else if (event === "challenge_loaded") {
        text = `${pName}, आपका ${mode === "Truth" ? "सच" : "साहस"} कार्य है। ${challenge}. पूरा होने पर कंप्लीट कहें।`;
      } else if (event === "round_completed") {
        text = `बहुत बढ़िया, ${pName}! आपने ${points} अंक प्राप्त किए हैं।`;
      } else if (event === "round_passed") {
        text = `बारी छोड़ दी गई। अगले खिलाड़ी की बारी।`;
      }
    } else if (language === "Kannada") {
      if (event === "player_selected") {
        text = `${pName}, ನಿಮ್ಮ ಸರದಿ! ಸತ್ಯ ಅಥವಾ ಧೈರ್ಯವನ್ನು ಆರಿಸಿ.`;
      } else if (event === "challenge_loaded") {
        text = `${pName}, ನಿಮ್ಮ ${mode === "Truth" ? "ಸತ್ಯ" : "ಧೈರ್ಯ"} ಸವಾಲು. ${challenge}. ಪೂರ್ಣಗೊಂಡಾಗ ಕಂಪ್ಲೀಟ್ ಎಂದು ಹೇಳಿ.`;
      } else if (event === "round_completed") {
        text = `ಅದ್ಭುತ, ${pName}! ನೀವು ${points} ಅಂಕಗಳನ್ನು ಗಳಿಸಿದ್ದೀರಿ.`;
      } else if (event === "round_passed") {
        text = `ಮುಂದಿನ ಆಟಗಾರನ ಸರದಿ.`;
      }
    } else {
      // Fallback for other languages to English with localized names
      if (event === "player_selected") {
        text = `${pName}, it is your turn! Choose truth or dare.`;
      } else if (event === "challenge_loaded") {
        text = `${challenge}. Say complete when done.`;
      } else if (event === "round_completed") {
        text = `Completed. Plus ${points} points.`;
      } else if (event === "round_passed") {
        text = `Next turn.`;
      }
    }

    if (text) {
      speakText(text);
    }
  };

  // Add a player
  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const color = AVATAR_COLORS[players.length % AVATAR_COLORS.length];
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      score: 0,
      color
    };
    setPlayers((prev) => [...prev, newPlayer]);
    setNewPlayerName("");
  };

  // Remove a player
  const removePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Fetch challenge from server
  const generateNewChallenge = async (modeChoice: "Truth" | "Dare", customIntent: string = "") => {
    setIsLoading(true);
    setErrorMsg("");
    setIllustrationUrl(null);
    setClaimedBonus({ camera: false, miniGame: false });

    try {
      const response = await fetch("/api/challenge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeChoice,
          category,
          language,
          difficulty,
          customVoiceIntent: customIntent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate challenge from Gemini engine");
      }

      const data: ChallengeData = await response.json();
      setCurrentChallenge(data);
      setChallengeScore(data.score.base);
      
      const parsedTime = parseInt(data.estimatedTime) || 45;
      setChallengeTimer(parsedTime);

      setCurrentView("challenge");
      // Speak the loaded challenge!
      speakEvent("challenge_loaded", {
        playerName: selectedPlayer?.name || "You",
        challenge: data.challenge,
        mode: modeChoice
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred. Check if API key is set in secrets.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger illustration generation from image model
  const generateIllustration = async () => {
    if (!currentChallenge?.illustrationPrompt || isGeneratingImg) return;
    setIsGeneratingImg(true);
    try {
      const response = await fetch("/api/challenge/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentChallenge.illustrationPrompt })
      });
      if (!response.ok) {
        throw new Error("Failed to render illustration model");
      }
      const data = await response.json();
      setIllustrationUrl(data.imageUrl);
    } catch (e) {
      console.error("Illustration failure, generating client-side fallback SVG:", e);
      // Create a local client-side SVG fallback as data URL
      const isTruth = currentChallenge?.mode === "Truth";
      const bgColor = isTruth ? "#0f172a" : "#180815";
      const accentColor = isTruth ? "#818cf8" : "#f43f5e";
      const iconSvg = isTruth 
        ? `<circle cx="100" cy="90" r="40" fill="${accentColor}" opacity="0.15" /><path d="M100,55 A35,35 0 1,1 65,90" fill="none" stroke="${accentColor}" stroke-width="8" stroke-linecap="round" /><circle cx="100" cy="125" r="5" fill="${accentColor}" /><path d="M75,150 L125,150 M85,160 L115,160" stroke="${accentColor}" stroke-width="6" stroke-linecap="round" />`
        : `<path d="M100,35 C115,65 140,80 140,115 C140,145 120,165 100,165 C80,165 60,145 60,115 C60,75 85,55 100,35 Z" fill="${accentColor}" opacity="0.2" /><path d="M100,55 C110,75 125,85 125,110 C125,130 112,145 100,145 C88,145 75,130 75,110 C75,85 90,70 100,55 Z" fill="${accentColor}" /><path d="M100,75 C105,88 115,95 115,110 C115,120 108,128 100,128 C92,128 85,120 85,110 C85,95 95,88 100,75 Z" fill="#ffffff" />`;
      
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
          <rect width="200" height="200" rx="32" fill="${bgColor}" />
          <defs>
            <radialGradient id="grad-cs" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25" />
              <stop offset="100%" stop-color="${bgColor}" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="200" rx="32" fill="url(#grad-cs)" />
          <g stroke-linecap="round" stroke-linejoin="round">
            ${iconSvg}
          </g>
        </svg>
      `.trim().replace(/\s+/g, ' ');
      
      try {
        const b64 = btoa(unescape(encodeURIComponent(svg)));
        setIllustrationUrl(`data:image/svg+xml;base64,${b64}`);
      } catch (encodeErr) {
        console.error("Base64 encode error for fallback SVG:", encodeErr);
      }
    } finally {
      setIsGeneratingImg(false);
    }
  };

  // Receive commands from voice assistant
  const handleVoiceCommand = (command: string) => {
    // Record last voice command for sub-views to subscribe to
    setLastVoiceCommand({ command, timestamp: Date.now() });

    if (command === "another") {
      if (currentChallenge) {
        generateNewChallenge(currentChallenge.mode);
      } else {
        generateNewChallenge("Truth");
      }
    } else if (command === "new game") {
      resetEntireGame();
      if (language === "English") speakText("Creating a new game. Please add players.");
      else if (language === "Hindi") speakText("नया खेल शुरू हो रहा है। कृपया खिलाड़ियों को जोड़ें।");
      else if (language === "Kannada") speakText("ಹೊಸ ಆಟವನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಆಟಗಾರರನ್ನು ಸೇರಿಸಿ.");
    } else if (command === "harder") {
      setDifficulty("Hard");
      if (currentChallenge) generateNewChallenge(currentChallenge.mode);
    } else if (command === "easier") {
      setDifficulty("Easy");
      if (currentChallenge) generateNewChallenge(currentChallenge.mode);
    } else if (command === "switch language") {
      // Toggle to Hindi then Kannada then back to English
      const nextLang = language === "English" ? "Hindi" : language === "Hindi" ? "Kannada" : "English";
      setLanguage(nextLang);
    } else if (command === "add player") {
      if (currentView === "setup") {
        const testName = `Player ${players.length + 1}`;
        setPlayers((prev) => [...prev, {
          id: Date.now().toString(),
          name: testName,
          score: 0,
          color: AVATAR_COLORS[players.length % AVATAR_COLORS.length]
        }]);
        if (language === "English") speakText(`Added player ${testName}`);
        else if (language === "Hindi") speakText(`खिलाड़ी ${testName} को जोड़ दिया गया है`);
        else if (language === "Kannada") speakText(`ಆಟಗಾರ ${testName} ಸೇರಿಸಲಾಗಿದೆ`);
      }
    } else if (command.startsWith("add player:")) {
      if (currentView === "setup") {
        const name = command.replace("add player:", "").trim();
        if (name) {
          setPlayers((prev) => [...prev, {
            id: Date.now().toString(),
            name,
            score: 0,
            color: AVATAR_COLORS[players.length % AVATAR_COLORS.length]
          }]);
          if (language === "English") speakText(`Added player ${name}`);
          else if (language === "Hindi") speakText(`खिलाड़ी ${name} को जोड़ दिया गया है`);
          else if (language === "Kannada") speakText(`ಆಟಗಾರ ${name} ಸೇರಿಸಲಾಗಿದೆ`);
        }
      }
    } else if (command.startsWith("remove player:")) {
      if (currentView === "setup") {
        const name = command.replace("remove player:", "").trim().toLowerCase();
        const playerToDelete = players.find(p => p.name.toLowerCase() === name);
        if (playerToDelete) {
          setPlayers((prev) => prev.filter((p) => p.id !== playerToDelete.id));
          if (language === "English") speakText(`Removed player ${playerToDelete.name}`);
          else if (language === "Hindi") speakText(`खिलाड़ी ${playerToDelete.name} को हटा दिया गया है`);
          else if (language === "Kannada") speakText(`ಆಟಗಾರ ${playerToDelete.name} ತೆಗೆದುಹಾಕಲಾಗಿದೆ`);
        }
      }
    } else if (command.startsWith("select player:")) {
      const name = command.replace("select player:", "").trim().toLowerCase();
      const found = players.find(p => p.name.toLowerCase() === name);
      if (found) {
        setSelectedPlayer(found);
        if (language === "English") speakText(`Selected ${found.name}. Choose Truth or Dare!`);
        else if (language === "Hindi") speakText(`${found.name} चुना गया। सच या साहस चुनें!`);
        else if (language === "Kannada") speakText(`${found.name} ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ. ಸತ್ಯ ಅಥವಾ ಧೈರ್ಯವನ್ನು ಆರಿಸಿ!`);
      }
    } else if (command === "play") {
      if (currentView === "setup") {
        handleStartGame();
      }
    } else if (command === "spin") {
      if (currentView === "wheel" && players.length > 0) {
        setSelectedPlayer(null); // Reset selection so we see the wheel spin clearly
        setSpinTrigger((prev) => prev + 1);
        if (language === "English") speakText("Spinning the wheel now! Let's see who's next.");
        else if (language === "Hindi") speakText("पहिया घूम रहा है! देखते हैं आगे कौन आता है।");
        else if (language === "Kannada") speakText("ಚಕ್ರ ತಿರುಗಿಸಲಾಗುತ್ತಿದೆ! ಮುಂದಿನ ಸರದಿ ಯಾರದು ನೋಡೋಣ.");
      }
    } else if (command === "truth" || command === "select truth") {
      if (currentView === "wheel" && selectedPlayer) {
        if (language === "English") speakText(`Generating truth challenge for ${selectedPlayer.name}`);
        else if (language === "Hindi") speakText(`${selectedPlayer.name} के लिए सत्य कार्य तैयार किया जा रहा है`);
        else if (language === "Kannada") speakText(`${selectedPlayer.name} ಗಾಗಿ ಸತ್ಯ ಸವಾಲನ್ನು ತಯಾರಿಸಲಾಗುತ್ತಿದೆ`);
        generateNewChallenge("Truth");
      }
    } else if (command === "dare" || command === "select dare") {
      if (currentView === "wheel" && selectedPlayer) {
        if (language === "English") speakText(`Generating dare challenge for ${selectedPlayer.name}`);
        else if (language === "Hindi") speakText(`${selectedPlayer.name} के लिए साहस कार्य तैयार किया जा रहा है`);
        else if (language === "Kannada") speakText(`${selectedPlayer.name} ಗಾಗಿ ಧೈರ್ಯ ಸವಾಲನ್ನು ತಯಾರಿಸಲಾಗುತ್ತಿದೆ`);
        generateNewChallenge("Dare");
      }
    } else if (command === "camera" || command === "open camera") {
      if (currentView === "challenge" && currentChallenge?.cameraVerification.enabled) {
        setCurrentView("camera");
        if (language === "English") speakText("AI Camera Assistant loaded. Please pose in front of your camera.");
        else if (language === "Hindi") speakText("कैमरा खुला। कृपया कैमरे के सामने अपनी मुद्रा बनाएं।");
        else if (language === "Kannada") speakText("ಕ್ಯಾಮೆರಾ ತೆರೆಯಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಕ್ಯಾಮೆರಾ ಮುಂದೆ ನಿಮ್ಮ ಭಂಗಿಯನ್ನು ತೋರಿಸಿ.");
      }
    } else if (command === "minigame" || command === "open game" || command === "arcade") {
      if (currentView === "challenge" && currentChallenge?.miniGame) {
        setCurrentView("minigame");
        if (language === "English") speakText("Mini Game loaded. Say play to start.");
        else if (language === "Hindi") speakText("मिनी गेम खुला। शुरू करने के लिए प्ले कहें।");
        else if (language === "Kannada") speakText("ಮಿನಿ ಗೇಮ್ ತೆರೆಯಲಾಗಿದೆ. ಪ್ರಾರಂಭಿಸಲು ಪ್ಲೇ ಎಂದು ಹೇಳಿ.");
      }
    } else if (command === "back" || command === "return" || command === "close") {
      if (currentView === "camera" || currentView === "minigame") {
        setCurrentView("challenge");
      }
    } else if (command === "complete" || command === "done") {
      if (currentView === "challenge") {
        submitRound();
      } else if (currentView === "camera") {
        handleCameraComplete(true);
      }
    } else if (command === "pass" || command === "skip") {
      if (currentView === "challenge") {
        speakEvent("round_passed");
        setCurrentView("wheel");
      } else if (currentView === "camera") {
        handleCameraComplete(false);
      }
    } else if (command.startsWith("custom:")) {
      const customPrompt = command.replace("custom:", "");
      generateNewChallenge(currentChallenge?.mode || "Truth", customPrompt);
    }
  };

  // Finish mini game
  const handleMiniGameComplete = (bonusPoints: number) => {
    setChallengeScore((prev) => prev + bonusPoints);
    setClaimedBonus((prev) => ({ ...prev, miniGame: true }));
    setCurrentView("challenge");
  };

  // Finish camera verification
  const handleCameraComplete = (claimed: boolean) => {
    if (claimed && currentChallenge) {
      setChallengeScore((prev) => prev + (currentChallenge.score.creativityBonus || 5));
      setClaimedBonus((prev) => ({ ...prev, camera: true }));
    }
    setCurrentView("challenge");
  };

  // Finish the entire challenge round, save points
  const submitRound = () => {
    if (selectedPlayer) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === selectedPlayer.id ? { ...p, score: p.score + challengeScore } : p
        )
      );
    }

    speakEvent("round_completed", {
      playerName: selectedPlayer?.name || "You",
      points: challengeScore
    });

    setCurrentChallenge(null);
    setIllustrationUrl(null);
    setSelectedPlayer(null); // Clear for the next round!
    setCurrentView("wheel");
  };

  const handleStartGame = () => {
    if (players.length < 2) {
      if (language === "English") speakText("Please add at least 2 players to start the game.");
      else if (language === "Hindi") speakText("कृपया खेल शुरू करने के लिए कम से कम 2 खिलाड़ियों को जोड़ें।");
      else if (language === "Kannada") speakText("ಆಟವನ್ನು ಪ್ರಾರಂಭಿಸಲು ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಇಬ್ಬರು ಆಟಗಾರರನ್ನು ಸೇರಿಸಿ.");
      return;
    }
    setCurrentView("wheel");
    if (language === "English") speakText("Welcome to TruthVerse AI! Squad game started. Say spin to rotate the wheel.");
    else if (language === "Hindi") speakText("ट्रुथवर्स AI में आपका स्वागत है! खेल शुरू हो गया है। पहिया घुमाने के लिए स्पिन कहें।");
    else if (language === "Kannada") speakText("ಟ್ರೂತ್‌ವರ್ಸ್ AI ಗೆ ಸುಸ್ವಾಗತ! ಆಟ ಪ್ರಾರಂಭವಾಗಿದೆ. ಚಕ್ರವನ್ನು ತಿರುಗಿಸಲು ಸ್ಪಿನ್ ಎಂದು ಹೇಳಿ.");
  };

  const resetEntireGame = () => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
    setCurrentChallenge(null);
    setSelectedPlayer(null);
    setCurrentView("setup");
  };

  // Challenge Timer Countdown (Manual progression only to ensure full player autonomy)
  useEffect(() => {
    if (currentView !== "challenge" || !currentChallenge || isLoading) return;

    const interval = setInterval(() => {
      setChallengeTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Just let the clock hit 0, no forced automated submissions
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentView, currentChallenge, isLoading]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Premium Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-sans font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                {t.title.toUpperCase()}
              </span>
              <span className="text-[9px] font-mono block text-indigo-400 tracking-wider">
                {t.subtitle.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView !== "setup" && (
              <button
                onClick={resetEntireGame}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-xs font-semibold text-slate-300 transition duration-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.backToChallengeBtn}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Core Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:py-10">
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-medium flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-xs font-mono underline hover:text-white ml-2">Dismiss</button>
          </div>
        )}

        {/* Handicap & Hands-Free Accessibility Banner */}
        <div className="mb-6 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Accessibility className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                ♿ Handicap & Hands-Free Play Mode
              </h4>
              <p className="text-xs text-slate-400">
                Disabled or physically restricted players can fully control this game using voice commands in English, Hindi, and Kannada.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowVoiceGuide(!showVoiceGuide)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap shadow-sm hover:shadow-indigo-500/10"
          >
            {showVoiceGuide ? "Hide Commands Reference" : "Show Commands Reference"}
          </button>
        </div>

        {showVoiceGuide && (
          <div className="mb-6 p-6 bg-slate-900/60 border border-slate-800 rounded-3xl animate-fade-in">
            <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Accessibility className="w-4 h-4 text-indigo-400 animate-bounce" />
              Hands-Free Play Voice Commands Reference
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                <div className="font-bold text-indigo-400 mb-2 uppercase tracking-wider font-mono text-[10px]">1. Setup Stage</div>
                <ul className="space-y-1.5 text-slate-300">
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Add player: [Name]"</span> — add player (Hindi: *add player [name]* / Kannada: *add player [name]*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Play"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Start"</span> — start TruthVerse (Hindi: *shuru*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Switch language"</span> — toggle voice language</li>
                </ul>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                <div className="font-bold text-pink-400 mb-2 uppercase tracking-wider font-mono text-[10px]">2. Wheel Selection</div>
                <ul className="space-y-1.5 text-slate-300">
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Spin"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Roll"</span> — visually spin the selection wheel (Hindi: *guma* / Kannada: *spin*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Select Truth"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Truth"</span> — choose Truth task (Hindi: *sach* / Kannada: *sathya*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Select Dare"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Dare"</span> — choose Dare task (Hindi: *himmat* / Kannada: *dare*)</li>
                </ul>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                <div className="font-bold text-emerald-400 mb-2 uppercase tracking-wider font-mono text-[10px]">3. Active Challenge</div>
                <ul className="space-y-1.5 text-slate-300">
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Complete"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Done"</span> — complete and score points (Hindi: *ho gaya* / Kannada: *purna*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Pass"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Skip"</span> — pass turn (Hindi: *chod* / Kannada: *skip*)</li>
                  <li>🗣️ <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Another"</span> or <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">"Harder"</span> — regenerate challenge with custom prompt</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 text-[10px] text-indigo-300 font-medium bg-indigo-500/5 p-2 rounded-xl border border-indigo-500/10 text-center">
              💡 **Accessibility Note**: Keep the **HANDS-FREE** toggle switch turned **ON** in the voice assistant panel to allow automatic continuous speech listening after the AI finishes speaking instructions!
            </div>
          </div>
        )}

        {/* 1. SETUP GAME VIEW */}
        {currentView === "setup" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in" id="setup-view">
            {/* Left Options Config Grid */}
            <div className="lg:col-span-7 space-y-6 bg-slate-900/40 border border-slate-900 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 text-white">
                <Users className="w-6 h-6 text-indigo-400" />
                {t.title}
              </h2>

              {/* Categories */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-2">
                  {t.selectCategoryHeader}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                        category === cat
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-2">
                  {t.selectLanguageHeader}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                        language === lang
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulties */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-slate-500 block mb-2">
                  {t.selectDifficultyHeader}
                </label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                        difficulty === diff
                          ? diff === "Easy"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : diff === "Medium"
                            ? "border-amber-500 bg-amber-500/10 text-amber-300"
                            : "border-rose-500 bg-rose-500/10 text-rose-300"
                          : "border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      {diff === "Easy" ? t.difficultyEasy : diff === "Medium" ? t.difficultyMedium : t.difficultyHard}
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch Button */}
              <button
                onClick={handleStartGame}
                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-md rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all duration-300 transform active:scale-98"
              >
                <Play className="w-5 h-5 fill-current" />
                {t.enterPlaygroundBtn.toUpperCase()}
              </button>
            </div>

            {/* Right Players Side Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl flex flex-col h-full">
                <h3 className="text-xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  {t.addPlayersHeader}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  {t.multiplayerDesc}
                </p>

                {/* Add Player Input */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    placeholder={t.enterNamePlaceholder}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm focus:outline-hidden text-slate-100 placeholder:text-slate-600"
                  />
                  <button
                    onClick={addPlayer}
                    className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition duration-300"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Roster List */}
                <div className="flex-1 overflow-y-auto max-h-72 space-y-2 pr-1">
                  {players.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 font-medium text-xs">
                      {t.enterNamePlaceholder}
                    </div>
                  ) : (
                    players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-900/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="font-bold text-sm text-slate-200">{p.name}</span>
                        </div>
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="p-1.5 text-slate-600 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SPIN WHEEL STAGE */}
        {currentView === "wheel" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in" id="spin-wheel-stage">
            {/* Left Wheel Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl text-center flex flex-col justify-center min-h-[500px]">
                <h2 className="text-xl font-extrabold tracking-tight text-white mb-1">
                  {t.assignedPlayerLabel}
                </h2>
                <p className="text-xs text-slate-500 font-medium mb-6">
                  {t.subtitle}
                </p>

                <div className="flex-1 flex items-center justify-center py-4">
                  <SpinningWheel
                    players={players}
                    spinTrigger={spinTrigger}
                    onWinnerSelected={(p) => {
                      setSelectedPlayer(p);
                      speakEvent("player_selected", { playerName: p.name });
                    }}
                  />
                </div>

                {selectedPlayer && (
                  <div className="mt-8 pt-6 border-t border-slate-800/80 animate-fade-in">
                    <div className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-3">
                      {t.assignedPlayerLabel}: <span className="font-bold underline">{selectedPlayer.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => generateNewChallenge("Truth")}
                        disabled={isLoading}
                        className="py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-indigo-500/10 transition transform active:scale-95 disabled:opacity-50"
                      >
                        {t.selectTruthBtn}
                      </button>
                      <button
                        onClick={() => generateNewChallenge("Dare")}
                        disabled={isLoading}
                        className="py-3.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-pink-500/10 transition transform active:scale-95 disabled:opacity-50"
                      >
                        {t.selectDareBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Panel - Scores Ledger Sidebar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl backdrop-blur-sm shadow-xl">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3.5 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-indigo-400 animate-pulse" />
                  {t.squadScoreboardHeader}
                </h4>
                <div className="space-y-2">
                  {players.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-600">No players added yet</div>
                  ) : (
                    [...players].sort((a, b) => b.score - a.score).map((p, index) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900/60 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500 font-bold">#{index + 1}</span>
                          <div
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-sm font-bold text-slate-300">{p.name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400 font-black">{p.score} pts</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. ACTIVE CHALLENGE VIEW */}
        {currentView === "challenge" && currentChallenge && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in" id="active-challenge-stage">
            {/* Left Challenge Core Card */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/40 border border-slate-900 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl relative overflow-hidden">
                {/* Horizontal Progress Bar Timer with icon */}
                <div className="mb-5 bg-slate-950/60 border border-slate-900 rounded-2xl p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-slate-300">
                      {handsFree ? "⏱️ HANDS-FREE TIMER" : "⏱️ TIME REMAINING"}
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        challengeTimer > 15 ? "bg-emerald-500" : challengeTimer > 7 ? "bg-amber-500" : "bg-rose-500 animate-pulse"
                      }`}
                      style={{ width: `${Math.min(100, (challengeTimer / (parseInt(currentChallenge.estimatedTime) || 45)) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-black ${challengeTimer <= 10 ? "text-rose-400 animate-pulse" : "text-slate-200"}`}>
                    {challengeTimer}s
                  </span>
                </div>

                <div className="absolute top-0 right-0 p-4 pt-16">
                  <span className={`text-[10px] uppercase font-mono tracking-wider font-extrabold px-3 py-1 rounded-full ${
                    currentChallenge.mode === "Truth"
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                  }`}>
                    {currentChallenge.mode === "Truth" ? t.selectTruthBtn.replace("🔮", "").trim() : t.selectDareBtn.replace("🔥", "").trim()}
                  </span>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: selectedPlayer?.color || "#6366f1" }}
                  />
                  <span className="font-bold text-sm text-slate-300">
                    {selectedPlayer?.name || "You"} - {t.turnLabel}
                  </span>
                </div>

                <h1 className="text-2xl font-black text-white tracking-tight mb-2">
                  {currentChallenge.title}
                </h1>
                
                <p className="text-slate-300 text-base font-medium leading-relaxed mb-6">
                  {currentChallenge.challenge}
                </p>

                {/* Funny tip */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl mb-6">
                  <div className="text-[10px] uppercase font-mono text-indigo-400 font-bold mb-1">
                    {t.protipLabel}
                  </div>
                  <div className="text-xs text-slate-400 italic">
                    "{currentChallenge.funnyHint}"
                  </div>
                </div>

                {/* Score Summary breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center bg-slate-950/30 p-3 rounded-2xl border border-slate-900">
                  <div>
                    <div className="text-[9px] uppercase font-mono text-slate-500">{t.baseRewardLabel}</div>
                    <div className="text-sm font-bold text-white">{currentChallenge.score.base} pts</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-mono text-slate-500">{t.poseBonusLabel}</div>
                    <div className="text-sm font-bold text-emerald-400">+{currentChallenge.score.creativityBonus || 5}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-mono text-slate-500">{t.timerBonusLabel}</div>
                    <div className="text-sm font-bold text-amber-400">+{currentChallenge.score.timeBonus || 5}</div>
                  </div>
                </div>
              </div>

              {/* Procedural Animation Component */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
                    {t.liveAnimationLabel}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {currentChallenge.animation.theme}
                  </span>
                </div>
                <CanvasAnimation javascriptCode={currentChallenge.animation.javascript} />
              </div>

              {/* Action finish button */}
              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => {
                    speakEvent("round_passed");
                    if (gameMode === "multi") {
                      setCurrentView("wheel");
                    } else {
                      generateNewChallenge("Truth");
                    }
                  }}
                  className="px-6 py-4 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-sm font-bold text-slate-300 transition"
                >
                  {t.passTurnBtn}
                </button>
                <button
                  onClick={submitRound}
                  className="flex-1 py-4 px-6 bg-emerald-500 hover:bg-emerald-600 font-black text-sm tracking-wide rounded-2xl shadow-lg shadow-emerald-500/20 text-white flex items-center justify-center gap-2 transition"
                >
                  {t.markCompletedBtn.toUpperCase()} (+{challengeScore} PTS)
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right Interactive Play Panels Grid */}
            <div className="lg:col-span-5 space-y-6">
              {/* Illustration Block */}
              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl backdrop-blur-sm shadow-xl flex flex-col justify-center text-center">
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-4">
                  {t.aiIllustrationHeader}
                </h4>
                {illustrationUrl ? (
                  <img
                    src={illustrationUrl}
                    alt="AI illustration"
                    referrerPolicy="no-referrer"
                    className="w-44 h-44 rounded-2xl mx-auto object-cover border border-slate-800 shadow-lg animate-fade-in"
                  />
                ) : (
                  <div className="border-2 border-dashed border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[140px] mb-4">
                    <p className="text-[11px] text-slate-500 max-w-xs italic mb-4 leading-relaxed">
                      "{currentChallenge.illustrationPrompt}"
                    </p>
                    <button
                      onClick={generateIllustration}
                      disabled={isGeneratingImg}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-[11px] text-white font-bold tracking-wide rounded-lg flex items-center gap-1.5 transition"
                    >
                      {isGeneratingImg ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {t.listeningState}...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          {t.aiIllustrationHeader}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* DARE Mode Bonus blocks */}
              {currentChallenge.mode === "Dare" && (
                <>
                  {/* Camera assistant bonus */}
                  {currentChallenge.cameraVerification.enabled && (
                    <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl backdrop-blur-sm shadow-xl relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Video className="w-4 h-4 text-emerald-400" />
                            {t.webCameraHeader}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {t.expectedPostureLabel}: <span className="text-emerald-400 font-bold">"{currentChallenge.cameraVerification.expectedPose}"</span>
                          </p>
                        </div>
                        <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          +{currentChallenge.score.creativityBonus || 5} pts
                        </span>
                      </div>

                      {claimedBonus.camera ? (
                        <div className="py-2.5 px-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-pulse">
                          <CheckCircle className="w-4 h-4" /> Camera posture bonus verified & added!
                        </div>
                      ) : (
                        <button
                          onClick={() => setCurrentView("camera")}
                          className="w-full mt-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-xl text-slate-200 hover:text-white transition"
                        >
                          {t.cameraBtn.toUpperCase()}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Mini-game block */}
                  <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl backdrop-blur-sm shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-amber-400 animate-bounce" />
                          {t.arcadeMiniGameHeader}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Play: <span className="text-amber-400 font-bold">"{currentChallenge.miniGame.name}"</span>
                        </p>
                      </div>
                      <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Up to +50 pts
                      </span>
                    </div>

                    {claimedBonus.miniGame ? (
                      <div className="py-2.5 px-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Dare mini-game points claimed!
                      </div>
                    ) : (
                      <button
                        onClick={() => setCurrentView("minigame")}
                        className="w-full mt-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-xl text-slate-200 hover:text-white transition"
                      >
                        {t.arcadeBtn.toUpperCase()}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Scores Ledger Sidebar */}
              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl backdrop-blur-sm shadow-xl">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3.5 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-indigo-400 animate-pulse" />
                  {t.squadScoreboardHeader}
                </h4>
                <div className="space-y-2">
                  {[...players].sort((a, b) => b.score - a.score).map((p, index) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900/60 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 font-bold">#{index + 1}</span>
                        <div
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-sm font-bold text-slate-300">{p.name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 font-black">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. CAMERA VIEWPORT OVERLAY */}
        {currentView === "camera" && currentChallenge && (
          <div className="max-w-md mx-auto animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentView("challenge")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.backToChallengeBtn}
              </button>
            </div>
            <CameraAssistant
              challenge={currentChallenge}
              onVerificationComplete={handleCameraComplete}
              lastVoiceCommand={lastVoiceCommand}
              handsFree={handsFree}
            />
          </div>
        )}

        {/* 5. MINI GAME ARCADE OVERLAY */}
        {currentView === "minigame" && currentChallenge && (
          <div className="max-w-md mx-auto animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentView("challenge")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.backToChallengeBtn}
              </button>
            </div>
            <MiniGamePlayground
              challenge={currentChallenge}
              onGameComplete={handleMiniGameComplete}
              lastVoiceCommand={lastVoiceCommand}
              handsFree={handsFree}
            />
          </div>
        )}
      </main>

      {/* Persistent global Voice Companion (keeps mic active continuously across transitions) */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-12 mt-4" id="global-speech-companion-container">
        <VoiceController
          onCommandReceived={handleVoiceCommand}
          language={language}
          voiceSuggestions={
            currentView === "setup"
              ? ["Add player: Chethan", "Switch language", "Enter playground", "Change to Hard difficulty"]
              : currentView === "wheel"
              ? selectedPlayer
                ? ["Select Truth", "Select Dare", "Switch language"]
                : ["Spin wheel", "Switch language"]
              : currentView === "challenge" && currentChallenge
              ? currentChallenge.voiceSuggestions
              : currentView === "camera"
              ? ["Complete", "Pass", "Back to challenge"]
              : currentView === "minigame"
              ? ["Done", "Back to challenge"]
              : ["Switch language"]
          }
          isSpeaking={isSpeaking}
          handsFree={handsFree}
          onHandsFreeChange={setHandsFree}
        />
      </div>

      {/* Loading Overlay spinner */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-900" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-extrabold text-white mb-2">{t.title} Loading...</h3>
          <p className="text-slate-400 text-xs max-w-xs leading-relaxed font-medium">
            {t.subtitle}
          </p>
        </div>
      )}

      {/* Futuristic footer credentials */}
      <footer className="border-t border-slate-950 bg-slate-950 py-6 text-center">
        <p className="text-[10px] font-mono text-slate-700 tracking-wider uppercase">
          TruthVerse AI • Engine v1.0 • Client Render Node
        </p>
      </footer>
    </div>
  );
}
