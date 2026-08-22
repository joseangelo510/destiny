const NON_LATIN_LETTER = /\p{Letter}/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

export function hasNonLatinLetters(value) {
  return [...String(value)].some((character) =>
    NON_LATIN_LETTER.test(character) && !LATIN_LETTER.test(character));
}

function literalText(node) {
  if (node.type === "JSXText") return node.value;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateElement") return node.value?.raw ?? "";
  return "";
}

function hasEscapeComment(sourceCode, node) {
  const sameOrPreviousLine = sourceCode.getAllComments().filter((comment) =>
    comment.loc.end.line === node.loc.start.line || comment.loc.end.line === node.loc.start.line - 1);
  return sameOrPreviousLine.some((comment) => /i18n-ok:\s*\S/i.test(comment.value));
}

export const englishOnlyRule = {
  meta: {
    type: "problem",
    docs: { description: "Keep developer-authored operational and UI strings English-only." },
    schema: [],
    messages: {
      nonEnglish: "Developer-authored UI and operational strings must use Latin script. Add // i18n-ok: <reason> only for a reviewed exception.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    function inspect(node) {
      const text = literalText(node);
      if (text && hasNonLatinLetters(text) && !hasEscapeComment(sourceCode, node)) {
        context.report({ node, messageId: "nonEnglish" });
      }
    }
    return { JSXText: inspect, Literal: inspect, TemplateElement: inspect };
  },
};
