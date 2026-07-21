import React, { useState, useEffect, useRef } from "react";
import { ChallengeData } from "../types";
import { Award, Timer, Target, HelpCircle, RotateCcw } from "lucide-react";

interface MiniGamePlaygroundProps {
  challenge: ChallengeData;
  onGameComplete: (score: number) => void;
  lastVoiceCommand?: { command: string; timestamp: number } | null;
  handsFree?: boolean;
}

interface GameObject {
  id: number;
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  emoji: string;
  color: string;
}

export default function MiniGamePlayground({ 
  challenge, 
  onGameComplete,
  lastVoiceCommand,
  handsFree = false
}: MiniGamePlaygroundProps) {
  const miniGame = challenge.miniGame;
  const duration = parseInt(miniGame.duration) || 15;
  
  const [timeLeft, setTimeLeft] = useState(duration);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "playing" | "ended">("ready");
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [basketX, setBasketX] = useState(50); // percentage 0-100 for catching games
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthetic sound effect
  const playSound = (type: "pop" | "point" | "avoid" | "victory") => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "pop") {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "avoid") {
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === "victory") {
        // Simple little arpeggio
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start();
        osc.stop(now + 0.5);
      } else {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      // Ignored browser audio policy
    }
  };

  // Determine game mechanics based on game name
  const nameLower = (miniGame.name || "").toLowerCase();
  const isCatchingGame = nameLower.includes("catch") || nameLower.includes("falling") || nameLower.includes("avoid");
  const isAvoidGame = nameLower.includes("avoid");

  const startMiniGame = () => {
    setScore(0);
    setTimeLeft(duration);
    setGameState("playing");
    setObjects([]);
    playSound("pop");
  };

  // Game tick for physics of falling or floating objects
  useEffect(() => {
    if (gameState !== "playing") return;

    let idCounter = 0;
    const interval = setInterval(() => {
      // Spawn new object
      const isBanana = nameLower.includes("banana");
      const emojiOptions = isBanana 
        ? ["🍌", "🍌", "🍎", "🍍", "💣"] 
        : ["⭐", "🎈", "🎈", "💎", "👾", "❤️"];
      const randomEmoji = emojiOptions[Math.floor(Math.random() * emojiOptions.length)];

      const newObj: GameObject = {
        id: idCounter++,
        x: Math.random() * 90 + 5, // percentage x coordinate
        y: isCatchingGame ? 0 : 100, // Top for falling, bottom for floating
        size: Math.random() * 15 + 25, // dimensions
        speedY: isCatchingGame 
          ? (Math.random() * 2 + 2) // Falls down
          : -(Math.random() * 2 + 1.5), // Floats up
        speedX: (Math.random() - 0.5) * 1.5,
        emoji: randomEmoji,
        color: ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6"][Math.floor(Math.random() * 5)]
      };

      setObjects((prev) => [...prev, newObj]);
    }, 450);

    // Timer countdown
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState("ended");
          playSound("victory");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, [gameState, miniGame.name]);

  // Animation Loop for Moving Game Objects
  useEffect(() => {
    if (gameState !== "playing") return;

    const updatePhysics = () => {
      setObjects((prevObjects) => {
        return prevObjects
          .map((obj) => ({
            ...obj,
            y: obj.y + obj.speedY,
            x: obj.x + obj.speedX
          }))
          .filter((obj) => {
            // Filter out-of-bounds items
            if (isCatchingGame) {
              // Collision check for catching game
              if (obj.y >= 85 && obj.y <= 92) {
                const diffX = Math.abs(obj.x - basketX);
                if (diffX < 12) {
                  // Caught!
                  if (obj.emoji === "💣") {
                    playSound("avoid");
                    setScore((s) => Math.max(0, s - 10));
                  } else if (isAvoidGame && obj.emoji === "🍌") {
                    // Oops, hit!
                    playSound("avoid");
                    setScore((s) => Math.max(0, s - 5));
                  } else {
                    playSound("point");
                    setScore((s) => s + 5);
                  }
                  return false; // remove object
                }
              }
              return obj.y < 100;
            } else {
              // Floating balloon popping boundary
              return obj.y > -10;
            }
          });
      });
      requestRef.current = requestAnimationFrame(updatePhysics);
    };

    requestRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, basketX, isCatchingGame, isAvoidGame]);

  // Hands-free state transition hooks (ready -> playing -> ended -> claim)
  useEffect(() => {
    if (!handsFree) return;

    if (gameState === "ready") {
      // Auto-start after a brief guidance delay
      const timer = setTimeout(() => {
        startMiniGame();
      }, 4000);
      return () => clearTimeout(timer);
    } else if (gameState === "ended") {
      // Auto-claim after some celebrate buffer
      const timer = setTimeout(() => {
        handleClaimPoints();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [handsFree, gameState]);

  // Voice Command Subscription within Game Overlay
  useEffect(() => {
    if (!lastVoiceCommand) return;
    const { command } = lastVoiceCommand;

    if (gameState === "ready") {
      if (command === "start" || command === "play") {
        startMiniGame();
      }
    } else if (gameState === "playing") {
      if (command === "left") {
        setBasketX((x) => Math.max(5, x - 15));
      } else if (command === "right") {
        setBasketX((x) => Math.min(95, x + 15));
      } else if (command === "tap" || command === "pop") {
        if (!isCatchingGame) {
          // Pop lowest floating balloon
          setObjects((prev) => {
            const target = prev.filter(o => o.emoji !== "👾").sort((a, b) => a.y - b.y)[0];
            if (target) {
              playSound("pop");
              setScore((s) => s + 10);
              return prev.filter((o) => o.id !== target.id);
            }
            return prev;
          });
        }
      } else if (command === "back" || command === "return" || command === "close") {
        onGameComplete(0);
      }
    } else if (gameState === "ended") {
      if (command === "claim" || command === "complete" || command === "done") {
        handleClaimPoints();
      }
    }
  }, [lastVoiceCommand, gameState, isCatchingGame]);

  // Hands-free auto-pop timer for balloon popping game
  useEffect(() => {
    if (gameState !== "playing" || isCatchingGame || !handsFree) return;

    const autoPopInterval = setInterval(() => {
      setObjects((prev) => {
        const target = prev.find((o) => o.emoji !== "👾");
        if (target) {
          playSound("pop");
          setScore((s) => s + 10);
          return prev.filter((o) => o.id !== target.id);
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(autoPopInterval);
  }, [gameState, handsFree, isCatchingGame]);

  // Hands-free auto-steer loop for Catching game
  useEffect(() => {
    if (gameState !== "playing" || !isCatchingGame || !handsFree) return;
    
    const steerInterval = setInterval(() => {
      setObjects((currentObjects) => {
        // Find closest item falling towards the bottom (largest y coordinate < 85)
        const candidates = currentObjects.filter(
          (o) => o.emoji !== "💣" && (!isAvoidGame || o.emoji !== "🍌") && o.y < 85
        );
        if (candidates.length > 0) {
          const target = candidates.reduce((highest, current) => 
            current.y > highest.y ? current : highest, candidates[0]
          );
          
          setBasketX((currentBasketX) => {
            const diff = target.x - currentBasketX;
            const step = 2.5; // smooth movement step size
            if (Math.abs(diff) < step) return target.x;
            return currentBasketX + Math.sign(diff) * step;
          });
        }
        return currentObjects;
      });
    }, 30); // ~33fps steering ticks

    return () => clearInterval(steerInterval);
  }, [gameState, isCatchingGame, handsFree, isAvoidGame]);

  const handleObjectTap = (id: number, emoji: string) => {
    if (gameState !== "playing" || isCatchingGame) return;

    playSound("pop");
    if (emoji === "👾") {
      setScore((s) => Math.max(0, s - 5));
    } else {
      setScore((s) => s + 10);
    }
    setObjects((prev) => prev.filter((o) => o.id !== id));
  };

  const handleBasketMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== "playing" || !isCatchingGame || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const xPos = ((clientX - rect.left) / rect.width) * 100;
    setBasketX(Math.min(Math.max(xPos, 5), 95));
  };

  // Submit final score
  const handleClaimPoints = () => {
    // Basic scoring mapping: Max score capping
    const finalEarned = Math.min(score, 50);
    onGameComplete(finalEarned);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 text-white rounded-3xl p-6 border-4 border-indigo-500 shadow-2xl relative overflow-hidden" id="mini-game-playground">
      {/* HUD Header */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-sm">
          <Target className="w-4 h-4 animate-spin-slow" />
          <span className="uppercase tracking-wider">{miniGame.name || "Mini Game"}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-full text-amber-400 font-mono text-sm font-bold">
            <Award className="w-4 h-4 text-amber-400" />
            {score}
          </div>
          <div className="flex items-center gap-1 bg-rose-500/20 px-2.5 py-1 rounded-full text-rose-400 font-mono text-sm font-bold">
            <Timer className="w-4 h-4 text-rose-400" />
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Game Stage Area */}
      <div
        ref={containerRef}
        className="w-full h-80 bg-slate-950 rounded-2xl relative overflow-hidden cursor-crosshair select-none border border-slate-800"
        onMouseMove={handleBasketMove}
        onTouchMove={handleBasketMove}
      >
        {gameState === "ready" && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 border border-indigo-400/30">
              <HelpCircle className="w-8 h-8 text-indigo-400 animate-bounce" />
            </div>
            <h4 className="text-xl font-extrabold text-indigo-300 mb-2">Ready to play?</h4>
            <p className="text-slate-400 text-xs max-w-xs mb-6 font-medium leading-relaxed">
              {miniGame.instructions || "Tap or catch objects to win bonus points!"}
            </p>
            <button
              onClick={startMiniGame}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 font-bold text-sm rounded-full tracking-wider transition duration-300 shadow-lg shadow-indigo-500/20"
            >
              START CHALLENGE
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <>
            {/* Background elements */}
            <div className="absolute top-4 left-4 text-[10px] font-mono text-slate-800 select-none uppercase">
              {isCatchingGame ? "Slide Finger to Catch / Avoid" : "Tap items to POP"}
            </div>

            {/* Game interactive objects */}
            {objects.map((obj) => (
              <button
                key={obj.id}
                onClick={() => handleObjectTap(obj.id, obj.emoji)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 text-3xl transition-transform active:scale-150 animate-pulse cursor-pointer p-2 filter drop-shadow-md select-none"
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  fontSize: `${obj.size}px`
                }}
              >
                {obj.emoji}
              </button>
            ))}

            {/* Basket (Catching games only) */}
            {isCatchingGame && (
              <div
                className="absolute bottom-4 h-8 px-4 rounded-full bg-indigo-500 border border-indigo-300 shadow-md flex items-center justify-center transform -translate-x-1/2 transition-all duration-75 select-none"
                style={{ left: `${basketX}%` }}
              >
                <div className="text-lg font-bold">🛒</div>
                {isAvoidGame && <div className="absolute -top-6 text-[10px] text-rose-400 font-bold animate-pulse">AVOID 🍌/💣</div>}
              </div>
            )}
          </>
        )}

        {gameState === "ended" && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
            <h4 className="text-2xl font-extrabold text-amber-400 mb-2">Time's Up! 🏁</h4>
            <div className="text-slate-400 text-sm mb-4">You completed the dare mini-game!</div>
            <div className="bg-slate-800 px-6 py-3 rounded-2xl mb-6">
              <div className="text-[10px] uppercase font-mono text-slate-400">Total Score</div>
              <div className="text-3xl font-extrabold text-amber-400">{score} pts</div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={startMiniGame}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-full border border-slate-700 hover:scale-105 transition-all"
                title="Restart"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handleClaimPoints}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-sm rounded-full tracking-wider transition duration-300 shadow-lg shadow-emerald-500/20"
              >
                CLAIM {score} POINTS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
