# spoiler-shield Specification

## Purpose

Keeps a TV show's Episode Guide from spoiling episodes the user hasn't reached yet, using the episode progress they already track.

## Requirements

### Requirement: Episodes past the user's progress are hidden
When the user has episode progress for a show, has not marked the show as watched, and the "Hide spoilers" preference is on, the Episode Guide SHALL hide the title, still image and overview of every regular-season episode that comes after the tracked episode (a later episode in the same season, or any episode in a later season). The tracked episode itself and every episode before it SHALL be shown as usual. A hidden episode SHALL still show its episode number, air date, runtime and score, and SHALL be labelled as hidden to avoid spoilers. Specials (season 0) SHALL NOT be hidden.

#### Scenario: Later episode in the current season
- **WHEN** a user tracking a show at S02E04 opens its Episode Guide on season 2
- **THEN** episodes 1–4 show their titles, and episodes 5 onward show their number, air date, runtime and score but no title, and are labelled as hidden

#### Scenario: Later season
- **WHEN** a user tracking a show at S02E04 switches the Episode Guide to season 3
- **THEN** every episode of season 3 is hidden

#### Scenario: Earlier season
- **WHEN** a user tracking a show at S02E04 switches the Episode Guide to season 1
- **THEN** every episode of season 1 shows its title, still and overview

#### Scenario: Show not tracked
- **WHEN** a user with no episode progress for a show opens its Episode Guide
- **THEN** no episode is hidden

#### Scenario: Show marked as watched
- **WHEN** a user has marked a show as watched and also has episode progress for it
- **THEN** no episode is hidden

#### Scenario: Specials
- **WHEN** a user tracking a show at S01E02 switches the Episode Guide to Specials
- **THEN** no special is hidden

### Requirement: Hidden content is absent, not obscured
A hidden episode's title and overview SHALL NOT be present in the page, so assistive technology cannot read them, and its still image SHALL NOT be requested.

#### Scenario: Screen reader on a hidden episode
- **WHEN** a screen reader user expands a hidden episode
- **THEN** they hear that the episode is hidden to avoid spoilers and the reveal control, not its title or overview

#### Scenario: Still not downloaded
- **WHEN** a hidden episode is expanded
- **THEN** no request is made for that episode's still image

### Requirement: A hidden episode can be revealed
Each hidden episode SHALL offer a control that reveals its title, still and overview. The control SHALL name the episode by number (for example "Show details for episode 5"). Revealing one episode SHALL NOT reveal any other. A revealed episode SHALL stay revealed while the user stays on that show's page, including after switching seasons and back.

#### Scenario: Reveal one episode
- **WHEN** a user tracking S02E04 reveals season 2 episode 6
- **THEN** episode 6 shows its title, still and overview, and episodes 5 and 7 stay hidden

#### Scenario: Reveal survives a season switch
- **WHEN** the user reveals season 2 episode 6, switches to season 3 and back to season 2
- **THEN** episode 6 is still revealed

### Requirement: Spoiler hiding is a device preference
The Episode Guide SHALL show a "Hide spoilers" switch whenever the shield applies to the show (the user has episode progress for it and hasn't marked it watched). It SHALL be on by default. Turning it off SHALL show every episode on the page at once, and turning it on SHALL hide them again. The choice SHALL be remembered on the device across pages, reloads and sign-ins, like the theme.

#### Scenario: Turn the shield off
- **WHEN** a user tracking a show turns "Hide spoilers" off
- **THEN** every episode shows its title, still and overview

#### Scenario: Preference remembered
- **WHEN** a user turns "Hide spoilers" off and later opens another tracked show's page
- **THEN** that show's episodes are not hidden and the switch shows off

#### Scenario: Switch only where it applies
- **WHEN** a user opens the Episode Guide of a show they don't track
- **THEN** no "Hide spoilers" switch is shown

### Requirement: The guide never shows spoilers before progress is known
While the user's episode progress for the show is loading, the Episode Guide SHALL NOT show any episode title, still or overview. If the progress fails to load, the guide SHALL show episodes unhidden and SHALL say that spoilers can't be hidden because progress couldn't be loaded.

#### Scenario: Progress still loading
- **WHEN** the season's episodes arrive before the user's episode progress
- **THEN** the guide shows its loading state until the progress arrives, then shows the episodes with the shield applied

#### Scenario: Progress failed to load
- **WHEN** loading the user's episode progress fails
- **THEN** the guide shows every episode and a note that spoilers can't be hidden right now

### Requirement: The guide opens on the user's current season
When the user has episode progress for a show, the Episode Guide SHALL open on the tracked season if the show has it, instead of the first season. Without progress, or when the tracked season isn't in the show's season list, it SHALL open on the first regular season as before. Changing progress while on the page SHALL NOT switch the season the user is viewing.

#### Scenario: Tracked mid-show
- **WHEN** a user tracking S03E02 opens the show's page
- **THEN** the Episode Guide shows season 3

#### Scenario: Progress saved while viewing
- **WHEN** the user is viewing season 1 in the guide and presses "Next Episode" to move from S02E10 to S03E01
- **THEN** the guide stays on season 1, and season 3's episodes up to episode 1 are no longer hidden
