export const CELEBRATION_KINDS = ["task_complete", "perfect_week", "verified_result", "roadmap_unlock"] as const;
export type CelebrationKind = typeof CELEBRATION_KINDS[number];

export type CelebrationPreferences = {
  muted: boolean;
  reduced: boolean;
};

export const DEFAULT_CELEBRATION_PREFERENCES: CelebrationPreferences = { muted: true, reduced: false };
export const CELEBRATION_STORAGE_KEY = "destiny-celebrations-v2";

type SoundStep = {
  frequency: number;
  duration: number;
  delay: number;
  gain: number;
  wave: OscillatorType;
};

const SOUND_PATTERNS: Record<CelebrationKind, SoundStep[]> = {
  task_complete: [
    { frequency: 660, duration: 0.08, delay: 0, gain: 0.045, wave: "sine" },
    { frequency: 880, duration: 0.11, delay: 0.07, gain: 0.04, wave: "sine" },
  ],
  perfect_week: [
    { frequency: 392, duration: 0.14, delay: 0, gain: 0.045, wave: "triangle" },
    { frequency: 523, duration: 0.16, delay: 0.1, gain: 0.05, wave: "triangle" },
    { frequency: 659, duration: 0.22, delay: 0.22, gain: 0.055, wave: "triangle" },
  ],
  verified_result: [
    { frequency: 330, duration: 0.14, delay: 0, gain: 0.045, wave: "sine" },
    { frequency: 494, duration: 0.2, delay: 0.1, gain: 0.05, wave: "sine" },
    { frequency: 740, duration: 0.28, delay: 0.24, gain: 0.045, wave: "sine" },
  ],
  roadmap_unlock: [
    { frequency: 440, duration: 0.1, delay: 0, gain: 0.04, wave: "triangle" },
    { frequency: 587, duration: 0.12, delay: 0.08, gain: 0.045, wave: "triangle" },
    { frequency: 880, duration: 0.18, delay: 0.18, gain: 0.05, wave: "triangle" },
    { frequency: 1175, duration: 0.24, delay: 0.3, gain: 0.035, wave: "sine" },
  ],
};

const CELEBRATION_MESSAGES: Record<CelebrationKind, { title: string; detail: string }> = {
  task_complete: { title: "Shipped.", detail: "Your roadmap moved forward." },
  perfect_week: { title: "Perfect Week.", detail: "You completed every assigned step. That consistency compounds." },
  verified_result: { title: "Verified result.", detail: "Connected evidence confirmed that your visibility is moving." },
  roadmap_unlock: { title: "New ground unlocked.", detail: "Your completed work opened the next part of the journey." },
};

export function celebrationMessage(kind: CelebrationKind) {
  return { ...CELEBRATION_MESSAGES[kind] };
}

export function parseCelebrationPreferences(raw: string | null): CelebrationPreferences {
  if (!raw) return { ...DEFAULT_CELEBRATION_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return { muted: value.muted === true, reduced: value.reduced === true };
  } catch {
    return { ...DEFAULT_CELEBRATION_PREFERENCES };
  }
}

export function celebrationSoundPattern(kind: CelebrationKind, reduced: boolean) {
  const pattern = SOUND_PATTERNS[kind];
  return reduced ? pattern.slice(0, Math.min(2, pattern.length)).map((step) => ({ ...step, gain: step.gain * 0.55 })) : pattern.map((step) => ({ ...step }));
}

export function readCelebrationPreferences() {
  if (typeof window === "undefined") return { ...DEFAULT_CELEBRATION_PREFERENCES };
  return parseCelebrationPreferences(window.localStorage.getItem(CELEBRATION_STORAGE_KEY));
}

export function saveCelebrationPreferences(preferences: CelebrationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(preferences));
}

export function playDestinySound(kind: CelebrationKind) {
  if (typeof window === "undefined") return false;
  const preferences = readCelebrationPreferences();
  if (preferences.muted) return false;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return false;
  try {
    const context = new AudioContextConstructor();
    const pattern = celebrationSoundPattern(kind, preferences.reduced);
    for (const step of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + step.delay;
      oscillator.type = step.wave;
      oscillator.frequency.setValueAtTime(step.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(step.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + step.duration + 0.02);
    }
    const total = Math.max(...pattern.map((step) => step.delay + step.duration), 0.2);
    window.setTimeout(() => void context.close(), Math.ceil((total + 0.1) * 1000));
    return true;
  } catch {
    return false;
  }
}
