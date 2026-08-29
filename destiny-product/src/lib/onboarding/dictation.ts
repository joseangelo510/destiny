export const DICTATION_SILENCE_MS = 5_000;
export const DICTATION_RESTART_MS = 120;

export type DictationRecognitionEvent = {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: { 0: { transcript: string }; isFinal?: boolean };
  };
};

export type DictationRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: DictationRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type DictationSession = { stop: () => void };

export function appendDictation(current: string, transcript: string) {
  return [current.trim(), transcript.trim()].filter(Boolean).join(" ");
}

export function startDictationSession({
  recognition,
  onError,
  onStop,
  onTranscript,
}: {
  recognition: DictationRecognition;
  onError: (message: string) => void;
  onStop: () => void;
  onTranscript: (transcript: string) => void;
}): DictationSession {
  let active = true;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (silenceTimer !== null) clearTimeout(silenceTimer);
    if (restartTimer !== null) clearTimeout(restartTimer);
    silenceTimer = null;
    restartTimer = null;
  };

  const stop = () => {
    if (!active) return;
    active = false;
    clearTimers();
    try {
      recognition.stop();
    } catch {
      // The browser may already have closed the speech session.
    }
    onStop();
  };

  const armSilenceTimer = () => {
    if (silenceTimer !== null) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stop, DICTATION_SILENCE_MS);
  };

  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (event) => {
    let finalTranscript = "";
    for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal !== false) finalTranscript += ` ${result[0].transcript}`;
    }
    if (finalTranscript.trim()) onTranscript(finalTranscript.trim());
    armSilenceTimer();
  };
  recognition.onerror = (event) => {
    if (event.error === "no-speech") return;
    onError("Rebound SEO could not hear you. Allow microphone access in Chrome and try again.");
    stop();
  };
  recognition.onend = () => {
    if (!active) return;
    restartTimer = setTimeout(() => {
      if (!active) return;
      try {
        recognition.start();
      } catch {
        onError("Rebound SEO could not restart voice input. Check the microphone permission and try again.");
        stop();
      }
    }, DICTATION_RESTART_MS);
  };

  armSilenceTimer();
  try {
    recognition.start();
  } catch {
    onError("Rebound SEO could not start voice input. Check the microphone permission and try again.");
    stop();
  }

  return { stop };
}
