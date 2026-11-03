## ADDED Requirements

### Requirement: Episode tracking only offers episodes a season has
The episode progress editor SHALL NOT cap the episode number at 0. A season TMDB lists with no episodes, or without an episode count, SHALL have no upper bound in the editor and SHALL show no count. "Next Episode" SHALL NOT move to the next season while that season lists no episodes.

#### Scenario: Announced season
- **WHEN** a show lists an upcoming season 5 with 0 episodes and the user edits their progress to season 5
- **THEN** the episode number can't go below 1, "+" raises it, and saving stores a valid episode

#### Scenario: Last aired episode
- **WHEN** a user's progress is the last episode of season 4 and season 5 lists 0 episodes
- **THEN** no "Next Episode" action is offered
