import type { InfographicSpec } from "./article-generation";

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

// Use a full font-size width per code point, including wide glyphs. This is
// deliberately conservative so wrapping does not rely on character clipping.
function lines(value: string, width: number, fontSize: number) {
  const limit = Math.max(1, Math.floor(width / fontSize));
  const result: string[] = [];
  let current = "";
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const characters = Array.from(word);
    if (current && Array.from(`${current} ${word}`).length <= limit) {
      current += ` ${word}`;
      continue;
    }
    if (current) result.push(current);
    current = "";
    while (characters.length > limit) result.push(characters.splice(0, limit).join(""));
    current = characters.join("");
  }
  if (current) result.push(current);
  return result;
}

export function renderInfographicSvg(spec: InfographicSpec) {
  let cursor = 92;
  const fragments: string[] = [];
  const textBlock = (value: string, x: number, width: number, size: number, color: string, weight = 400) => {
    const wrapped = lines(value, width, size);
    for (const line of wrapped) {
      fragments.push(`<text x="${x}" y="${cursor}" fill="${color}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`);
      cursor += size * 1.35;
    }
  };
  textBlock(spec.title, 70, 1060, 50, "#241119", 750);
  cursor += 18;
  textBlock(spec.insight, 70, 1060, 26, "#715d68");
  cursor += 64;
  spec.items.forEach((item, index) => {
    const start = cursor;
    fragments.push(`<circle cx="105" cy="${start - 8}" r="30" fill="#9e1b40"/><text x="105" y="${start + 1}" text-anchor="middle" fill="#ffffff" font-size="24" font-weight="700">${index + 1}</text>`);
    textBlock(item, 165, 965, 30, "#241119", 650);
    cursor = Math.max(cursor + 42, start + 105);
  });
  cursor += 12;
  textBlock(spec.sourceLabel, 70, 1060, 20, "#76636d");
  const height = Math.ceil(cursor + 42);
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(spec.altText)}" viewBox="0 0 1200 ${height}" width="1200" height="${height}"><rect width="1200" height="${height}" rx="36" fill="#fbf6f4"/><rect width="18" height="${height}" fill="#f3bfd0"/><g font-family="Arial, sans-serif">${fragments.join("")}</g></svg>`;
}
