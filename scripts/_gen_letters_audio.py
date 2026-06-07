"""
Generate 26 letter-sound MP3 clips for Mamma's Place Letters & Sounds.
Primary engine: XTTS v2 (Coqui) cloned from Bedtime Explorers reference voice.
Outputs: <repo>/public/letters-audio/<a-z>.mp3

TEMP script — not committed. Reuses the BedtimeExplorers XTTS invocation pattern.
"""
import os
import json
import subprocess
import sys

# ── ffmpeg setup (same as BedtimeExplorers/produce_all.py) ───────────────────
FFMPEG_DIR = r"C:\Users\dglazier\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
FFMPEG = os.path.join(FFMPEG_DIR, "ffmpeg.exe")
FFPROBE = os.path.join(FFMPEG_DIR, "ffprobe.exe")

import pydub.utils as _pu
import pydub.audio_segment as _pas
from pydub import AudioSegment
AudioSegment.converter = FFMPEG

def _mediainfo_patched(filepath, read_ahead_limit=-1):
    cmd = [FFPROBE, "-v", "quiet", "-print_format", "json",
           "-show_format", "-show_streams", filepath]
    res = subprocess.run(cmd, capture_output=True)
    return json.loads(res.stdout)
_pu.mediainfo_json = _mediainfo_patched
_pas.mediainfo_json = _mediainfo_patched

# ── XTTS settings (same as BedtimeExplorers) ─────────────────────────────────
BE_ROOT = r"C:\Users\dglazier\source\Personal\BedtimeExplorers"
REFERENCE_VOICE = os.path.join(BE_ROOT, "assets", "tts-model", "reference-voice.mp3")
TTS_SPEED = 0.9
TTS_LANGUAGE = "en"
SEGMENT_TRIM_MS = 80  # XTTS junk syllable at start

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "letters-audio")
OUT_DIR = os.path.abspath(OUT_DIR)
TMP_DIR = os.path.join(os.path.dirname(__file__), "_tmp_letters_wav")
TMP_DIR = os.path.abspath(TMP_DIR)

# ── Letter scripts: name + sound modeled in a word ───────────────────────────
WORDS = {
    "a": ("apple",    "Aaa"),
    "b": ("ball",     "Buh"),
    "c": ("cat",      "Cuh"),
    "d": ("dog",      "Duh"),
    "e": ("egg",      "Eh"),
    "f": ("fish",     "Fff"),
    "g": ("goat",     "Guh"),
    "h": ("hat",      "Huh"),
    "i": ("igloo",    "Ih"),
    "j": ("jam",      "Juh"),
    "k": ("kite",     "Kuh"),
    "l": ("lion",     "Lll"),
    "m": ("moon",     "Mmm"),
    "n": ("nest",     "Nnn"),
    "o": ("octopus",  "Ah"),
    "p": ("pig",      "Puh"),
    "q": ("queen",    "Kwuh"),
    "r": ("rabbit",   "Rrr"),
    "s": ("sun",      "Sss"),
    "t": ("top",      "Tuh"),
    "u": ("umbrella", "Uh"),
    "v": ("van",      "Vvv"),
    "w": ("web",      "Wuh"),
    "x": ("fox",      "Cks"),
    "y": ("yo-yo",    "Yuh"),
    "z": ("zebra",    "Zzz"),
}

def line_for(letter):
    word, snd = WORDS[letter]
    return f"{letter.upper()}. {letter.upper()} is for {word}. {snd}, {snd}, {word}."

# ── XTTS loader ──────────────────────────────────────────────────────────────
_tts = None
def get_tts():
    global _tts
    if _tts is None:
        os.environ["COQUI_TOS_AGREED"] = "1"
        from TTS.api import TTS
        print("Loading XTTS v2 model...", flush=True)
        _tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
        print("XTTS ready.\n", flush=True)
    return _tts

def synth_wav(tts, text, out_wav):
    tts.tts_to_file(
        text=text,
        speaker_wav=REFERENCE_VOICE,
        language=TTS_LANGUAGE,
        file_path=out_wav,
        speed=TTS_SPEED,
    )

def wav_to_mp3(wav_path, mp3_path):
    # Trim junk syllable from start, normalize, export as mp3
    seg = AudioSegment.from_file(wav_path)
    if len(seg) > SEGMENT_TRIM_MS:
        seg = seg[SEGMENT_TRIM_MS:]
    seg = seg + 2  # slight warmth boost, matches BE process
    seg.export(mp3_path, format="mp3", bitrate="128k")

def ffprobe_duration(path):
    cmd = [FFPROBE, "-v", "quiet", "-print_format", "json",
           "-show_format", path]
    res = subprocess.run(cmd, capture_output=True)
    try:
        data = json.loads(res.stdout)
        return float(data["format"]["duration"])
    except Exception:
        return 0.0

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)
    tts = get_tts()

    results = []
    for letter in "abcdefghijklmnopqrstuvwxyz":
        text = line_for(letter)
        wav = os.path.join(TMP_DIR, f"{letter}.wav")
        mp3 = os.path.join(OUT_DIR, f"{letter}.mp3")
        print(f"[{letter}] {text}", flush=True)
        synth_wav(tts, text, wav)
        wav_to_mp3(wav, mp3)
        size = os.path.getsize(mp3) if os.path.exists(mp3) else 0
        dur = ffprobe_duration(mp3)
        results.append((letter, size, dur))
        print(f"    -> {size} bytes, {dur:.2f}s", flush=True)

    # Verification table
    print("\n=== VERIFICATION ===")
    print(f"{'letter':6} {'bytes':>8} {'dur(s)':>8}  status")
    total = 0
    bad = []
    for letter, size, dur in results:
        total += size
        ok = size > 3072 and dur > 0.5
        if not ok:
            bad.append(letter)
        print(f"{letter:6} {size:>8} {dur:>8.2f}  {'OK' if ok else 'BAD'}")
    print(f"\nTotal bytes: {total}")
    print(f"Bad/needs-retry: {bad if bad else 'none'}")
    # write json for caller
    with open(os.path.join(TMP_DIR, "_results.json"), "w") as f:
        json.dump({"engine": "xtts", "results": results, "total": total, "bad": bad}, f)

if __name__ == "__main__":
    main()
