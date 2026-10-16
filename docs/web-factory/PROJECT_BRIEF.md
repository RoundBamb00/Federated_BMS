# Federated BMS — approved scope

2026-10-16: User selected option 1, browser-to-local-USB Web Serial, and requested pushing to RoundBamb00/Federated_BMS then Lovable. Preserve Code/GUI.py byte-for-byte. No remote gateway, cloud data storage, federated-learning algorithm, login, simulated telemetry, or new logo.

## Requirements and acceptance
- R1: Two 12-cell panels, pack voltage/SOC/current/temperatures/MOS/extrema, 24-cell summary; empty until received. Verify decoding fixtures + browser render.
- R2: Preserve 115200 8N1 default, selectable baud and same-header alternation, exact six command bytes. Verify stream segmentation and write tests.
- R3: Support both 40-byte and 46-byte formats. Because the protocol has no reliable length field/checksum, select frame size before connecting instead of guessing at chunk boundaries. Default 46 matches source fallback; user can select 40.
- R4: Chinese/English settings, raw receive and command logs, clear display/log, real disconnect lifecycle, unsupported-browser guidance. Verify browser interactions and fake serial integration.
- R5: Distinguish serial open, telemetry fresh/stale, and command sent (not acknowledged). Do not claim physical actuation.
- R6: Build/test, preserve original, push user-specified main repo; Lovable import constrained by platform. Create a project from exact reviewed website source if supported, document actual sync status.

## Design
React + Vite, client-only. Light instrument dashboard, deep-teal navigation rail, two clearly separated pack panels, fixed-width numbers and mV labels. Responsive single-column mobile, no decorative animations or external fonts/assets. Native labeled settings and keyboard focus. Hardware controls disabled when disconnected; no automatic commands.

## Validation limits
Physical serial/BMS hardware not available to automated tests. A browser mock verifies browser API integration, not hardware or firmware safety. Frame protocol has no ACK or checksum in supplied GUI.
