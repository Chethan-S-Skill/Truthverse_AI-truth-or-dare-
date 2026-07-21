import { useState, useRef, useEffect } from "react";
import { Player } from "../types";
import { Play, Sparkles } from "lucide-react";

interface SpinningWheelProps {
  players: Player[];
  onWinnerSelected: (player: Player) => void;
  spinTrigger?: number;
}

export default function SpinningWheel({ players, onWinnerSelected, spinTrigger }: SpinningWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<Player | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickAngleRef = useRef(0);
  const initialTriggerRef = useRef<number | null>(null);

  // Trigger spin when spinTrigger prop is incremented/changed by parent
  useEffect(() => {
    if (initialTriggerRef.current === null) {
      initialTriggerRef.current = spinTrigger || 0;
      return;
    }
    if (spinTrigger && spinTrigger > initialTriggerRef.current && !isSpinning) {
      handleSpin();
    }
  }, [spinTrigger]);

  // Sound generator for the tactile tick effect
  const playTickSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio context block browser safety fallback
    }
  };

  const handleSpin = () => {
    if (isSpinning || players.length === 0) return;

    setIsSpinning(true);
    setWinner(null);

    // Random winner index
    const winnerIndex = Math.floor(Math.random() * players.length);
    const selectedPlayer = players[winnerIndex];

    const numSlices = players.length;
    const sliceAngle = 360 / numSlices;
    
    // We want the winner slice to end up at the very top (270 degrees pointer)
    // The slice 'winnerIndex' is centered at: winnerIndex * sliceAngle + (sliceAngle / 2)
    // To align it with the pointer at 270 degrees, we rotate the wheel by:
    // targetRotation = 270 - sliceCenterAngle
    const sliceCenterAngle = winnerIndex * sliceAngle + sliceAngle / 2;
    const offset = (270 - sliceCenterAngle + 360) % 360;

    // Spin 5 to 8 full rotations for visual excitement
    const randomRotations = (5 + Math.floor(Math.random() * 4)) * 360;
    const finalRotation = rotation + randomRotations + offset;

    // Track audio ticks during spin transition
    let startTimestamp: number | null = null;
    const duration = 4000; // 4 seconds animation

    const tickAnimation = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = timestamp - startTimestamp;

      // Ease-out cubic formula
      const t = Math.min(progress / duration, 1);
      const easeOut = 1 - Math.pow(1 - t, 3);
      const currentRotation = rotation + (finalRotation - rotation) * easeOut;

      setRotation(currentRotation);

      // Trigger click sound when we pass through slice boundaries
      const currentAngle = currentRotation % 360;
      if (Math.abs(currentAngle - lastTickAngleRef.current) > sliceAngle) {
        playTickSound();
        lastTickAngleRef.current = currentAngle;
      }

      if (t < 1) {
        requestAnimationFrame(tickAnimation);
      } else {
        setIsSpinning(false);
        setWinner(selectedPlayer);
        // Play success tone
        playTickSound();
        setTimeout(() => {
          onWinnerSelected(selectedPlayer);
        }, 1200);
      }
    };

    requestAnimationFrame(tickAnimation);
  };

  const sliceAngle = 360 / players.length;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4" id="spinning-wheel-section">
      <div className="relative w-72 h-72 md:w-80 md:h-80">
        {/* Top Pointer Indicator */}
        <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 z-30 filter drop-shadow-md">
          <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-rose-500" />
          <div className="w-2 h-2 bg-white rounded-full absolute top-[-6px] left-1/2 transform -translate-x-1/2" />
        </div>

        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-8 border-slate-900 bg-slate-900 shadow-xl overflow-hidden flex items-center justify-center">
          {/* Slices Canvas / SVG */}
          <svg
            className="w-full h-full transform transition-transform duration-75"
            style={{ transform: `rotate(${rotation}deg)` }}
            viewBox="0 0 200 200"
          >
            <defs>
              <shadow id="slice-shadow">
                <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodOpacity="0.3" />
              </shadow>
            </defs>
            {players.map((player, idx) => {
              const startAngle = idx * sliceAngle - 90; // Offset by -90 to start top
              const endAngle = startAngle + sliceAngle;
              const radStart = (startAngle * Math.PI) / 180;
              const radEnd = (endAngle * Math.PI) / 180;

              // Outer boundary coordinates
              const x1 = 100 + 100 * Math.cos(radStart);
              const y1 = 100 + 100 * Math.sin(radStart);
              const x2 = 100 + 100 * Math.cos(radEnd);
              const y2 = 100 + 100 * Math.sin(radEnd);

              // SVG Path for slice sector
              const pathData = `
                M 100 100
                L ${x1} ${y1}
                A 100 100 0 ${sliceAngle > 180 ? 1 : 0} 1 ${x2} ${y2}
                Z
              `;

              // Position for text labels
              const textAngle = startAngle + sliceAngle / 2;
              const radText = (textAngle * Math.PI) / 180;
              const tx = 100 + 60 * Math.cos(radText);
              const ty = 100 + 60 * Math.sin(radText);

              return (
                <g key={player.id}>
                  <path
                    d={pathData}
                    fill={player.color}
                    className="stroke-slate-900 stroke-[1.5px]"
                  />
                  <text
                    x={tx}
                    y={ty}
                    transform={`rotate(${textAngle}, ${tx}, ${ty})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    className="font-sans font-bold text-[9px] select-none tracking-wide"
                  >
                    {player.name.length > 8 ? `${player.name.substring(0, 7)}...` : player.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Golden Center Hub */}
          <div className="absolute w-12 h-12 bg-amber-400 rounded-full border-4 border-slate-900 flex items-center justify-center z-20 shadow-md">
            <Sparkles className="w-5 h-5 text-slate-900 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs">
        <button
          onClick={handleSpin}
          disabled={isSpinning}
          id="spin-button"
          className={`w-full py-4 px-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all duration-300 transform active:scale-95 ${
            isSpinning
              ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
              : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/20"
          }`}
        >
          <Play className={`w-5 h-5 fill-current ${isSpinning ? "animate-spin" : ""}`} />
          {isSpinning ? "Spinning..." : "SPIN THE WHEEL!"}
        </button>

        {winner && (
          <div className="mt-2 text-center animate-bounce bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl text-sm font-semibold">
            🎯 Selected: <span className="font-bold underline">{winner.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
