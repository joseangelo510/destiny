"use client";

import { useMemo, useState } from "react";
import {
  AI_BUILDER_TOOLS,
  WEBSITE_PLATFORMS,
  platformSavedMessage,
} from "../lib/integrations/website-profile";

// "Your website" — editable profile information, not a claimed API
// connection. Selections read "Saved"/"Selected", never "Connected".
export function WebsiteProfileCard({
  initialBuilderTools,
  initialPlatform,
  websiteId,
}: {
  initialBuilderTools: string[];
  initialPlatform: string | null;
  websiteId: string;
}) {
  const [platform, setPlatform] = useState<string | null>(initialPlatform);
  const [builderTools, setBuilderTools] = useState<string[]>(initialBuilderTools);
  const [baseline, setBaseline] = useState<{ platform: string | null; builderTools: string[] }>({ platform: initialPlatform, builderTools: initialBuilderTools });
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  const visiblePlatforms = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return WEBSITE_PLATFORMS;
    return WEBSITE_PLATFORMS.filter((item) => item.label.toLowerCase().includes(query));
  }, [filter]);

  const dirty = platform !== baseline.platform
    || builderTools.length !== baseline.builderTools.length
    || builderTools.some((tool) => !baseline.builderTools.includes(tool));

  const toggleTool = (toolId: string) => {
    setSavedMessage("");
    setBuilderTools((current) => current.includes(toolId) ? current.filter((item) => item !== toolId) : [...current, toolId]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const response = await fetch("/api/website-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, platform, builderTools }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Rebound SEO could not save your website profile.");
      setBaseline({ platform, builderTools });
      setSavedMessage(platform ? platformSavedMessage(platform) : "Saved. You can update this any time.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save your website profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="workspace-card website-profile-card">
    <div className="workspace-card-heading"><div><strong>Your website</strong><small>Tell Rebound SEO where your site is built so advice fits your tools.</small></div></div>

    <fieldset className="website-platform-group">
      <legend>Where is your site built?</legend>
      <input
        aria-label="Search platforms"
        className="website-platform-search"
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Search platforms…"
        type="search"
        value={filter}
      />
      <div className="website-platform-grid" role="none">
        {visiblePlatforms.map((item) => {
          const selected = platform === item.id;
          // Native radios keep the full keyboard interaction model (arrow
          // keys, roving focus) without re-implementing WAI-ARIA by hand.
          return <label className={`website-platform-tile${selected ? " selected" : ""}`} key={item.id}>
            <input
              checked={selected}
              name="website-platform"
              onChange={() => { setSavedMessage(""); setPlatform(item.id); }}
              type="radio"
              value={item.id}
            />
            <span className="website-platform-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
            <span>{item.label}</span>
            {selected && <small>Selected</small>}
          </label>;
        })}
        {visiblePlatforms.length === 0 && <p className="website-platform-none">No platform matches “{filter.trim()}”. Choose Other if yours isn’t listed.</p>}
      </div>
    </fieldset>

    <fieldset className="website-tools-group">
      <legend>Did AI tools help you build it?</legend>
      <p className="website-tools-hint">Optional. Rebound SEO uses this to tailor coaching — these are preferences, not account connections.</p>
      <div className="website-tools-options">
        {AI_BUILDER_TOOLS.map((tool) => {
          const checked = builderTools.includes(tool.id);
          return <label className={`website-tool-option${checked ? " selected" : ""}`} key={tool.id}>
            <input checked={checked} onChange={() => toggleTool(tool.id)} type="checkbox" value={tool.id} />
            <span>{tool.label}</span>
            {checked && <small>Selected</small>}
          </label>;
        })}
      </div>
    </fieldset>

    <div className="website-profile-footer">
      <button className="primary-button" disabled={saving || !dirty} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save website profile"}</button>
      <div aria-live="polite" className="website-profile-status" role="status">
        {savedMessage && <p className="website-profile-saved">{savedMessage}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  </section>;
}
