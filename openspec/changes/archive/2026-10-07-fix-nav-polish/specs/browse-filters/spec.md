## ADDED Requirements

### Requirement: Browse filters can be opened at every screen size
On the Movies, TV and Anime browse pages, the user SHALL be able to open the filter panel at phone, tablet and desktop widths. Every filter control in the app SHALL open the same panel and show the same open/closed state. The control SHALL NOT appear on pages that are not browse pages.

#### Scenario: Open filters on a phone
- **WHEN** a signed-in user is on `/movies` at 375px width and activates the Filters control
- **THEN** the filter panel opens, and applying a filter changes the browse results the same way it does on desktop

#### Scenario: Control reflects panel state
- **WHEN** the filter panel is open on a phone
- **THEN** the Filters control is shown as active and reports itself as expanded to assistive technology

#### Scenario: No control off browse pages
- **WHEN** a signed-in user is on `/watchlist` at 375px width
- **THEN** no Filters control is shown in the phone navigation
