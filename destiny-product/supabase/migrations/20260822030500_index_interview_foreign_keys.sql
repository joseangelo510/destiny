-- Cover the two foreign keys not already led by a query index.
create index interviews_audit_idx on public.interviews (audit_id) where audit_id is not null;
create index interview_answers_interview_idx on public.interview_answers (interview_id);
