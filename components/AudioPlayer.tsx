// Audio player — custom play/pause/progress bar for audiobook previews on product pages
'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  title: string;
  // Optional listen-tracking hooks. AudioPlayer is also used for tiny preview
  // clips elsewhere, so we keep these optional — the product page wires them
  // for audiobooks, other callers leave them off.
  onListenStart?: () => void;
  onListenComplete?: () => void;
}

export default function AudioPlayer({ src, title, onListenStart, onListenComplete }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // Fire start/complete exactly once per mount so a noisy user mashing play/
  // pause/seek doesn't spam the API. Re-mounting (e.g. navigating to a
  // different audiobook) resets these.
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => { setDuration(audio.duration); setLoading(false); };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // 90% threshold fires complete even if the user skips the last few
      // seconds of an audiobook. Guard with completedRef so it only fires
      // once per mount.
      if (
        !completedRef.current &&
        onListenComplete &&
        audio.duration > 0 &&
        isFinite(audio.duration) &&
        audio.currentTime / audio.duration >= 0.9
      ) {
        completedRef.current = true;
        try { onListenComplete(); } catch { /* swallow — UI side-effect only */ }
      }
    };
    const onEnded = () => {
      setPlaying(false);
      if (!completedRef.current && onListenComplete) {
        completedRef.current = true;
        try { onListenComplete(); } catch { /* swallow */ }
      }
    };
    const onError = () => { setError(true); setLoading(false); };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [onListenComplete]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || error) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else {
      audio.play().then(() => {
        setPlaying(true);
        if (!startedRef.current && onListenStart) {
          startedRef.current = true;
          try { onListenStart(); } catch { /* swallow */ }
        }
      }).catch(() => setError(true));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  if (error) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center text-sm text-purple-500">
        <div className="text-2xl mb-1">🎧</div>
        <p className="font-bold">Preview coming soon</p>
        <p className="text-xs text-purple-400 mt-1">Audio sample will be available shortly</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-4 text-white">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl shrink-0">🎧</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">Preview: {title}</p>
          <p className="text-purple-300 text-xs">Sample clip</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={loading}
          className="w-10 h-10 bg-white text-purple-800 rounded-full flex items-center justify-center font-black text-lg shrink-0 hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {loading ? '⌛' : playing ? '⏸' : '▶'}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-yellow-400 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-purple-300 mt-0.5">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
