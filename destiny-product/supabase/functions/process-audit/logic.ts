import { COMPILED_LOGOS_WASM_BASE64 } from "./wasm.ts";

export type DestinyLogicInput = {
  auditComplete: number;
  criticalIssues: number;
  warnings: number;
  rankingKeywords: number;
  newKeywords: number;
  lostKeywords: number;
  contentGaps: number;
  reviewCount: number;
  keywordCoreMatches?: number;
  keywordSupportMatches?: number;
  competitorRankers?: number;
  keywordBlocklisted?: number;
  planTier?: 1 | 2 | 3;
  keywordPolicyEnabled?: number;
  keywordPositiveDemand?: number;
  keywordDisqualifiers?: number;
  keywordIntentCode?: 0 | 1 | 2 | 3;
  keywordRelevanceCode?: 0 | 1 | 2;
  keywordBusinessFitPercent?: number;
  keywordRevenueFitPercent?: number;
  keywordVolumePoints?: number;
  keywordAttainabilityPoints?: number;
  keywordValuePoints?: number;
  keywordOpportunityPoints?: number;
  keywordDemandPenalty?: number;
  keywordSearchVolume?: number;
  keywordDifficulty?: number;
  keywordCpcCents?: number;
  keywordRank?: number;
  keywordOpportunityCode?: 0 | 1 | 2;
  keywordDirectCompetitorRankers?: number;
  keywordIntentKnown?: number;
  criticalRenderBlocking?: number;
  criticalHighLoading?: number;
  criticalNoTitle?: number;
  criticalNoDescription?: number;
  criticalNoH1?: number;
  criticalNoAlt?: number;
  warningRenderBlocking?: number;
  warningHighLoading?: number;
  warningNoTitle?: number;
  warningNoDescription?: number;
  warningNoH1?: number;
  warningNoAlt?: number;
  unknownIssueCount?: number;
  questTaskCode?: number;
  questCurrentStatusCode?: number;
  questRequestedStatusCode?: number;
  questRemainingAfterCompletion?: number;
  streakCurrentWeek?: number;
  streakWeekIndexes?: number[];
  streakPlans?: Array<{ total: number; complete: number }>;
  planIdentityMatches?: number;
  planApprovedKeywords?: number;
  planUsableKeywords?: number;
  planDataQualityFlags?: number;
  editorialConversionLanguage?: number;
  editorialCommercialLanguage?: number;
  editorialProviderIntentCode?: 0 | 1 | 2 | 3;
  editorialBusinessModelCode?: 1 | 2;
  editorialProductQuery?: number;
  editorialServiceQuery?: number;
  editorialThemeRoleCode?: 0 | 1 | 2;
  editorialOfferOverlap?: number;
  editorialWeekSlot?: number;
  editorialKeywordCount?: number;
  editorialProductEvidence?: number;
  editorialServiceEvidence?: number;
  progressAuditComplete?: number;
  progressFoundationStatus?: number;
  progressContentStatus?: number;
  progressImpressions?: number;
  progressClicks?: number;
  progressPageOne?: number;
  progressPageTwo?: number;
  progressKeyEvents?: number;
  progressTaskCode?: number;
  progressTaskStatusCode?: number;
  progressCurrentChosen?: number;
  llmContentStateCode?: number;
  llmPlatformStateCode?: number;
  llmAuthorityStateCode?: number;
  llmEvidenceAvailable?: number;
  llmMentions?: number;
  llmPlatformPositiveCount?: number;
  sourceCompleted?: number;
  sourceTotal?: number;
  sourceProofAttached?: number;
  sourceProofPossible?: number;
  progressTaskCategoryCode?: number;
  progressAnyInProgress?: number;
  progressProviderAvailable?: number;
  momentumOnboardingStep?: number;
  momentumAuditProgress?: number;
  momentumAuditStatusCode?: number;
  momentumElapsedSeconds?: number;
  onboardingOneFields?: number; onboardingEmailValid?: number; onboardingUrlValid?: number; onboardingTwoFields?: number;
  auditHealthAvailable?: number; auditHealthRaw?: number; auditMeasuredCritical?: number; auditMeasuredWarnings?: number; auditVisibleIssues?: number;
  rankStatusCode?: number; rankFoundCode?: number; rankCurrentPosition?: number; rankHasPrevious?: number; rankPreviousFound?: number; rankPreviousPosition?: number;
  rankHasLastCheck?: number; rankAgeHours?: number; rankAgeDays?: number;
  articleFormatCode?: number; articleWordCount?: number; articleH1Count?: number; articleH2Count?: number; articleH3Count?: number; articleSkippedLevel?: number;
  articleTitleKeyword?: number; articleFirstH2Keyword?: number; articleKeywordFreePercent?: number; articleBrigadeCount?: number; articleFirstBrigade?: number;
  articleMinBrigadeGap?: number; articleStockPhrase?: number; articleMetaCount?: number; articleMetaOverlength?: number; articleSourceCount?: number; articleCitedCount?: number;
  keywordStrategyComplete?: number; keywordPendingRecommendations?: number; keywordApprovedDecisions?: number; keywordDeclinedDecisions?: number;
  keywordArticleDrafts?: number; keywordContentComplete?: number;
};

