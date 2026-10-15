## ADDED Requirements

### Requirement: Secondary text meets AA contrast in both themes
Secondary and tertiary text (descriptions, captions, form hints, muted labels) SHALL have at least 4.5:1 contrast against every page, card and popup background of the active theme, in light and dark mode. Placeholders and disabled text are exempt. Icons that carry meaning SHALL keep at least 3:1.

#### Scenario: Light mode caption
- **WHEN** a user in light mode reads a card caption or a form hint in the profile dialog
- **THEN** its contrast with the background is at least 4.5:1

#### Scenario: Dark mode caption
- **WHEN** a user in dark mode reads the same caption
- **THEN** its contrast with the background is at least 4.5:1
