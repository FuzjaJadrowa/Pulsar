import React, { useEffect, useRef } from "react";

export const DataSeaCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveOffsetBackRef = useRef(0);
  const waveOffsetFrontRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const body = document.body;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let rafId: number | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTimestamp: number | null = null;
    let isRunning = false;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const systemAllowsAnimation = () =>
      !document.hidden && !motionPreference.matches;
    const shouldAnimate = () =>
      systemAllowsAnimation() &&
      body.classList.contains("wave-page") &&
      body.classList.contains("zen-mode") &&
      body.classList.contains("idle-anim-enabled") &&
      !body.classList.contains("search-mode");

    const stopAnimation = () => {
      if (stopTimer !== null) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      isRunning = false;
      lastTimestamp = null;
      context.clearRect(0, 0, width, height);
    };

    const waveY = (
      x: number,
      base: number,
      amplitude: number,
      wavelength: number,
      offset: number,
    ) =>
      base +
      Math.sin(x / wavelength + offset) * amplitude +
      Math.sin(x / (wavelength * 0.55) + offset * 1.7) * amplitude * 0.35;

    const drawWave = (
      color: string,
      base: number,
      amplitude: number,
      wavelength: number,
      offset: number,
    ) => {
      const step = Math.max(10, Math.floor(width / 140));
      context.beginPath();
      context.moveTo(0, height);
      for (let x = 0; x <= width; x += step) {
        context.lineTo(x, waveY(x, base, amplitude, wavelength, offset));
      }
      const edgeY = waveY(width, base, amplitude, wavelength, offset);
      context.lineTo(width, edgeY);
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = color;
      context.fill();
    };

    const tick = (timestamp: number) => {
      rafId = null;
      if (!systemAllowsAnimation() || !isRunning) return;

      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = Math.min(60, timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      const backOffset = waveOffsetBackRef.current + 0.55 * delta;
      const frontOffset = waveOffsetFrontRef.current + 0.9 * delta;
      waveOffsetBackRef.current = backOffset;
      waveOffsetFrontRef.current = frontOffset;

      context.clearRect(0, 0, width, height);
      drawWave(
        "rgba(0, 150, 200, 0.4)",
        height * 0.45,
        height * 0.08,
        Math.max(180, width * 0.32),
        backOffset,
      );
      drawWave(
        "rgba(0, 120, 180, 1)",
        height * 0.58,
        height * 0.12,
        Math.max(160, width * 0.26),
        frontOffset,
      );

      rafId = window.requestAnimationFrame(tick);
    };

    const syncAnimation = () => {
      if (shouldAnimate()) {
        if (stopTimer !== null) {
          clearTimeout(stopTimer);
          stopTimer = null;
        }
        if (!isRunning) {
          resize();
          isRunning = true;
          lastTimestamp = null;
          rafId = window.requestAnimationFrame(tick);
        }
      } else if (!systemAllowsAnimation()) {
        stopAnimation();
      } else if (isRunning && stopTimer === null) {
        // Keep painting during CSS's slide-out so the wave can move below the viewport.
        stopTimer = setTimeout(stopAnimation, 650);
        if (rafId === null) rafId = window.requestAnimationFrame(tick);
      }
    };

    const observer = new MutationObserver(syncAnimation);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    const handleMotionPreferenceChange = () => syncAnimation();
    const handleVisibilityChange = () => syncAnimation();
    const handleResize = () => {
      if (shouldAnimate()) resize();
    };

    motionPreference.addEventListener("change", handleMotionPreferenceChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);
    syncAnimation();

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      stopAnimation();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="data-sea-canvas"
      className="zen-data-sea"
      aria-hidden="true"
    />
  );
};
