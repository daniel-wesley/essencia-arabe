'use client';

import { useState, useEffect, useCallback } from 'react';

const SLIDES = [
  '/images/bg-palace.jpg',
  '/images/bg-desert.jpg',
  '/images/bg-1.jpg',
  '/images/bg-2.jpg',
  '/images/bg-3.jpg',
  '/images/bg-4.jpg',
  '/images/bg-5.jpg',
];

const SLIDE_INTERVAL = 8000;

export default function BackgroundSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadedIndices, setLoadedIndices] = useState<number[]>([0]);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [next, paused]);

  useEffect(() => {
    const nextIdx = (current + 1) % SLIDES.length;
    setLoadedIndices((prev) => {
      if (prev.includes(current) && prev.includes(nextIdx)) return prev;
      const nextSet = new Set([...prev, current, nextIdx]);
      return Array.from(nextSet);
    });
  }, [current]);

  return (
    <>
      <div className="bg-slider-container">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`bg-slide${i === current ? ' active' : ''}`}
            style={loadedIndices.includes(i) ? { backgroundImage: `url(${src})` } : {}}
          />
        ))}
      </div>
      <div className="bg-overlay" />
      <div
        className="bg-switcher-controls"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`bg-indicator${i === current ? ' active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </>
  );
}
