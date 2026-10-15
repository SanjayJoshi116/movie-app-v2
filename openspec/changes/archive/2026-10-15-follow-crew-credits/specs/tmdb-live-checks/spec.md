## ADDED Requirements

### Requirement: A crew-only person's work is checked against live data
When enabled, the live checks SHALL fetch a followed person's credits for a person known for crew work and fail unless the result includes crew credits and at least one title released in the last two years or dated ahead, and leaves out talk and news appearances.

#### Scenario: Director's credits
- **WHEN** the live checks fetch a director's credits through the followed-people credit fetch
- **THEN** the result includes titles they directed and a recent or upcoming title

#### Scenario: Talk shows slip back in
- **WHEN** the credit fetch returns a talk-show appearance
- **THEN** the live check fails, naming the title