export type DestinyLogicResult = {
  growthStage: string;
  decisionCode: string;
  weeklyQuest: string;
  questCategory: "technical" | "content" | "reviews" | "distribution" | "measurement";
  urgency: "waiting" | "urgent" | "high" | "focused" | "routine";
  explanation: string;
  keywordVerdict: "accept" | "review" | "reject";
  keywordRuleId: "blocked_noise" | "essential_gap" | "site_vocabulary_match" | "borderline_gap" | "supporting_evidence" | "no_vocabulary_match";
  keywordReason: string;
  essentialKeyword: boolean;
  weeklyTaskCount: number;
  contentTaskCount: number;
  distributionTaskCount: number;
  weeklyTaskManifest: string[];
  keywordEligible: boolean;
  keywordSearchIntent: "awareness" | "consideration" | "conversion";
  keywordPriorityTier: 0 | 1 | 2 | 3 | 4;
  keywordPriorityScore: number;
  keywordPolicyCode: string;
  keywordRelevanceTier: "core" | "adjacent" | "none";
  keywordEssential: boolean;
  keywordDataQuality: "complete" | "intent_missing";
  keywordRuleIds: string[];
  questSource: "issue_fix" | "growth_action";
  issueQuestCode: string;
  issueDataQuality: "complete" | "unknown_issue";
  weeklyTaskApprovals: boolean[];
  weeklyTaskTiers: number[];
  weeklyTaskPriorities: number[];
  questTransitionAllowed: boolean;
  questTransitionRuleId: string;
  questVerificationStatus: "verified" | "unverified";
  questSetCompletedAt: boolean;
  questSetVerifiedAt: boolean;
  questClearEvidence: boolean;
  questCelebration: "none" | "perfect_week" | "verified_result" | "roadmap_unlock" | "task_complete";
  currentStreak: number;
  bestStreak: number;
  perfectWeeks: number;
  lifetimeActiveWeeks: number;
  planCanExport: boolean;
  planIdentityRuleId: string;
  planKeywordTargetLow: number;
  planKeywordTargetHigh: number;
  planThemeCodes: string[];
  planScopeCode: string;
  planForecastConfidence: "directional" | "limited";
  editorialIntentCode: 0 | 1 | 2 | 3;
  editorialSearchIntent: "awareness" | "consideration" | "conversion";
  editorialBusinessFit: number;
  editorialOfferFit: number;
  editorialPriorityTier: number;
  editorialPriorityScore: number;
  editorialKeywordIndex: number;
  editorialAngleCode: number;
  editorialInferredBusinessModelCode: 1 | 2;
  progressCompounding: boolean;
  progressCurrentNode: number;
  progressTaskExcluded: boolean;
  progressTaskPhase: "ready" | "visibility" | "growth";
  progressTaskState: "complete" | "current" | "future";
  llmContentState: "not_started" | "in_progress" | "complete";
  llmPlatformState: "not_started" | "in_progress" | "complete";
  llmAuthorityState: "not_started" | "in_progress" | "complete";
  llmOutcomeState: "not_started" | "monitoring" | "verified";
  llmNextStep: number;
  sourceProgressPercent: number;
  sourceProofPercent: number;
  sourceProgressState: "not_started" | "in_progress" | "complete";
  coachTaskOrder: number;
  coachCategory: "research-strategy" | "content-creation" | "distribution" | "technical-seo";
  progressDataQuality: "complete" | "provider_missing";
  momentumOnboardingCurrent: number;
  momentumOnboardingCompleted: number;
  momentumOnboardingPercent: number;
  momentumAuditPercent: number;
  momentumAuditCompleted: number;
  momentumAuditCurrent: number;
  momentumAuditReady: boolean;
  momentumTimingDelayed: boolean;
  momentumTimingSeconds: number;
  onboardingOneReady: boolean; onboardingTwoReady: boolean;
  auditHealthScore: number; auditHealthCode: number; auditIsPartial: boolean;
  rankReadingCode: number; rankMovementCode: number; rankMovementDelta: number; rankFreshnessCode: number;
  rankBucket: number;
  keywordWorkspaceTab: "review" | "approved" | "declined";
  keywordNextStep: "review_keywords" | "create_first_article" | "review_weekly_content" | "track_progress";
  articleWordIssue: boolean; articleHeadingIssue: boolean; articleHeadingKeywordIssue: boolean; articleHeadingVarietyIssue: boolean;
  articleBrigadeIssue: boolean; articleBrigadeSpacingIssue: boolean; articleStockIssue: boolean; articleMetaIssue: boolean; articleSourceIssue: boolean;
};

