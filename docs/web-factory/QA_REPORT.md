# QA report
Date: 2026-10-16 (Australia/Sydney)
Candidate: evidence/source-hashes.json; original: evidence/original-sha256.txt.

PASS — npm test: 18 tests (evidence/unit-tests.txt). Fields compared with original Python parser oracle, 40/46-byte arbitrary fragmentation and noise, exact six three-byte commands, same-header alternation, two-pack summary, open/read/write/close failures, concurrent connect/send, cancellation during pending chooser/open.
PASS — npm run build: Vite 7.3.7, React 19.3.1, Node 23.11.0. JS gzip 76.15 kB. evidence/build.txt.
PASS — npm run test:browser: Playwright 1.64.1 / installed Chrome; 4 tests, evidence/browser-tests.txt. URL http://127.0.0.1:5173/. Desktop 1440x1000; mobile 390x844 and 375x844; tablet 768x844. Initial empty values, controls disabled, English/Chinese, frame selector, keyboard focus, no horizontal overflow, mock serial reads, all six command writes, per-pack stale status, disconnect/reconnect/reset, unsupported API and chooser cancellation. No page errors in layout flow.

P2 connection cancellation found by independent review: reproduced by two failing tests, fixed by checking state after chooser/open awaits, both now pass.

Limits: hardware/firmware/MOS actuation unverified. Browser test mock is only a fixture; no simulated data shipped in application. Browser network test covers local assets; hosted deployment must be separately verified.
