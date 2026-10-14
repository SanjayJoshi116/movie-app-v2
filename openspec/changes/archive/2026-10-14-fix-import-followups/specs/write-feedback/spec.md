## MODIFIED Requirements

### Requirement: At most one in-flight write per item
While a write for a given item (identified by media id and type, person id, list and media item, or show for episode progress) is in flight, more requests for that item from repeated activation SHALL NOT be sent. The repeated activation SHALL settle with the outcome of the in-flight write. A different action on the same item SHALL NOT settle with the in-flight write's outcome: it SHALL wait until that write has finished, then be sent, and report its own outcome.

#### Scenario: Double-click on watchlist toggle
- **WHEN** the user clicks a title's watchlist toggle twice before the first request completes
- **THEN** exactly one request is sent to the server

#### Scenario: Double-click on follow
- **WHEN** the user clicks Follow twice in quick succession
- **THEN** exactly one follow request is sent

#### Scenario: Different items are independent
- **WHEN** a watched toggle for one title is in flight and the user toggles watched on a different title
- **THEN** the second title's request is sent

#### Scenario: Repeated feedback isn't stacked
- **WHEN** a repeated activation settles with the same outcome as the in-flight write
- **THEN** the user sees a single success (or error) message, not two identical stacked messages

#### Scenario: Remove while Next Episode is saving
- **WHEN** a user clicks "Next Episode →" for a show and, before it finishes, confirms removing that show's episode progress
- **THEN** the remove is sent after the advance finishes, the show ends with no stored progress, and "Episode progress removed." appears only after the remove succeeded
