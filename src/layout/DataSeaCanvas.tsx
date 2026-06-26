import React, { useEffect, useRef } from "react";
import { useConfig } from "../services/config";

interface DataSeaCanvasProps {
  currentPage: string;
}

export const DataSeaCanvas: React.FC<DataSeaCanvasProps> = ({ currentPage }) => {
  const { config } = useConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId: number | null = null;
    let lastTs: number | null = null;
    let waveOffsetBack = 0;
    let waveOffsetFront = 0;

    const backSpeed = 0.55;
    const frontSpeed = 0.9;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener("resize", resize);
    resize();

    const isWavePage = ["home", "downloader", "converter", "compressor"].includes(currentPage);
    const isSearchMode = document.body.classList.contains("search-mode");
    const isIdleAnimEnabled = config.idle_animation;

    const isActive = isWavePage && isIdleAnimEnabled && !isSearchMode;

    const waveY = (x: number, base: number, amplitude: number, wavelength: number, offset: number) => {
      return (
        base +
        Math.sin(x / wavelength + offset) * amplitude +
        Math.sin(x / (wavelength * 0.55) + offset * 1.7) * amplitude * 0.35
      );
    };

    const drawWave = (color: string, base: number, amplitude: number, wavelength: number, offset: number) => {
      const step = Math.max(10, Math.floor(width / 140));
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += step) {
        const y = waveY(x, base, amplitude, wavelength, offset);
        ctx.lineTo(x, y);
      }
      const edgeY = waveY(width, base, amplitude, wavelength, offset);
      ctx.lineTo(width, edgeY);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const tick = (ts: number) => {
      if (!isActive) return;
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(60, ts - lastTs) / 1000;
      lastTs = ts;

      waveOffsetBack += backSpeed * dt;
      waveOffsetFront += frontSpeed * dt;

      ctx.clearRect(0, 0, width, height);

      const backBase = height * 0.45;
      const frontBase = height * 0.58;
      const backAmp = height * 0.08;
      const frontAmp = height * 0.12;
      const backWavelength = Math.max(180, width * 0.32);
      const frontWavelength = Math.max(160, width * 0.26);

      drawWave("rgba(0, 150, 200, 0.4)", backBase, backAmp, backWavelength, waveOffsetBack);
      drawWave("rgba(0, 120, 180, 1)", frontBase, frontAmp, frontWavelength, waveOffsetFront);

      rafId = window.requestAnimationFrame(tick);
    };

    if (isActive) {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [currentPage, config.idle_animation]);

  return <canvas ref={canvasRef} id="data-sea-canvas" className="zen-data-sea" aria-hidden="true" />;
};