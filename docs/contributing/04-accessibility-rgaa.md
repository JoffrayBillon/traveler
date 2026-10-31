# Accessibility

Use React Aria Components for interactive themed controls and compose them with project styles. Native semantic HTML remains appropriate for headings, landmarks and ordinary links. React Aria reduces interaction work; it does not certify the application or replace review. This guide uses RGAA/WCAG as engineering references and makes no legal compliance claim.

- Give each view one descriptive main heading, a main landmark, a meaningful document title and the correct language.
- Provide a visible-on-focus skip link and visible focus indicators. Keep focus order aligned with reading order; never remove outlines without an equivalent.
- Give controls accessible names, persistent labels, descriptions and associated errors. Expose selection/loading/expanded state through the appropriate semantics.
- Support keyboard, pointer and touch. Modal focus must enter, remain within and return to its trigger correctly. Do not add custom keyboard behavior over React Aria unless the use case requires it.
- Provide a keyboard and touch alternative to any future room drag-and-drop interaction, with source/destination selection and an announced result or error. Color alone must not communicate capacity, consent or errors.
- Maintain text contrast of at least 4.5:1 for ordinary text and 3:1 for large text, and 3:1 for meaningful control boundaries/focus indicators. Check both themes using rendered styles.
- Reflow at a narrow viewport and 200% zoom without lost controls or horizontal reading scroll. Respect reduced motion and high-contrast/forced-colors preferences.
- Disable CSS animations and transitions together in the global `prefers-reduced-motion` rule; use Motion's reduced-motion integration for JavaScript-driven animation.
- Keep practical touch targets at least 44px where possible. Do not substitute tiny icon-only hit areas.

For each changed interaction, test keyboard focus and activation with Testing Library. Run axe-core, then manually inspect focus, zoom, contrast, touch and relevant screen-reader behavior in a real browser. The current jsdom axe test disables color contrast because that environment has no rendering; do not present it as contrast verification. Test Safari/VoiceOver on an actual iPhone before claiming the mobile journey is validated. Desktop emulation is only an additional check.

References: [React Aria](https://react-aria.adobe.com/), [RGAA](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
