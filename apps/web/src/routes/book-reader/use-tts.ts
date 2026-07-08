import { useState, useCallback, useRef } from 'react';

function pickVoice(lang?: string): SpeechSynthesisVoice | undefined {
  if (!lang) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const short = lang.split('-')[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(short)) ??
    undefined
  );
}

export interface UseTtsReturn {
  speaking: boolean;
  paused: boolean;
  rate: number;
  setRate: (rate: number) => void;
  speak: (text: string, lang?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  speakCurrentPage: () => void;
}

export function useTts(
  getRendition: () => any | null,
  epubLang?: string,
): UseTtsReturn {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1.0);
  const rateRef = useRef(1.0);

  const setRate = useCallback((r: number) => {
    const clamped = Math.min(2.0, Math.max(0.5, r));
    rateRef.current = clamped;
    setRateState(clamped);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const speak = useCallback(
    (text: string, lang?: string) => {
      if (!text.trim()) return;
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = rateRef.current;
        const voice = pickVoice(lang ?? epubLang);
        if (voice) utter.voice = voice;
        utter.onend = () => {
          setSpeaking(false);
          setPaused(false);
        };
        utter.onerror = () => {
          setSpeaking(false);
          setPaused(false);
        };
        window.speechSynthesis.speak(utter);
        setSpeaking(true);
        setPaused(false);
      }, 100);
    },
    [epubLang],
  );

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const speakCurrentPage = useCallback(() => {
    const rendition = getRendition();
    if (!rendition) return;
    try {
      const loc = rendition.currentLocation();
      if (!loc?.start?.href) return;
      const iframe = document.querySelector(`iframe[src*="${loc.start.href}"]`) as HTMLIFrameElement | null;
      if (!iframe?.contentDocument?.body) return;
      const paragraphs = iframe.contentDocument.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
      const texts: string[] = [];
      paragraphs.forEach((el) => {
        const t = el.textContent?.trim() ?? '';
        if (t.length >= 2) texts.push(t);
      });
      if (texts.length === 0) {
        const full = iframe.contentDocument.body.textContent?.trim() ?? '';
        if (full.length >= 2) texts.push(full);
      }
      if (texts.length > 0) speak(texts.join('\n'), epubLang);
    } catch {
      // silent
    }
  }, [getRendition, speak, epubLang]);

  return { speaking, paused, rate, setRate, speak, pause, resume, stop, speakCurrentPage };
}
