import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendDictation,
  type DictationRecognition,
  DICTATION_SILENCE_MS,
  startDictationSession,
} from "./dictation";

afterEach(() => vi.useRealTimers());

describe("onboarding dictation", () => {
  it("finishes after five seconds without speech", () => {
    expect(DICTATION_SILENCE_MS).toBe(5_000);
  });

  it("appends a transcript without changing the user's existing response", () => {
    expect(appendDictation("We help founders", "grow organic traffic.")).toBe(
      "We help founders grow organic traffic.",
    );
    expect(appendDictation("", "A fresh response")).toBe("A fresh response");
  });

  it("starts continuous dictation and stops after five silent seconds", () => {
    vi.useFakeTimers();
    const recognition: DictationRecognition = {
      lang: "",
      interimResults: false,
      continuous: false,
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const onStop = vi.fn();
    const onTranscript = vi.fn();

    startDictationSession({ recognition, onError: vi.fn(), onStop, onTranscript });

    expect(recognition.start).toHaveBeenCalledOnce();
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);

    recognition.onresult?.({
      resultIndex: 0,
      results: Object.assign([{ 0: { transcript: "We help small businesses" }, isFinal: true }], { length: 1 }),
    });
    expect(onTranscript).toHaveBeenCalledWith("We help small businesses");

    vi.advanceTimersByTime(DICTATION_SILENCE_MS - 1);
    expect(recognition.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("lets the user tap again to stop immediately", () => {
    vi.useFakeTimers();
    const recognition: DictationRecognition = {
      lang: "",
      interimResults: false,
      continuous: false,
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
    };
    const onStop = vi.fn();
    const session = startDictationSession({ recognition, onError: vi.fn(), onStop, onTranscript: vi.fn() });

    session.stop();

    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(DICTATION_SILENCE_MS);
    expect(recognition.stop).toHaveBeenCalledOnce();
  });
});
