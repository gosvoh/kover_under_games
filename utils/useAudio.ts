"use client";
import { useEffect, useRef, useState } from "react";

export function useAudio(url: string, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generation = useRef({ value: 0 });
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const audio = new Audio(url);
    audio.loop = true;
    audioRef.current = audio;
    const playback = generation.current;
    return () => {
      playback.value++;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function toggle(enabled: boolean) {
    const audio = audioRef.current;
    if (!audio) return;
    const current = ++generation.current.value;
    setError("");
    if (!enabled) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      if (current === generation.current.value) setPlaying(true);
    } catch {
      if (current === generation.current.value) {
        setPlaying(false);
        setError("Не удалось включить музыку. Проверьте разрешение браузера на воспроизведение.");
      }
    }
  }
  return { playing, toggle, error };
}
