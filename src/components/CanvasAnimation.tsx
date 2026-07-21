import { useEffect, useRef } from "react";

interface CanvasAnimationProps {
  javascriptCode: string;
}

export default function CanvasAnimation({ javascriptCode }: CanvasAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make canvas display resolution match its CSS dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth || 400;
      canvas.height = canvas.clientHeight || 300;
    };
    resizeCanvas();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const activeFrameIds: number[] = [];
    const originalRAF = window.requestAnimationFrame;
    const originalCAF = window.cancelAnimationFrame;

    // Track requestAnimationFrame calls
    const localRAF = (cb: FrameRequestCallback) => {
      const id = originalRAF(cb);
      activeFrameIds.push(id);
      return id;
    };

    // Track cancelAnimationFrame calls
    const localCAF = (id: number) => {
      originalCAF(id);
      const index = activeFrameIds.indexOf(id);
      if (index !== -1) {
        activeFrameIds.splice(index, 1);
      }
    };

    // Override global RAF temporarily for execution context
    window.requestAnimationFrame = localRAF;
    window.cancelAnimationFrame = localCAF;

    try {
      // Clear canvas before running new animation
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Generate executable function where canvas and ctx are accessible,
      // and override RAF/CAF inside the local function scope to enforce cancellation.
      const runCode = new Function(
        "canvas",
        "ctx",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        `
        try {
          ${javascriptCode}
        } catch (e) {
          console.error("Procedural animation error:", e);
        }
        `
      );

      runCode(canvas, ctx, localRAF, localCAF);
    } catch (err) {
      console.error("Canvas evaluation failed:", err);
    }

    // Restore standard window functions
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;

    return () => {
      window.requestAnimationFrame = originalRAF;
      window.cancelAnimationFrame = originalCAF;
      activeFrameIds.forEach((id) => originalCAF(id));
    };
  }, [javascriptCode]);

  return (
    <div className="w-full h-64 md:h-72 relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shadow-inner">
      <canvas
        ref={canvasRef}
        id="animation-canvas"
        className="w-full h-full block"
      />
      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/60 text-white rounded text-[10px] font-mono tracking-wider backdrop-blur-xs">
        HTML5 CANVAS ENGINE
      </div>
    </div>
  );
}
