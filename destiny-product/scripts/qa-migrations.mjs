import { readdir } from "node:fs/promises";
import path from "node:path";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
const productionHistory = [
  "20260801042859_initial_destiny.sql",
  "20260801043008_harden_rls_functions.sql",
  "20260801043038_split_competitor_policies.sql",
  "20260801044527_persist_audit_results.sql",
  "20260801045819_restrict_audit_worker_functions.sql",
  "20260801055137_secure_google_oauth_vault.sql",
  "20260801060308_index_google_oauth_states.sql",
  "20260801064628_idempotent_background_audits.sql",
  "20260802005657_weekly_execution_system.sql",
  "20260802014116_wordpress_cms_connection.sql",
  "20260802024533_add_onboarding_problem_goals.sql",
  "20260802032344_seo_coach_experience.sql",
  "20260802050745_keyword_strategy_and_categorized_tasks.sql",
  "20260803035647_replace_measurement_with_technical_seo.sql",
  "20260803040643_attach_pagespeed_to_existing_technical_tasks.sql",
  "20260803172007_rank_tracker.sql",
  "20260803172035_rank_tracker_fk_indexes.sql",
  "20260804035443_website_builder_profile.sql",
  "20260804154303_directory_profiles.sql",
  "20260804154417_optimize_directory_profiles.sql",
  "20260804201924_founder_why_vault.sql",
  "20260804223251_recover_stalled_audits.sql",
  "20260804223455_preserve_stalled_audit_progress.sql",
  "20260806193930_guided_task_pauses.sql",
  "20260811191223_wordpress_draft_transfer.sql",
  "20260811201128_persist_article_drafts.sql",
  "20260811201234_harden_article_drafts.sql",
  "20260811201321_optimize_article_draft_policies.sql",
  "20260812013024_delete_owned_website.sql",
  "20260812023409_keyword_preference_learning.sql",
  "20260812235953_reoptimization_documents.sql",
  "20260813000042_harden_reoptimization_documents.sql",
  "20260813201052_webflow_cms_connection.sql",
  "20260813212954_webflow_field_report.sql",
  "20260814033523_scope_notifications_to_website.sql",
  "20260814033535_google_sync_state_lock.sql",
  "20260814135202_harden_authenticated_rpcs.sql",
  "20260815231204_wordpress_publication_reconciliation.sql",
  "20260816024617_reconcile_llm_visibility_tasks_backfill.sql",
  "20260816024624_website_notification_email_backfill.sql",
  "20260816024632_index_llm_visibility_completed_by_backfill.sql",
  "20260816024639_destiny_comms_beta.sql",
  "20260816031057_index_comms_website_foreign_keys.sql",
];
const stagingForwardHistory = [];
const recordedHistory = [...productionHistory, ...stagingForwardHistory];

const files = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const malformed = files.filter((file) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(file));
const versions = files.map((file) => file.slice(0, 14));
const duplicateVersions = versions.filter((version, index) => versions.indexOf(version) !== index);
const missingHistory = recordedHistory.filter((file) => !files.includes(file));
const recordedVersions = new Set(recordedHistory.map((file) => file.slice(0, 14)));
const renamedHistory = files.filter((file) => recordedVersions.has(file.slice(0, 14)) && !recordedHistory.includes(file));

const problems = [
  ...malformed.map((file) => `Malformed migration filename: ${file}`),
  ...[...new Set(duplicateVersions)].map((version) => `Duplicate migration version: ${version}`),
  ...missingHistory.map((file) => `Missing recorded production migration: ${file}`),
  ...renamedHistory.map((file) => `Recorded production migration was renamed: ${file}`),
];

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`Migration history verified: ${productionHistory.length} production migrations and ${stagingForwardHistory.length} staging migrations preserved; ${files.length - recordedHistory.length} unapplied forward migrations present.`);
