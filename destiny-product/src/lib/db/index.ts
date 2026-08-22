import { createClient } from "@/lib/supabase/server";
import type { OrganizationScopedTable, SiteScopedTable, UserScopedTable } from "./table-scope";

type ScopedTable = SiteScopedTable | OrganizationScopedTable | UserScopedTable;
type BaseRow = Record<string, unknown>;
type ScopedRows = {
  article_drafts: BaseRow & { keyword: string; draft: unknown };
  audits: BaseRow & { id: string; website_id: string };
  integrations: BaseRow & { provider: string; status: string };
  keyword_preferences: BaseRow & { keyword: string; decision: string };
  publishing_plans: BaseRow & {
    id: string; organization_id: string; website_id: string; audit_id: string;
    mode: string; status: string; timezone: string; holdback_hours: number;
    start_date: string; end_date: string | null; confirmed_post_count: number;
    automatic_confirmed_at: string | null; updated_at: string;
  };
  publishing_schedule_items: BaseRow & {
    id: string; plan_id: string; position: number; keyword: string; title: string;
    content_type: string; related_article_title: string | null; scheduled_for: string;
    state: string; review_recommended: boolean; remote_id: string | null;
    remote_edit_url: string | null; remote_permalink: string | null; last_error: string | null;
  };
  websites: BaseRow & { id: string; organization_id: string; builder_profile: unknown };
};
type TableRow<Table extends ScopedTable> = Table extends keyof ScopedRows ? ScopedRows[Table] : BaseRow;
type DatabaseError = { message?: string; code?: string } | null;
type ManyResult<Row> = { data: Row[] | null; error: DatabaseError };
type OneResult<Row> = { data: Row | null; error: DatabaseError };
type Values = Record<string, unknown>;

type ScopedQuery<Row> = PromiseLike<ManyResult<Row>> & {
  eq(column: string, value: unknown): ScopedQuery<Row>;
  in(column: string, values: readonly unknown[]): ScopedQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): ScopedQuery<Row>;
  limit(count: number): ScopedQuery<Row>;
  select(columns: string): ScopedQuery<Row>;
  maybeSingle(): PromiseLike<OneResult<Row>>;
  single(): PromiseLike<OneResult<Row>>;
};

type RuntimeTable = {
  select(columns: string): ScopedQuery<unknown>;
  insert(values: unknown): ScopedQuery<unknown>;
  upsert(values: unknown, options?: { onConflict?: string }): ScopedQuery<unknown>;
  update(values: unknown): ScopedQuery<unknown>;
  delete(): ScopedQuery<unknown>;
};

type RuntimeClient = {
  from(table: string): RuntimeTable;
  auth: { getClaims(): Promise<{ data: { claims?: { sub?: unknown } } | null }> };
  functions: { invoke<Result>(name: string, options: { body: unknown }): Promise<{ data: Result | null; error: DatabaseError }> };
};

function runtimeClient(client: Awaited<ReturnType<typeof createClient>>) {
  return client as unknown as RuntimeClient;
}

function queryFor<Table extends ScopedTable>(client: RuntimeClient, table: Table) {
  return client.from(table) as {
    select(columns: string): ScopedQuery<TableRow<Table>>;
    insert(values: unknown): ScopedQuery<TableRow<Table>>;
    upsert(values: unknown, options?: { onConflict?: string }): ScopedQuery<TableRow<Table>>;
    update(values: unknown): ScopedQuery<TableRow<Table>>;
    delete(): ScopedQuery<TableRow<Table>>;
  };
}

function assertScope(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required for scoped database access.`);
  return value;
}

function siteQueries(client: RuntimeClient, websiteId: string) {
  const scope = () => assertScope(websiteId, "websiteId");
  return {
    select<Table extends SiteScopedTable>(table: Table, columns: string) {
      return queryFor(client, table).select(columns).eq("website_id", scope());
    },
    insert<Table extends SiteScopedTable>(table: Table, values: Values | Values[]) {
      const scopedId = scope();
      const rows = (Array.isArray(values) ? values : [values]).map((value) => ({ ...value, website_id: scopedId }));
      return queryFor(client, table).insert(Array.isArray(values) ? rows : rows[0]);
    },
    upsert<Table extends SiteScopedTable>(table: Table, values: Values | Values[], options?: { onConflict?: string }) {
      const scopedId = scope();
      const rows = (Array.isArray(values) ? values : [values]).map((value) => ({ ...value, website_id: scopedId }));
      return queryFor(client, table).upsert(Array.isArray(values) ? rows : rows[0], options);
    },
    update<Table extends SiteScopedTable>(table: Table, values: Values, filters: Values = {}) {
      const scopedId = scope();
      if ("website_id" in values && values.website_id !== scopedId) throw new Error("A scoped update cannot change website_id.");
      let query = queryFor(client, table).update(values).eq("website_id", scopedId);
      for (const [column, value] of Object.entries(filters)) {
        if (typeof query.eq === "function") query = query.eq(column, value);
      }
      return query;
    },
    delete<Table extends SiteScopedTable>(table: Table) {
      return queryFor(client, table).delete().eq("website_id", scope());
    },
  };
}

export async function scopedClient(websiteId: string) {
  const client = runtimeClient(await createClient());
  return {
    ...siteQueries(client, websiteId),
    async getClaims() {
      const { data } = await client.auth.getClaims();
      return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    },
    website(columns: string) {
      return queryFor(client, "websites").select(columns).eq("id", websiteId);
    },
    invokeFunction<Result>(name: string, body: unknown) {
      return client.functions.invoke<Result>(name, { body });
    },
  };
}

export async function orgClient(organizationId: string) {
  const client = runtimeClient(await createClient());
  const scopedId = assertScope(organizationId, "organizationId");
  return {
    select<Table extends OrganizationScopedTable>(table: Table, columns: string) {
      const key = table === "organizations" ? "id" : "organization_id";
      return queryFor(client, table).select(columns).eq(key, scopedId);
    },
  };
}

export async function userClient(userId: string) {
  const client = runtimeClient(await createClient());
  const scopedId = assertScope(userId, "userId");
  return {
    select<Table extends UserScopedTable>(table: Table, columns: string) {
      return queryFor(client, table).select(columns).eq("id", scopedId);
    },
  };
}

export async function adminClient(reason: string) {
  if (!reason.trim()) throw new Error("Service-role access requires an audit reason.");
  throw new Error("Service-role database access is available only inside reviewed Edge Functions.");
}

export * from "./table-scope";
