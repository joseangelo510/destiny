"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy draft" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <button className="secondary-button" onClick={() => void copy()} type="button">{copied ? "Copied" : label}</button>;
}