type LogicExports = {
  memory: WebAssembly.Memory;
  main: () => void;
};

// Compiled from destiny-logic-engine/src/main.lg with LOGICAFFEINE v0.10.1.
// Keeping the small module beside the worker guarantees that the saved quest is
// chosen by the same deterministic rules as the browser preview.
function decodeWasm() {
  const binary = atob(COMPILED_LOGOS_WASM_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

let compiledWasmModule: Promise<WebAssembly.Module> | null = null;

function getCompiledWasmModule() {
  if (!compiledWasmModule) compiledWasmModule = WebAssembly.compile(decodeWasm());
  return compiledWasmModule;
}

export async function runDestinyLogic(input: DestinyLogicInput): Promise<DestinyLogicResult> {
  const output: string[] = [];
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const runtimeRef: { current?: LogicExports } = {};
  let argumentHandle = 0;

  const dataView = () => {
    if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");
    return new DataView(runtimeRef.current.memory.buffer);
  };
  const bytesView = () => {
    if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");
    return new Uint8Array(runtimeRef.current.memory.buffer);
  };
  const readText = (handle: number) => {
    const view = dataView();
    const length = view.getInt32(handle, true);
    const pointer = view.getInt32(handle + 8, true);
    return decoder.decode(bytesView().subarray(pointer, pointer + length));
  };

  const argv = [
    "destiny-logic-engine",
    String(input.auditComplete),
    String(input.criticalIssues),
    String(input.warnings),
    String(input.rankingKeywords),
    String(input.newKeywords),
    String(input.lostKeywords),
    String(input.contentGaps),
    String(input.reviewCount),
    String(input.keywordCoreMatches ?? 0),
    String(input.keywordSupportMatches ?? 0),
    String(input.competitorRankers ?? 0),
    String(input.keywordBlocklisted ?? 0),
    String(input.planTier ?? 1),
    String(input.keywordPolicyEnabled ?? 0),
    String(input.keywordPositiveDemand ?? 0),
    String(input.keywordDisqualifiers ?? 0),
    String(input.keywordIntentCode ?? 0),
    String(input.keywordRelevanceCode ?? 0),
    String(input.keywordBusinessFitPercent ?? 0),
    String(input.keywordRevenueFitPercent ?? 0),
    String(input.keywordVolumePoints ?? 0),
    String(input.keywordAttainabilityPoints ?? 0),
    String(input.keywordValuePoints ?? 0),
    String(input.keywordOpportunityPoints ?? 0),
    String(input.keywordDemandPenalty ?? 0),
    String(input.keywordSearchVolume ?? 0),
    String(input.keywordDifficulty ?? 0),
    String(input.keywordCpcCents ?? 0),
    String(input.keywordRank ?? 0),
    String(input.keywordOpportunityCode ?? 0),
    String(input.keywordDirectCompetitorRankers ?? 0),
    String(input.keywordIntentKnown ?? 0),
    String(input.criticalRenderBlocking ?? 0),
    String(input.criticalHighLoading ?? 0),
    String(input.criticalNoTitle ?? 0),
    String(input.criticalNoDescription ?? 0),
    String(input.criticalNoH1 ?? 0),
    String(input.criticalNoAlt ?? 0),
    String(input.warningRenderBlocking ?? 0),
    String(input.warningHighLoading ?? 0),
    String(input.warningNoTitle ?? 0),
    String(input.warningNoDescription ?? 0),
    String(input.warningNoH1 ?? 0),
    String(input.warningNoAlt ?? 0),
    String(input.unknownIssueCount ?? 0),
    String(input.questTaskCode ?? 0),
    String(input.questCurrentStatusCode ?? 0),
    String(input.questRequestedStatusCode ?? 0),
    String(input.questRemainingAfterCompletion ?? 0),
    String(input.streakCurrentWeek ?? 0),
    String(input.streakWeekIndexes?.length ?? 0),
    String(input.streakPlans?.length ?? 0),
    ...(input.streakWeekIndexes ?? []).map(String),
    ...(input.streakPlans ?? []).flatMap((plan) => [String(plan.total), String(plan.complete)]),
    String(input.planIdentityMatches ?? 0),
    String(input.planApprovedKeywords ?? 0),
    String(input.planUsableKeywords ?? 0),
    String(input.planDataQualityFlags ?? 0),
    String(input.editorialConversionLanguage ?? 0),
    String(input.editorialCommercialLanguage ?? 0),
    String(input.editorialProviderIntentCode ?? 0),
    String(input.editorialBusinessModelCode ?? 1),
    String(input.editorialProductQuery ?? 0),
    String(input.editorialServiceQuery ?? 0),
    String(input.editorialThemeRoleCode ?? 0),
    String(input.editorialOfferOverlap ?? 0),
    String(input.editorialWeekSlot ?? 0),
    String(input.editorialKeywordCount ?? 0),
    String(input.editorialProductEvidence ?? 0),
    String(input.editorialServiceEvidence ?? 0),
    String(input.progressAuditComplete ?? 0), String(input.progressFoundationStatus ?? 0), String(input.progressContentStatus ?? 0),
    String(input.progressImpressions ?? 0), String(input.progressClicks ?? 0), String(input.progressPageOne ?? 0), String(input.progressPageTwo ?? 0), String(input.progressKeyEvents ?? 0),
    String(input.progressTaskCode ?? 0), String(input.progressTaskStatusCode ?? 0), String(input.progressCurrentChosen ?? 0),
    String(input.llmContentStateCode ?? 0), String(input.llmPlatformStateCode ?? 0), String(input.llmAuthorityStateCode ?? 0),
    String(input.llmEvidenceAvailable ?? 0), String(input.llmMentions ?? 0), String(input.llmPlatformPositiveCount ?? 0),
    String(input.sourceCompleted ?? 0), String(input.sourceTotal ?? 0), String(input.sourceProofAttached ?? 0), String(input.sourceProofPossible ?? 0),
    String(input.progressTaskCategoryCode ?? 0),
    String(input.progressAnyInProgress ?? 0),
    String(input.progressProviderAvailable ?? 0),
    String(input.momentumOnboardingStep ?? 0), String(input.momentumAuditProgress ?? 0), String(input.momentumAuditStatusCode ?? 0), String(input.momentumElapsedSeconds ?? 0),
    String(input.onboardingOneFields ?? 0), String(input.onboardingEmailValid ?? 0), String(input.onboardingUrlValid ?? 0), String(input.onboardingTwoFields ?? 0),
    String(input.auditHealthAvailable ?? 0), String(input.auditHealthRaw ?? 0), String(input.auditMeasuredCritical ?? 0), String(input.auditMeasuredWarnings ?? 0), String(input.auditVisibleIssues ?? 0),
    String(input.rankStatusCode ?? 0), String(input.rankFoundCode ?? -1), String(input.rankCurrentPosition ?? 0), String(input.rankHasPrevious ?? 0), String(input.rankPreviousFound ?? 0), String(input.rankPreviousPosition ?? 0),
    String(input.rankHasLastCheck ?? 0), String(input.rankAgeHours ?? 0), String(input.rankAgeDays ?? 0),
    String(input.articleFormatCode ?? 0), String(input.articleWordCount ?? 0), String(input.articleH1Count ?? 0), String(input.articleH2Count ?? 0), String(input.articleH3Count ?? 0), String(input.articleSkippedLevel ?? 0),
    String(input.articleTitleKeyword ?? 0), String(input.articleFirstH2Keyword ?? 0), String(input.articleKeywordFreePercent ?? 0), String(input.articleBrigadeCount ?? 0), String(input.articleFirstBrigade ?? 0),
    String(input.articleMinBrigadeGap ?? 0), String(input.articleStockPhrase ?? 0), String(input.articleMetaCount ?? 0), String(input.articleMetaOverlength ?? 0), String(input.articleSourceCount ?? 0), String(input.articleCitedCount ?? 0),
    String(input.keywordStrategyComplete ?? 0), String(input.keywordPendingRecommendations ?? 0), String(input.keywordApprovedDecisions ?? 0), String(input.keywordDeclinedDecisions ?? 0),
    String(input.keywordArticleDrafts ?? 0), String(input.keywordContentComplete ?? 0),
  ];

  const imports = {
    env: {
      print_text: (handle: number) => output.push(readText(handle)),
      print_i64: (value: bigint) => output.push(value.toString()),
      parse_int: (handle: number) => BigInt(Number.parseInt(readText(handle).trim(), 10) || 0),
      args: () => {
        if (argumentHandle) return argumentHandle;
        if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");

        const sequence = runtimeRef.current.memory.grow(1) * 65_536;
        const view = dataView();
        const memory = bytesView();
        const sequenceData = sequence + 16;
        let pointer = sequenceData + argv.length * 8;
        const textHandles: number[] = [];

        for (const value of argv) {
          const textHandle = pointer;
          const encoded = encoder.encode(value);
          const textData = textHandle + 16;
          view.setInt32(textHandle, encoded.length, true);
          view.setInt32(textHandle + 4, encoded.length, true);
          view.setInt32(textHandle + 8, textData, true);
          memory.set(encoded, textData);
          textHandles.push(textHandle);
          pointer = (textData + encoded.length + 7) & ~7;
        }

        view.setInt32(sequence, argv.length, true);
        view.setInt32(sequence + 4, argv.length, true);
        view.setInt32(sequence + 8, sequenceData, true);
        textHandles.forEach((handle, index) => {
          view.setBigInt64(sequenceData + index * 8, BigInt(handle), true);
        });
        argumentHandle = sequence;
        return sequence;
      },
    },
  };

  const instantiated = await WebAssembly.instantiate(await getCompiledWasmModule(), imports);
  runtimeRef.current = instantiated.exports as unknown as LogicExports;
  runtimeRef.current.main();

  if (output.length < 102) {
    throw new Error("LOGOS returned an incomplete Destiny recommendation.");
  }
  return {
    growthStage: output[0],
    decisionCode: output[1],
    weeklyQuest: output[2],
    questCategory: output[3] as DestinyLogicResult["questCategory"],
    urgency: output[4] as DestinyLogicResult["urgency"],
    explanation: output[5],
    keywordVerdict: output[6] as DestinyLogicResult["keywordVerdict"],
    keywordRuleId: output[7] as DestinyLogicResult["keywordRuleId"],
    keywordReason: output[8],
    essentialKeyword: output[9] === "true",
    weeklyTaskCount: Number.parseInt(output[10], 10),
    contentTaskCount: Number.parseInt(output[11], 10),
    distributionTaskCount: Number.parseInt(output[12], 10),
    weeklyTaskManifest: output[13].split(",").filter(Boolean),
    keywordEligible: output[14] === "true",
    keywordSearchIntent: output[15] as DestinyLogicResult["keywordSearchIntent"],
    keywordPriorityTier: Number.parseInt(output[16], 10) as DestinyLogicResult["keywordPriorityTier"],
    keywordPriorityScore: Number.parseInt(output[17], 10),
    keywordPolicyCode: output[18],
    keywordRelevanceTier: output[19] as DestinyLogicResult["keywordRelevanceTier"],
    keywordEssential: output[20] === "true",
    keywordDataQuality: output[21] as DestinyLogicResult["keywordDataQuality"],
    keywordRuleIds: output[22].split(",").filter(Boolean),
    questSource: output[23] as DestinyLogicResult["questSource"],
    issueQuestCode: output[24],
    issueDataQuality: output[25] as DestinyLogicResult["issueDataQuality"],
    weeklyTaskApprovals: output[26].split(",").filter(Boolean).map((value) => value === "true"),
    weeklyTaskTiers: output[27].split(",").filter(Boolean).map((value) => Number.parseInt(value, 10)),
    weeklyTaskPriorities: output[28].split(",").filter(Boolean).map((value) => Number.parseInt(value, 10)),
    questTransitionAllowed: output[29] === "true",
    questTransitionRuleId: output[30],
    questVerificationStatus: output[31] as DestinyLogicResult["questVerificationStatus"],
    questSetCompletedAt: output[32] === "true",
    questSetVerifiedAt: output[33] === "true",
    questClearEvidence: output[34] === "true",
    questCelebration: output[35] as DestinyLogicResult["questCelebration"],
    currentStreak: Number.parseInt(output[36], 10),
    bestStreak: Number.parseInt(output[37], 10),
    perfectWeeks: Number.parseInt(output[38], 10),
    lifetimeActiveWeeks: Number.parseInt(output[39], 10),
    planCanExport: output[40] === "true",
    planIdentityRuleId: output[41],
    planKeywordTargetLow: Number.parseInt(output[42], 10),
    planKeywordTargetHigh: Number.parseInt(output[43], 10),
    planThemeCodes: output[44].split(",").filter(Boolean),
    planScopeCode: output[45],
    planForecastConfidence: output[46] as DestinyLogicResult["planForecastConfidence"],
    editorialIntentCode: Number.parseInt(output[47], 10) as DestinyLogicResult["editorialIntentCode"],
    editorialSearchIntent: output[48] as DestinyLogicResult["editorialSearchIntent"],
    editorialBusinessFit: Number.parseInt(output[49], 10),
    editorialOfferFit: Number.parseInt(output[50], 10),
    editorialPriorityTier: Number.parseInt(output[51], 10),
    editorialPriorityScore: Number.parseInt(output[52], 10),
    editorialKeywordIndex: Number.parseInt(output[53], 10),
    editorialAngleCode: Number.parseInt(output[54], 10),
    editorialInferredBusinessModelCode: Number.parseInt(output[55], 10) as 1 | 2,
    progressCompounding: output[56] === "1",
    progressCurrentNode: Number.parseInt(output[57], 10),
    progressTaskExcluded: output[58] === "true",
    progressTaskPhase: output[59] as DestinyLogicResult["progressTaskPhase"],
    progressTaskState: output[60] as DestinyLogicResult["progressTaskState"],
    llmContentState: output[61] as DestinyLogicResult["llmContentState"],
    llmPlatformState: output[62] as DestinyLogicResult["llmPlatformState"],
    llmAuthorityState: output[63] as DestinyLogicResult["llmAuthorityState"],
    llmOutcomeState: output[64] as DestinyLogicResult["llmOutcomeState"],
    llmNextStep: Number.parseInt(output[65], 10),
    sourceProgressPercent: Number.parseInt(output[66], 10),
    sourceProofPercent: Number.parseInt(output[67], 10),
    sourceProgressState: output[68] as DestinyLogicResult["sourceProgressState"],
    coachTaskOrder: Number.parseInt(output[69], 10),
    coachCategory: output[70] as DestinyLogicResult["coachCategory"],
    progressDataQuality: output[71] as DestinyLogicResult["progressDataQuality"],
    momentumOnboardingCurrent: Number.parseInt(output[72], 10),
    momentumOnboardingCompleted: Number.parseInt(output[73], 10),
    momentumOnboardingPercent: Number.parseInt(output[74], 10),
    momentumAuditPercent: Number.parseInt(output[75], 10),
    momentumAuditCompleted: Number.parseInt(output[76], 10),
    momentumAuditCurrent: Number.parseInt(output[77], 10),
    momentumAuditReady: output[78] === "true",
    momentumTimingDelayed: output[79] === "true",
    momentumTimingSeconds: Number.parseInt(output[80], 10),
    onboardingOneReady: output[81] === "true",
    onboardingTwoReady: output[82] === "true",
    auditHealthScore: Number.parseInt(output[83], 10),
    auditHealthCode: Number.parseInt(output[84], 10),
    auditIsPartial: output[85] === "true",
    rankReadingCode: Number.parseInt(output[86], 10),
    rankMovementCode: Number.parseInt(output[87], 10),
    rankMovementDelta: Number.parseInt(output[88], 10),
    rankFreshnessCode: Number.parseInt(output[89], 10),
    articleWordIssue: output[90] === "true",
    articleHeadingIssue: output[91] === "true",
    articleHeadingKeywordIssue: output[92] === "true",
    articleHeadingVarietyIssue: output[93] === "true",
    articleBrigadeIssue: output[94] === "true",
    articleBrigadeSpacingIssue: output[95] === "true",
    articleStockIssue: output[96] === "true",
    articleMetaIssue: output[97] === "true",
    articleSourceIssue: output[98] === "true",
    rankBucket: Number.parseInt(output[99], 10),
    keywordWorkspaceTab: output[100] as DestinyLogicResult["keywordWorkspaceTab"],
    keywordNextStep: output[101] as DestinyLogicResult["keywordNextStep"],
  };
}
