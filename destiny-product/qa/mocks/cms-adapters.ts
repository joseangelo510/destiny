import { createHash } from "node:crypto";
import { contentFingerprint } from "../../supabase/functions/wordpress-draft/logic";
import { verifyPublicPage } from "../../supabase/functions/wordpress-reconcile/logic";

export type OfflineCmsProvider = "wordpress" | "webflow" | "wix";

type PreparedCmsArticle = {
  websiteId: string;
  articleKey: string;
  title: string;
  contentHtml: string;
  renderingVersion?: string;
  wordCount?: number;
  scheduledFor?: string;
  featuredGraphic?: unknown;
  graphics?: unknown[];
};

export type OfflineCmsReceipt = {
  provider: OfflineCmsProvider;
  websiteId: string;
  articleKey: string;
  state:
    | "draft_created"
    | "scheduled"
    | "verification_failed"
    | "verified_live"
    | "manual_handoff_required";
  externalId: string | null;
  editorUrl: string | null;
  publishedUrl: string | null;
  scheduledFor: string | null;
};

export type OfflineCmsEvent = {
  jobId: string;
  provider: OfflineCmsProvider;
  websiteId: string;
  articleKey: string;
  state: OfflineCmsReceipt["state"];
  recordedAt: string;
};

type StoredReceipt = {
  receipt: OfflineCmsReceipt;
  destination: string;
  title: string;
  contentHtml: string;
  featuredImageRequired: boolean;
  expectedInlineImages: number;
};

const LIVE_CLIENT_HOSTS = [
  "clearcheck.app",
  "98junkit.com",
  "joseangelostudios.com",
] as const;

export const OFFLINE_CMS_DESTINATION_POLICY = Object.freeze({
  protocols: ["https:"] as const,
  exactHostnames: ["invalid"] as const,
  hostnameSuffixes: [".invalid"] as const,
});

export function isOfflineCmsDestinationAllowed(value: string) {
  let destination: URL;
  try {
    destination = new URL(value);
  } catch {
    return false;
  }
  const hostname = destination.hostname.toLocaleLowerCase();
  const allowedHostname = OFFLINE_CMS_DESTINATION_POLICY.exactHostnames.includes(hostname as "invalid")
    || OFFLINE_CMS_DESTINATION_POLICY.hostnameSuffixes.some((suffix) => hostname.endsWith(suffix));
  return OFFLINE_CMS_DESTINATION_POLICY.protocols.includes(destination.protocol as "https:")
    && !destination.username && !destination.password && allowedHostname;
}

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
  if (isNamedLiveClient || !isOfflineCmsDestinationAllowed(value)) {
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
  const receipts = new Map<string, StoredReceipt>();
  const eventLog: OfflineCmsEvent[] = [];

  function record(receipt: OfflineCmsReceipt) {
    const sequence = eventLog.length + 1;
    eventLog.push({
      jobId: `qa-job-${stableId(`${receipt.provider}:${receipt.websiteId}:${receipt.articleKey}:${receipt.state}:${sequence}`)}`,
      provider: receipt.provider,
      websiteId: receipt.websiteId,
      articleKey: receipt.articleKey,
      state: receipt.state,
      recordedAt: new Date(sequence * 1000).toISOString(),
    });
  }

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
      if (existing) return copyReceipt(existing.receipt);

      const id = `qa-${stableId(receiptKey)}`;
      const isManual = provider === "wix";
      const scheduledFor = provider === "wordpress" && typeof article.scheduledFor === "string" && article.scheduledFor
        ? article.scheduledFor
        : null;
      const receipt: OfflineCmsReceipt = {
        provider,
        websiteId: article.websiteId,
        articleKey: article.articleKey,
        state: isManual ? "manual_handoff_required" : scheduledFor ? "scheduled" : "draft_created",
        externalId: isManual ? null : id,
        editorUrl: isManual ? null : new URL(`/editor/${id}`, destination).toString(),
        publishedUrl: null,
        scheduledFor,
      };
      receipts.set(receiptKey, {
        receipt,
        destination: destination.origin,
        title: article.title,
        contentHtml: article.contentHtml,
        featuredImageRequired: Boolean(article.featuredGraphic),
        expectedInlineImages: Array.isArray(article.graphics) ? article.graphics.length : 0,
      });
      record(receipt);
      return copyReceipt(receipt);
    },

    async verifyWordPressPublication(input: {
      destination: string;
      websiteId: string;
      articleKey: string;
      status: number;
      permalink: string;
      html: string;
    }): Promise<OfflineCmsReceipt> {
      const destination = assertOfflineDestination(input.destination);
      const permalink = assertOfflineDestination(input.permalink);
      if (permalink.origin !== destination.origin) {
        throw new Error("Offline CMS harness refused publication evidence from another destination.");
      }
      const receiptKey = `wordpress:${destination.origin}:${input.websiteId}:${input.articleKey}`;
      const stored = receipts.get(receiptKey);
      if (!stored || stored.receipt.provider !== "wordpress") {
        throw new Error("Offline CMS harness could not find a matching WordPress receipt.");
      }

      const verification = verifyPublicPage({
        status: input.status,
        html: input.html,
        permalink: input.permalink,
        fingerprint: contentFingerprint(stored.title, stored.contentHtml),
        featuredImageRequired: stored.featuredImageRequired,
        expectedInlineImages: stored.expectedInlineImages,
      });
      stored.receipt = {
        ...stored.receipt,
        state: verification.verified ? "verified_live" : "verification_failed",
        publishedUrl: verification.verified ? input.permalink : null,
      };
      record(stored.receipt);
      return copyReceipt(stored.receipt);
    },

    evidence() {
      return Array.from(receipts.values(), (stored) => copyReceipt(stored.receipt));
    },

    events() {
      return eventLog.map((event) => ({ ...event }));
    },
  };
}
