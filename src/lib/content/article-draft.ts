export type ArticleDraftInput = {
  keyword: string;
  businessName: string;
  problemSolved: string;
  idealCustomer: string;
  differentiation: string;
};

export type ArticleDraft = {
  keyword: string;
  title: string;
  metaDescription: string;
  body: string;
  optimization: Array<{ label: string; detail: string }>;
};

function titleCase(value: string) {
  const brandTerms: Record<string, string> = {
    ai: "AI",
    b2b: "B2B",
    b2c: "B2C",
    cms: "CMS",
    crm: "CRM",
    saas: "SaaS",
    seo: "SEO",
  };
  return value.split(/(\s+)/).map((word) => {
    const normalized = word.toLocaleLowerCase();
    if (brandTerms[normalized]) return brandTerms[normalized];
    return word.replace(/^\w/, (character) => character.toUpperCase());
  }).join("");
}

export function buildArticleDraft(input: ArticleDraftInput): ArticleDraft {
  const keyword = input.keyword.trim() || "your customer’s search question";
  const titleKeyword = titleCase(keyword);
  const audience = input.idealCustomer.trim() || "the people you serve";
  const problem = input.problemSolved.trim() || "a costly problem they want to solve";
  const difference = input.differentiation.trim() || "practical experience and a clear point of view";
  const body = `# ${titleKeyword}: A Practical Guide

When ${audience} search for ${keyword}, they are rarely looking for more generic information. They are trying to make a confident decision, avoid an expensive mistake, or understand what a useful next step looks like.

${input.businessName} approaches that decision from a practical starting point: ${problem}

## What should someone understand first?

Start by defining the outcome you actually need. A useful ${keyword} decision should connect the work to a real customer, business, or operational result. It should also make the tradeoffs clear: what requires time, what requires expertise, and what can be measured after implementation.

## The questions worth asking

1. What specific problem should this solve?
2. Who needs to be involved before a decision is made?
3. What proof shows that the approach works?
4. What should improve in the first 30, 60, and 90 days?
5. How will the result be measured and revisited?

## What makes a strong approach different?

${difference}. That matters because good work should reflect the real language, constraints, and goals of the business instead of repeating advice that could apply to anyone.

## A practical next step

Write down the outcome you want, the evidence you already have, and the obstacle that is slowing progress. Use those three inputs to evaluate the next ${keyword} recommendation. If the recommendation cannot explain how it connects to those facts, it probably needs more work.

## Frequently asked questions

### How quickly should results appear?

The timeline depends on the starting point and the size of the change. The first useful milestone is usually a clear baseline and a completed action that can be measured again.

### What should I measure?

Track the metrics closest to the intended outcome. For search work, that can include rankings, qualified organic traffic, conversions, and the pages or sources that influence a customer’s decision.

### What should I do next?

Review this draft for accuracy, add a real example from your experience, and replace any statement that does not sound like your voice. Then approve it for your CMS or download the editable document for your team.`;
  return {
    keyword,
    title: `${titleKeyword}: A Practical Guide`,
    metaDescription: `A practical guide to ${keyword} for ${audience}, including key questions, tradeoffs, and the next step.`,
    body,
    optimization: [
      { label: "Focus keyword", detail: `Use “${keyword}” naturally in the title, introduction, and one subheading.` },
      { label: "Human proof", detail: "Add one customer example, firsthand lesson, or result before publishing." },
      { label: "Conversion", detail: "End with one clear next step that matches the reader’s intent." },
    ],
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildWordDocument(draft: ArticleDraft) {
  const paragraphs = escapeHtml(draft.body)
    .split("\n")
    .filter(Boolean)
    .map((line) => line.startsWith("# ") ? `<h1>${line.slice(2)}</h1>`
      : line.startsWith("## ") ? `<h2>${line.slice(3)}</h2>`
      : line.startsWith("### ") ? `<h3>${line.slice(4)}</h3>`
      : `<p>${line}</p>`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="description" content="application-ready Destiny article"><title>${escapeHtml(draft.title)}</title></head><body><p><strong>Focus keyword:</strong> ${escapeHtml(draft.keyword)}</p><p><strong>Meta description:</strong> ${escapeHtml(draft.metaDescription)}</p>${paragraphs}</body></html>`;
}
