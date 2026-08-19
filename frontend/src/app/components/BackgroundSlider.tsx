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

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [next, paused]);

  return (
    <>
      <div className="bg-slider-container">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`bg-slide${i === current ? ' active' : ''}`}
            style={{ backgroundImage: `url(${src})` }}
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
