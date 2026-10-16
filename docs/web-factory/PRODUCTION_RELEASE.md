# Production release — 2026-10-16 (Australia/Sydney)

DEPLOYED_VERIFIED: https://federated-bms.lovable.app
Lovable commit: 55985149fddf2b7fb43f7176c2c8fe4a5f1e3a9b
Deployment ID: 8ef509b8-1f08-48ba-8960-b0992bed20ff

User authorized publishing this existing project and reports successful local hardware testing. Agent did not operate connected hardware during release.
Added official macOS DMG, Windows download page and macOS PDF guide links. Unified Arial throughout; headings 700, body 400, neutral gray/white bottom modules, thin borders, dark text and cyan-blue accents. Five data palette variables reserved; no charts or simulated production data added.

Verification:
- Local npm test: 18/18 pass; npm run build: pass (Vite 7.3.7); npm audit --omit=dev: zero vulnerabilities.
- Core App/i18n/styles/protocol/serial parity with Lovable confirmed (evidence/release-parity.json). Original Python and protocol/serial unchanged.
- Lovable reports 19 tests and automatic production build pass; full Bun audit and production dependency scan zero findings after patches. See DEPENDENCY_REVIEW.md. These are platform results, not local reruns of its scaffold. Bun 1.4.3+ required by cloud lockfile; standalone typecheck not verified.
- Actual Lovable Security view: Quick scan no issues; 52 packages / 0 known issues. Deep scan not run. No backend/database/auth functionality added.
- CUA preview at 1280x720 and 390x844: settings, driver block and responsive layout visually inspected; no horizontal overflow.
- Actual production HTTPS URL loaded; Chinese/English switch and settings navigation passed. Computed styles: Arial, sans-serif; all headings 700. All three safe HTTPS link targets verified, no browser console errors observed. Disconnected controls remain disabled; empty telemetry preserved.
- macOS direct binary link HTTP 200, 3948032 bytes; Windows official page displays CH341SER.EXE and download action.
- Screenshot: evidence/production-settings.jpg. Real hardware communication on production URL remains for user testing; browser requires fresh origin permission.

Local source and GitHub receive the same three core UI file changes. GitHub two-way Lovable sync remains unconfigured; deployment was performed via the existing Lovable project.
