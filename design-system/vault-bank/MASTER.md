# VAULT Bank — Black / Neon Purple

## Product direction

Thai-language learning DApp. Prioritize the next required action over technical information. Keep real balances and transaction state; do not introduce sample funds, invented charts, or financial performance metrics.

## Visual system

- Black background `#09090e`, dark surface `#121217`, readable foreground `#f5f2fa`.
- Neon Purple action `#b886ff` with dark action text `#140c20`.
- Secondary text `#aaa5b7`; semantic success `#93e0b5`, error `#ffabae`, pending `#f0cc8d` with text labels.
- Use DM Sans for Latin/numbers and Noto Sans Thai for Thai, with system fallback.
- Restrained purple accent, solid dark surfaces, subtle borders. Avoid decorative data or constant animation.
- Body/help text is readable and controls have visible focus. Primary CTA and touch controls use at least 44px height.

## Interaction system

1. Connect MetaMask.
2. Set up Bank once: create a contract, or expand the existing-address path.
3. Deposit/withdraw and confirm in MetaMask.

The primary CTA changes with account, network, contract, loading, and pending deployment state. Read-only balance refresh remains unavailable until the Bank connection succeeds. Amount errors appear beside the field on blur or submission; invalid submitted fields receive focus. Preserve the browser's existing settings and transaction history keys.

## Responsive

Desktop sidebar, tablet/mobile labelled bottom navigation. No horizontal page overflow. Respect bottom safe area, reduced motion, and browser zoom. Keep every field labelled and decorative SVGs hidden from accessibility APIs. Navigation and field focus must remain reachable above fixed bars.

## Applied guidance

The ui-ux-pro-max local design-system search returned Minimalism & Swiss Style, relevant for dashboard clarity. Its marketing-page sections and default palette were not used. The user's Black / Neon Purple direction controls color choices. Form decisions use the verified UX results for Inline Validation, Error Placement, and Focusable Error Summary (a single invalid field is focused directly). The three-step structure is a product-specific design decision, not a claimed database match for progressive disclosure.

## Verification

Dark-mode text checks: foreground 16.86:1, secondary 7.80:1, subtle 5.43:1, primary-action text 7.15:1. UI state tests cover disconnected, setup needed, wrong network, ready, pending deployment, loading, and failed setup. Browser checks include tabs, inline amount validation, invalid Contract Address with focus, and the disconnected primary action. Blockchain integration tests use the local test chain.
