# Crypto Trading Platform — 100-round verified progress

## Accounting (2026-11-21)
**Submitted 10; Accepted 7/100; Failed 1 (R001); Pending 2 (R009 and R010 website).** Never count an unverified CI result or undeployed website.
- R002–R008 source-of-truth development branch: [feat/round-002-postgres-ledger-20261120](https://github.com/twappleon/Crypto-Trading-Platform/tree/feat/round-002-postgres-ledger-20261120). These backend changes are **not yet merged to main**, and are **not serving the website**.
- Public-site source is [main/web](../web). It is not evidence of production HTTPS or backend integration.
- Vercel project `crypto-trading-platform-demo` exists and is GitHub-linked; project state `live=false`, zero recorded deployments and no domain. Deployment rejected with HTTP 402 quota `api-deployments-free-per-day` on 2026-11-21.
- Proof and release checklist: [docs/SITE_RELEASE.md](SITE_RELEASE.md). [Site CI](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml).

| Round | Deliverable | Evidence | Accepted |
|---|---|---|---|
| 001 | Prototype matching and journal | [Original commit](https://github.com/twappleon/Crypto-Trading-Platform/commit/dcef059d56e49003b66ecb4d47630d3b07148fad), original standalone test NPE | **NO** |
| 002 | PostgreSQL durable journal, idem, balance | [Source 14fbf63](https://github.com/twappleon/Crypto-Trading-Platform/commit/14fbf632c4d1591d61c06b6a8c9161789d0bd5e9), [BDD 4/4 CI run #25](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44737212887) | **YES** |
| 003 | Commit-time conservation and retry classification | [Source b3d52c7](https://github.com/twappleon/Crypto-Trading-Platform/commit/b3d52c757b2c1c641e2e0e034151b18076d944d0), [BDD 8/8 CI run #34](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44745047231) | **YES** |
| 004 | Durable available/locked balances and holds | [Source 87f8c64](https://github.com/twappleon/Crypto-Trading-Platform/commit/87f8c6487d1b85d189b2e6d4f77546819898819b), [BDD 13/13 CI run #64](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754663669) | **YES** |
| 005 | Order reserve, cancel and conflict protection | [Source 39d0812](https://github.com/twappleon/Crypto-Trading-Platform/commit/39d08126acc4f1317cb261c9191d4eb18a946085), [BDD 18/18 CI run #85](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44764831746) | **YES** |
| 006 | Explicit-pair atomic paper settlement | [Source 7641e07](https://github.com/twappleon/Crypto-Trading-Platform/commit/7641e07b5955c5b0c1c80b291e6778764bf1cfdf), [BDD 23/23 CI run #93](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44774297393) | **YES** |
| 007 | Maker/taker fee conservation | [Source 16d7fbf](https://github.com/twappleon/Crypto-Trading-Platform/commit/16d7fbf7710d3978662e6c9526bb12005efe9eeb), [BDD 28/28 CI run #109](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44784435281) | **YES** |
| 008 | Settlement Transactional Outbox and inbox dedup | [Source f9c9c3d](https://github.com/twappleon/Crypto-Trading-Platform/commit/f9c9c3d9cabd023a2ec21130011f7e33f399faa7), [BDD 33/33 CI run #126](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44793845793) | **YES** |
| 009 | Main-site P0: v0.2 history + OPEN/CANCELED status, live UI negative BDD and public deploy attempt | [Site code 7108cbb](https://github.com/twappleon/Crypto-Trading-Platform/commit/7108cbb0a875c71e151a620ab16b264ea051e678). Checked-in browser interaction test executed in isolated V8 shim: 39 behavioral assertions PASS; seven additional static guards PASS (46 total), plus independent 10-marker scan; [Node interaction BDD](../web/site-interaction.test.cjs) is wired to [Site CI](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml) but **GitHub CI SUCCESS not verified**. Vercel API Production 402 quota, no HTTPS URL to browser-test. | **PENDING / NO** |

| 010 | Main-site v0.3: cancel-all for open synthetic orders; preserve unique browser-lifetime IDs after reset to prevent stale button from canceling newly placed orders | [R010 report](ROUND_010_REPORT.md), source/test commits on [PR branch](https://github.com/twappleon/Crypto-Trading-Platform/tree/feat/round-010-site-order-safety-20261121); added negative UI BDD; GitHub CI and public production HTTPS/browser/mobile not yet confirmed | **PENDING / NO** |

## R009 code change and functional verification
- `web/index.html`: synthetic session order history with status OPEN when submitted and CANCELED on cancel, immutable display of canceled order, duplicate cancel guarded, history/reset aligned with open orders and held balances, visible v0.2 marker.
- `web/site-interaction.test.cjs`: executable order-entry, reserve, rejection, cancel, SELL, precision and reset behavior under isolated DOM harness.
- `web/site-smoke.test.cjs`: anti-network/static checks plus explicit history/cancellation markers.
- `.github/workflows/site.yml`: Node 22 static and interaction BDD, triggered by site, workflow and release documents so final documentation SHA is tested.
- `docs/PRD.md`, `docs/BDD.md`, `docs/SITE_RELEASE.md`: updated P0 site acceptance and security constraints.
- Vercel root set to `web`; SSO and password deployment protection turned off for public sandbox access **once a deployment succeeds**. Site currently not live.

## Blocking, next iteration
**P0:** Wait for Vercel deployment quota to become available (HTTP 402, daily Hobby limit; this is a transient quota, not site success); deploy `main:web` to Production, capture exact SHA and public READY HTTPS URL; verify logged-out HTTP response and desktop/mobile browser interactions; verify GitHub CI success on same SHA. Do not label website Accepted without all evidence. No production URL or screenshot yet.

**Then:** Merge reviewed and passing backend PR safely, wire paper data persistence/auth to UI with clear mode labeling, durable FIFO sequence/replay, REST/WebSocket, auth/MFA, KYC sandbox, admin and full E2E. Continue strict PAPER/SANDBOX: no real funds, private keys, on-chain transactions or real customer KYC.

## R010 submission — site-first
Submitted R010 includes real source changes and a BDD regression test for stale controls across reset, plus a visible Cancel All for paper order holds. [Report](ROUND_010_REPORT.md). Preserve Accepted=7/100 until a green exact-SHA CI run and actual public site deployment/desktop/mobile browser evidence exist. No deployment URL has been verified. Do not treat backend PR branch as the live website.
