create index rank_digest_sends_organization_idx
  on public.rank_digest_sends (organization_id, created_at desc);
