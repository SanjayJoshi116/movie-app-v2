## ADDED Requirements

### Requirement: Episode progress that fails to load isn't shown as no progress
When loading a TV show's episode progress fails, the page SHALL say the progress couldn't be loaded and offer to try again. While the load has failed, it SHALL NOT offer to start tracking or to edit or advance progress, so a save can't overwrite the stored position.

#### Scenario: Progress request fails
- **WHEN** a user who is on S03E04 of a show opens its page and the progress request fails
- **THEN** the page says the progress couldn't be loaded with a Retry control, and no "Track episode progress" button is shown

#### Scenario: Retry succeeds
- **WHEN** the user presses Retry and the request succeeds
- **THEN** the page shows "Currently on S03E04"
