import type { ScorecardSnapshot } from "./contracts";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function absoluteUrl(appUrl: string, path: string) {
  return new URL(path, appUrl.endsWith("/") ? appUrl : `${appUrl}/`).toString();
}

function emailShell({ appUrl, body, preheader, title }: { appUrl: string; body: string; preheader: string; title: string }) {
  const preferences = absoluteUrl(appUrl, "/account#communication-cadence");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="background:#f4f2ea;color:#173b30;font-family:Arial,sans-serif;margin:0;padding:0"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2ea"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #dfe7e2;border-radius:20px;max-width:600px;overflow:hidden"><tr><td style="padding:26px 28px 12px"><div style="font-family:Georgia,serif;font-size:23px;font-weight:700;letter-spacing:-.04em">Destiny <span style="color:#75a989">⌁</span></div></td></tr>${body}<tr><td style="border-top:1px solid #e5ebe7;color:#6d7c76;font-size:12px;line-height:1.55;padding:22px 28px 26px">Destiny turns SEO into one focused habit at a time.<br><a href="${escapeHtml(preferences)}" style="color:#275f4e">Change communication cadence</a></td></tr></table></td></tr></table></body></html>`;
}

function metricTable(snapshot: ScorecardSnapshot) {
  if (!snapshot.metrics.length) return "";
  const cells = snapshot.metrics.map((metric) => `<td valign="top" width="50%" style="padding:6px"><div style="background:#f3f7f4;border:1px solid #e1e9e4;border-radius:12px;min-height:92px;padding:14px"><div style="color:#697871;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${escapeHtml(metric.label)}</div><div style="font-family:Georgia,serif;font-size:28px;margin-top:8px">${escapeHtml(metric.value)}</div>${metric.delta ? `<div style="color:#275f4e;font-size:12px;margin-top:5px">${metric.direction === "down" ? "↓" : metric.direction === "up" ? "↑" : "→"} ${escapeHtml(metric.delta)}</div>` : ""}</div></td>`);
  const rows = Array.from({ length: Math.ceil(cells.length / 2) }, (_, index) => `<tr>${cells.slice(index * 2, index * 2 + 2).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px -6px 0">${rows}</table>`;
}

export function renderWeeklyScorecardEmail(snapshot: ScorecardSnapshot, appUrl: string) {
  const ctaUrl = absoluteUrl(appUrl, snapshot.cta.deepLink);
  const wins = snapshot.wins.map((win) => `<tr><td style="padding:8px 0"><a href="${escapeHtml(absoluteUrl(appUrl, win.objectUrl))}" style="color:#173b30;font-weight:700;text-decoration:none">✓ ${escapeHtml(win.objectName)}</a><div style="color:#697871;font-size:12px;margin:4px 0 0">${escapeHtml(win.from)} → ${escapeHtml(win.to)} · ${escapeHtml(win.metric)}</div></td></tr>`).join("");
  const attention = snapshot.attention[0];
  const body = `<tr><td style="padding:10px 28px 30px"><div style="color:#275f4e;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">Week ${snapshot.weekNumber} · ${snapshot.streakLength}-week streak · ${snapshot.freezesRemaining} freezes</div><h1 style="color:#173b30;font-family:Georgia,serif;font-size:38px;font-weight:500;letter-spacing:-.045em;line-height:1.05;margin:12px 0">${escapeHtml(snapshot.headline)}</h1><p style="color:#52625c;font-size:15px;line-height:1.65;margin:0">${snapshot.variant === "first" ? "This is your starting point. Destiny will make future comparisons only when saved evidence exists." : snapshot.variant === "thin" ? "There is not enough connected history for a full comparison yet, so this update shows only what Destiny can verify." : "Here is the verified movement and the clearest next action for your website."}</p>${metricTable(snapshot)}${wins ? `<div style="margin-top:22px"><div style="font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase">What moved</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${wins}</table></div>` : ""}${attention ? `<div style="background:#fff8e4;border:1px solid #eadcae;border-radius:12px;margin-top:20px;padding:16px"><div style="font-size:12px;font-weight:800;text-transform:uppercase">Needs attention · ${attention.timeCostMinutes} min</div><strong style="display:block;font-size:16px;margin-top:7px">${escapeHtml(attention.problem)}</strong><p style="color:#6e654a;font-size:13px;line-height:1.5;margin:6px 0 0">${escapeHtml(attention.fix)}</p></div>` : ""}<a href="${escapeHtml(ctaUrl)}" style="background:#275f4e;border-radius:10px;color:#ffffff;display:block;font-size:15px;font-weight:800;margin-top:22px;padding:14px 18px;text-align:center;text-decoration:none">${escapeHtml(snapshot.cta.label)} · ${snapshot.cta.timeCostMinutes} min</a><p style="color:#697871;font-size:12px;margin:16px 0 0">Next Week: ${snapshot.nextWeek.actionsRequired} useful ${snapshot.nextWeek.actionsRequired === 1 ? "action" : "actions"}, about ${snapshot.nextWeek.timeCostMinutes} minutes.</p></td></tr>`;
  return emailShell({ appUrl, body, preheader: snapshot.headline, title: `Destiny Week ${snapshot.weekNumber}` });
}

export function renderContinuityEmail({ appUrl, kind, minutes, streakLength, websiteName }: { appUrl: string; kind: "friday-risk" | "sunday-last-chance"; minutes: number; streakLength: number; websiteName: string }) {
  const isSunday = kind === "sunday-last-chance";
  const title = isSunday ? "One useful step keeps your Week alive." : "Your Week still has room for one useful step.";
  const body = `<tr><td style="padding:10px 28px 30px"><div style="color:#8a6715;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${isSunday ? "Sunday last chance" : "Friday Week at risk"}</div><h1 style="color:#173b30;font-family:Georgia,serif;font-size:38px;font-weight:500;letter-spacing:-.045em;line-height:1.05;margin:12px 0">${escapeHtml(title)}</h1><p style="color:#52625c;font-size:15px;line-height:1.65">${escapeHtml(websiteName)} has a ${streakLength}-week streak. Complete one actionable task before the local Week closes. If life got in the way, Destiny will automatically use an available freeze.</p><a href="${escapeHtml(absoluteUrl(appUrl, "/this-week"))}" style="background:#275f4e;border-radius:10px;color:#ffffff;display:block;font-size:15px;font-weight:800;margin-top:22px;padding:14px 18px;text-align:center;text-decoration:none">Open this Week · ${minutes} min</a></td></tr>`;
  return emailShell({ appUrl, body, preheader: title, title });
}

export function renderOnboardingDataLandedEmail({ appUrl, achievementName, minutes, websiteName }: { appUrl: string; achievementName: string; minutes: number; websiteName: string }) {
  const title = "Your first Destiny evidence is ready.";
  const body = `<tr><td style="padding:10px 28px 30px"><div style="color:#275f4e;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">First data landed</div><h1 style="color:#173b30;font-family:Georgia,serif;font-size:38px;font-weight:500;letter-spacing:-.045em;line-height:1.05;margin:12px 0">${title}</h1><p style="color:#52625c;font-size:15px;line-height:1.65">Destiny finished the first evidence pass for ${escapeHtml(websiteName)}. Complete one useful action to earn <strong>${escapeHtml(achievementName)}</strong> today.</p><a href="${escapeHtml(absoluteUrl(appUrl, "/this-week"))}" style="background:#275f4e;border-radius:10px;color:#ffffff;display:block;font-size:15px;font-weight:800;margin-top:22px;padding:14px 18px;text-align:center;text-decoration:none">Take the first step · ${minutes} min</a></td></tr>`;
  return emailShell({ appUrl, body, preheader: title, title });
}
