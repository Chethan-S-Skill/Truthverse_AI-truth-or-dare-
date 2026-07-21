import { useState, useEffect, useRef } from "react";
import { ChallengeData } from "../types";
import { Camera, RefreshCw, CheckCircle, ShieldAlert, Award } from "lucide-react";

interface CameraAssistantProps {
  challenge: ChallengeData;
  onVerificationComplete: (bonusClaimed: boolean) => void;
  lastVoiceCommand?: { command: string; timestamp: number } | null;
  handsFree?: boolean;
}

export default function CameraAssistant({ 
  challenge, 
  onVerificationComplete,
  lastVoiceCommand,
  handsFree = false
}: CameraAssistantProps) {
  const verification = challenge.cameraVerification;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "checking">("checking");
  const [confidence, setConfidence] = useState(0.12);
  const [verificationStatus, setVerificationStatus] = useState<"scanning" | "matched" | "failed">("scanning");
  const [scannerLineY, setScannerLineY] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Shutter / scanner beep synth
  const playSound = (type: "beep" | "success" | "click") => {
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

      if (type === "beep") {
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "success") {
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start();
        osc.stop(now + 0.3);
      } else {
        osc.frequency.setValueAtTime(1500, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.start();
        osc.stop(ctx.currentTime + 0.03);
      }
    } catch (e) {
      // Audio block safety
    }
  };

  const activeStreamRef = useRef<MediaStream | null>(null);

  // Start real webcam stream
  const startCamera = async () => {
    try {
      setCameraPermission("checking");

      // Stop any existing tracks before initializing new ones
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Explicit permission query to check state if browser supports it
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: "camera" as any });
          console.log("Camera permission state:", status.state);
          
          // If already denied, prevent hardware initialization request
          if (status.state === "denied") {
            setCameraPermission("denied");
            return;
          }
        } catch (pe) {
          console.warn("Permissions API query not supported for camera, requesting stream directly:", pe);
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      activeStreamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraPermission("granted");
    } catch (err) {
      console.warn("Camera hardware access denied or unavailable. Falling back to simulator:", err);
      setCameraPermission("denied");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Hardware released track on unmount:", track.label);
        });
      }
    };
  }, []);

  // Bind the camera stream to the video element and trigger auto-play
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch((err) => {
        console.warn("Auto-play prevented, waiting for user interaction:", err);
      });
    }
  }, [stream]);

  // Simulator loop for AI Scanning & Scanner Line sweep
  useEffect(() => {
    const sweepInterval = setInterval(() => {
      setScannerLineY((y) => (y >= 100 ? 0 : y + 2));
    }, 40);

    const scanInterval = setInterval(() => {
      if (verificationStatus !== "scanning") return;

      // Gradually increase confidence simulation
      setConfidence((prev) => {
        const increment = Math.random() * 0.15 + 0.05;
        const nextVal = Math.min(prev + increment, 0.96);

        playSound("beep");

        if (nextVal >= (verification.confidenceThreshold || 0.75)) {
          setVerificationStatus("matched");
          playSound("success");
          clearInterval(scanInterval);
          return nextVal;
        }
        return nextVal;
      });
    }, 800);

    return () => {
      clearInterval(sweepInterval);
      clearInterval(scanInterval);
    };
  }, [verificationStatus, verification.confidenceThreshold]);

  // Handle voice commands within Camera overlay
  useEffect(() => {
    if (!lastVoiceCommand) return;
    const { command } = lastVoiceCommand;
    if (command === "claim" || command === "complete" || command === "done") {
      if (verificationStatus === "matched") {
        handleClaimBonus();
      }
    } else if (command === "back" || command === "return" || command === "close") {
      handleSkipVerification();
    }
  }, [lastVoiceCommand, verificationStatus]);

  // Hands-free auto-claim once matched
  useEffect(() => {
    if (handsFree && verificationStatus === "matched") {
      const timer = setTimeout(() => {
        handleClaimBonus();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [handsFree, verificationStatus]);

  const handleClaimBonus = () => {
    onVerificationComplete(true);
  };

  const handleSkipVerification = () => {
    onVerificationComplete(false);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-950 text-white rounded-3xl p-6 border-4 border-emerald-500 shadow-2xl overflow-hidden" id="camera-assistant">
      {/* Scanner HUD Header */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
          <Camera className="w-4 h-4 animate-pulse" />
          <span className="tracking-wider uppercase">AI CAMERA ASSISTANT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            {verificationStatus === "scanning" ? "Scanning..." : "MATCHED 🟢"}
          </span>
        </div>
      </div>

      {/* Camera View Finder / Box */}
      <div className="w-full h-64 bg-slate-900 rounded-2xl relative overflow-hidden border border-slate-800">
        {cameraPermission === "granted" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          /* High quality procedural fallback representing full scanner state */
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 p-4 text-center select-none relative">
            <div className="absolute inset-0 bg-radial-grid opacity-30 pointer-events-none" />
            <div className="w-16 h-16 rounded-full border border-dashed border-emerald-500/30 flex items-center justify-center mb-3 animate-spin-slow">
              <Camera className="w-8 h-8 text-emerald-500/40" />
            </div>
            <div className="text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest mb-1">
              [HARDWARE BYPASS ACTIVE]
            </div>
            <div className="text-slate-500 text-[10px] max-w-xs font-medium">
              Simulated optical sensor analyzing local space for: <span className="text-slate-300 font-bold">"{verification.expectedPose || "Required movement"}"</span>
            </div>
          </div>
        )}

        {/* Laser Scanner overlay */}
        <div
          className="absolute w-full h-[2px] bg-emerald-500 shadow-[0_0_12px_#10b981] opacity-75 pointer-events-none transition-all duration-75"
          style={{ top: `${scannerLineY}%` }}
        />

        {/* AI target overlay points */}
        {verificationStatus === "scanning" && (
          <>
            <div className="absolute top-[25%] left-[50%] transform -translate-x-1/2 w-4 h-4 border-2 border-dashed border-cyan-400 rounded-full animate-ping" />
            <div className="absolute top-[35%] left-[30%] w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <div className="absolute top-[35%] left-[70%] w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <div className="absolute top-[60%] left-[40%] w-3 h-3 border border-emerald-400 rounded-sm animate-pulse" />
            <div className="absolute top-[60%] left-[60%] w-3 h-3 border border-emerald-400 rounded-sm animate-pulse" />
          </>
        )}

        {/* AI HUD Telemetry Box */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/75 border border-slate-800/80 rounded-xl p-2.5 backdrop-blur-md flex justify-between items-center z-10">
          <div>
            <div className="text-[9px] uppercase font-mono text-slate-500">Pose Goal</div>
            <div className="text-xs font-bold text-emerald-400 font-sans">
              {verification.expectedPose || "Stand still and pose!"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase font-mono text-slate-500">CONFIDENCE</div>
            <div className="text-sm font-black text-emerald-400 font-mono">
              {(confidence * 100).toFixed(0)}% <span className="text-slate-500 font-normal">/ {((verification.confidenceThreshold || 0.75) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex justify-between text-[10px] uppercase font-mono text-slate-400 mb-1 font-bold">
          <span>Target Alignment Analyzer</span>
          <span className="text-emerald-400">
            {verificationStatus === "scanning" ? "COMPUTING..." : "COMPLETED ✅"}
          </span>
        </div>
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              verificationStatus === "matched" ? "bg-emerald-500 animate-pulse" : "bg-cyan-500"
            }`}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3">
        {verificationStatus === "matched" ? (
          <button
            onClick={handleClaimBonus}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-bold text-sm tracking-wide text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition transform active:scale-95 animate-bounce"
          >
            <Award className="w-4 h-4" />
            POSE VERIFIED! CLAIM BONUS (+5)
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 p-3 bg-indigo-500/10 border border-indigo-400/20 rounded-2xl text-xs text-indigo-300 text-center animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin-slow text-indigo-400" />
            Analyze pose space... hold still to sync up joints automatically
          </div>
        )}

        <div className="flex gap-2">
          {cameraPermission !== "granted" && (
            <button
              onClick={startCamera}
              className="flex-1 py-2 px-4 rounded-xl border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-900 transition"
            >
              Retry Webcam Hardware
            </button>
          )}
          <button
            onClick={handleSkipVerification}
            className="flex-1 py-2 px-4 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 text-xs font-semibold transition"
          >
            Skip Scan Verification
          </button>
        </div>
      </div>
    </div>
  );
}
