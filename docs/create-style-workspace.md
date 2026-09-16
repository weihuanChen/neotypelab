# Style workspace interaction

Step 1 now has one navigation row: Discover / Create / Saved.

Discover shows four selected directions by default. Browse all opens source/category filters, search, featured/name sorting and eight entries per page. Official and community entries share the discovery surface. Filter changes reset pagination. State is retained when switching workspace tabs.

Cards use reviewed images where available. Explicit slug-keyed frontend palettes are isolated in StylePalette.tsx (crimson-command, classic-hero, eva-inspired, military-prototype). Unknown styles do not receive guessed HEX values. These palettes are illustrative studies, never generation inputs, paint recommendations or model coverage promises. Strips use 42/24/16/10/8 weights and expose role/HEX on hover and keyboard focus; expandable details provide touch access and disclosure.

Create is a central command input with example text buttons, actual interpretation pricing and the existing recovery/refund lifecycle. The interpreted intent replaces the input in the same step. Adjust restores the original description, Save stores privately without navigation, and Apply saves idempotently before entering Model. Custom colors remain semantic labels until genuine HEX data exists.

Saved retains ownership, visibility and publication controls. Publishing is still explicit. Switching navigation never changes the selected style silently.

Validation includes server-rendered workspace states, rail size, explicit palette weights, unknown palette handling, no nested source tabs, existing generation tests and public-route E2E. Authenticated click-through testing and live interpretation remain separate deployment checks. No backend schema or generation contract changes are required.
