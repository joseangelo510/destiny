import { createHash } from "node:crypto";

export type OfflineCmsProvider = "wordpress" | "webflow" | "wix";

type PreparedCmsArticle = {
  websiteId: string;
  articleKey: string;
  title: string;
  contentHtml: string;
  renderingVersion?: string;
  wordCount?: number;
};

export type OfflineCmsReceipt = {
  provider: OfflineCmsProvider;
  websiteId: string;
  articleKey: string;
  state: "draft_created" | "manual_handoff_required";
  externalId: string | null;
  editorUrl: string | null;
  publishedUrl: null;
  scheduledFor: null;
};

const LIVE_CLIENT_HOSTS = [
  "clearcheck.app",
  "98junkit.com",
  "joseangelostudios.com",
] as const;

function assertOfflineDestination(value: string) {
  let destination: URL;
  try {
    destination = new URL(value);
  } catch {
    throw new Error("Offline CMS harness requires a valid reserved .invalid destination.");
  }

  const hostname = destination.hostname.toLocaleLowerCase();
  const isNamedLiveClient = LIVE_CLIENT_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  if (
    destination.protocol !== "https:" ||
    destination.username ||
    destination.password ||
    isNamedLiveClient ||
    !(hostname === "invalid" || hostname.endsWith(".invalid"))
  ) {
    throw new Error(`Offline CMS harness refused live or unsafe destination: ${hostname || "unknown"}.`);
  }

  return destination;
}

function assertPreparedArticle(provider: OfflineCmsProvider, article: PreparedCmsArticle) {
  if (
    !article ||
    typeof article.websiteId !== "string" || !article.websiteId.trim() ||
    typeof article.articleKey !== "string" || !article.articleKey.trim() ||
    typeof article.title !== "string" || !article.title.trim() ||
    typeof article.contentHtml !== "string" || article.contentHtml.length < 40
  ) {
    throw new Error("Offline CMS harness requires a complete prepared article.");
  }
  if (provider === "wordpress" && article.renderingVersion !== "wordpress-blocks-v2") {
    throw new Error("Offline CMS harness expected the production WordPress preparation contract.");
  }
  if (provider === "webflow" && (typeof article.wordCount !== "number" || article.wordCount <= 0)) {
    throw new Error("Offline CMS harness expected the production Webflow preparation contract.");
  }
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function copyReceipt(receipt: OfflineCmsReceipt): OfflineCmsReceipt {
  return { ...receipt };
}

export function createOfflineCmsHarness() {
  const receipts = new Map<string, OfflineCmsReceipt>();

  return {
    async transfer(
      provider: OfflineCmsProvider,
      destinationValue: string,
      article: PreparedCmsArticle,
    ): Promise<OfflineCmsReceipt> {
      const destination = assertOfflineDestination(destinationValue);
      assertPreparedArticle(provider, article);

      const receiptKey = `${provider}:${destination.origin}:${article.websiteId}:${article.articleKey}`;
      const existing = receipts.get(receiptKey);
      if (existing) return copyReceipt(existing);

      const id = `qa-${stableId(receiptKey)}`;
      const isManual = provider === "wix";
      const receipt: OfflineCmsReceipt = {
        provider,
        websiteId: article.websiteId,
        articleKey: article.articleKey,
        state: isManual ? "manual_handoff_required" : "draft_created",
        externalId: isManual ? null : id,
        editorUrl: isManual ? null : new URL(`/editor/${id}`, destination).toString(),
        publishedUrl: null,
        scheduledFor: null,
      };
      receipts.set(receiptKey, receipt);
      return copyReceipt(receipt);
    },

    evidence() {
      return Array.from(receipts.values(), copyReceipt);
    },
  };
}
