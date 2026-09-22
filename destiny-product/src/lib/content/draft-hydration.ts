/** Keep user edits that happened while saved drafts were loading. */
export function preserveEditedDrafts<T extends { keyword: string }>(loaded: T[], current: T[], editedKeywords: ReadonlySet<string>): T[] {
  const currentByKeyword = new Map(current.map(draft => [draft.keyword, draft]));
  return loaded.map(draft => editedKeywords.has(draft.keyword) ? currentByKeyword.get(draft.keyword) ?? draft : draft);
}
