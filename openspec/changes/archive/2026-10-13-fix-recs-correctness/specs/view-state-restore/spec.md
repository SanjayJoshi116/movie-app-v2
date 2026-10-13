## MODIFIED Requirements

### Requirement: Incomplete recommendations are not cached as final
A saved For You snapshot SHALL record whether any recommendation group was
still being computed. A snapshot SHALL count as complete only when every group
answered as ready during that visit. A group whose polling stops before the
backend reports it ready, and a visit left before the first answers arrive,
SHALL leave the snapshot incomplete. On the next visit, a snapshot that was
incomplete SHALL be shown while the page resumes fetching and polling, and
polling SHALL continue until the backend reports the groups ready. When polling
stops before that, the page SHALL say the recommendations are still being
prepared and offer to try again.

#### Scenario: Leave mid-computation
- **WHEN** the user opens For You while personalized recommendations are still computing, leaves, and returns within 5 minutes
- **THEN** the page polls again and shows the personalized groups once they are ready

#### Scenario: Polling gives up
- **WHEN** a group is still computing after the page's last poll
- **THEN** the page says the recommendations are taking longer than usual and offers Retry, and on the next visit it fetches again instead of showing the saved groups as final

#### Scenario: Leave before the first answer
- **WHEN** the user returns to an incomplete snapshot and leaves before any group answers
- **THEN** the snapshot stays incomplete, and the next visit fetches again

## ADDED Requirements

### Requirement: Marking a recommendation watched keeps the page in place
Marking a title watched or unwatched from For You SHALL update that title's watched state without reloading or reordering the recommendation groups, and SHALL NOT request the recommendations again.

#### Scenario: Mark a card watched
- **WHEN** the user marks a For You card as watched
- **THEN** the card shows as watched, the groups stay in the same order, and no recommendation request is sent
