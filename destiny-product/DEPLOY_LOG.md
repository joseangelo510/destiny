# Destiny Deploy Log

No release is valid unless its entry is complete and the green gate belongs to the exact shipped SHA. A release entry containing `TBD`, `pending`, or an empty field is a hard stop.

## Required release-entry template

Copy this commented template for each release. Remove the comment markers only after every field has verified evidence.

```text
## Release: <name>
- date: <ISO date and time>
- shipped commit SHA: <full SHA>
- tag: <immutable tag>
- PR links: <one or more URLs>
- gate run link: <green run URL for shipped SHA>
- summary counts: <test files, tests, browser journeys>
- RED evidence links: <one failing run per new RED test group>
- commit discipline: <pass and policy version>
- isolation matrix: <pass and fixture summary>
- test-change: <none, or commit plus justification>
- migrations: <IDs, or explicit none>
- features and blast radius: <feature map names and blast radius>
- rollback command: <exact non-destructive rollback command>
- deployer: <person or automation>
- post-deploy smoke: <run URL and result>
- legacy-evidence: <pre-policy TDD pairs and GitHub runs; required for PR #7 only>
```

## Pre-release Step Zero evidence

- Draft PR: https://github.com/joseangelo510/destiny/pull/7
- Last fully green pre-policy gate: https://github.com/joseangelo510/destiny/actions/runs/32560700136
- Pre-policy counts: 155 Vitest files, 1,064 tests, 10 authenticated/public desktop and mobile browser journeys
- Status: evidence only; this is not a shipped release entry
