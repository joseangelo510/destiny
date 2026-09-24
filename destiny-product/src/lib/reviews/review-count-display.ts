type ReviewCountDisplay = {
  text: string;
  label: string;
};

export function reviewCountDisplay({ synced, count }: { synced: boolean; count: unknown }): ReviewCountDisplay {
  if (!synced) {
    return {
      text: "—",
      label: "Google review count unavailable until a Business Profile snapshot is synced.",
    };
  }

  if (count === null || count === undefined || count === "") {
    return {
      text: "—",
      label: "Google review count unavailable in the latest Business Profile snapshot.",
    };
  }

  const numericCount = Number(count);
  if (!Number.isFinite(numericCount) || numericCount < 0) {
    return {
      text: "—",
      label: "Google review count unavailable in the latest Business Profile snapshot.",
    };
  }

  const text = Math.trunc(numericCount).toLocaleString("en-US");
  return { text, label: `${text} Google reviews` };
}
