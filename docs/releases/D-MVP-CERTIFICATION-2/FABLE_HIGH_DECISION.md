# D-MVP-CERTIFICATION-2 — Live production certification

- Date: 2026-08-24
- Authority: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1
- Decision record: https://claude.ai/chat/1b249bfe-361d-4286-b592-4f899babdcf5
- Decision: CONDITIONAL GO, subject to the preflight and stop conditions below
- Approved canonical build at decision time: `8e2100323196c9cf0145ef78824294213df169ba`
- Approved post-merge harness: https://github.com/joseangelo510/destiny/actions/runs/32698351937

## Authorized scope

The decision extends D-MVP-CERTIFICATION-1 to permit a controlled live certification of `joseangelostudios.com` and `clearcheck.app`: onboarding, Google property verification, keyword decisions, editorial-calendar behavior, new content kept in draft, CMS draft delivery, one immediate publish and one approximately 60-minute scheduled publish of pre-existing approved content per site, schedule verification, site-bound manual or connected social receipts, and cross-site isolation verification.

## Conditions

1. The runtime URL, environment, exact SHA, operator, workspaces, GSC properties, GA properties, CMS targets, social targets, scheduler, and direct rollback access must be recorded before live action.
2. The running SHA must equal the approved canonical SHA. An unverifiable or mismatched runtime fails P1 and halts live action.
3. ClearCheck production publishing or social posting additionally requires written client authorization on file. Without it, ClearCheck stops at CMS draft delivery and is recorded as deferred.
4. Content generated during the certification remains draft-only. Only pre-existing approved posts may publish or be scheduled.
5. A social handoff or post may reference only a verified live URL on the correct domain and account.
6. Any cross-site data, wrong account, wrong URL, early schedule fire, secret change, RLS change, or migration requirement is a stop condition.

## Evidence required

Every receipt must include site identifier, workspace identifier, timestamp, and actor. Required capability evidence includes onboarding state, site-bound GSC/GA pulls, keyword add/remove/approve/decline before-and-after states, calendar item IDs, generated draft state, CMS draft IDs, published URLs with HTTP and canonical verification, scheduled and actual fire times, social handoff or post receipts, and zero cross-site rows in each workspace query.

## Code-change rule

If code must change, certification pauses at that step. The fix must use a new governed branch and protected PR, receive its own GOV-1 classification and Fable 5 High decision when the work is HIGH, pass the complete harness, merge through the protected path, and produce a green post-merge run before certification resumes against the new exact SHA.

