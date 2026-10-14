## ADDED Requirements

### Requirement: Vote averages are within 0 to 10
Every `voteAverage` input (watchlist, watched, list items, and bulk watched imports) SHALL be rejected with `400` naming `voteAverage` when it is below 0 or above 10. A missing or null value SHALL stay allowed where it is allowed today.

#### Scenario: Huge vote average
- **WHEN** a signed-in user adds a watched item with `"voteAverage": 1e27`
- **THEN** the response is `400` naming `voteAverage`, and no row is created

#### Scenario: Negative vote average in a bulk import
- **WHEN** a bulk watched import contains an entry with `"voteAverage": -3`
- **THEN** the request is rejected with `400` naming that entry's `voteAverage`, and nothing is imported

### Requirement: A stored out-of-range vote average never breaks a page
A stored vote average outside 0 to 10 (written before inputs were bounded) SHALL NOT make any endpoint fail. Stats SHALL leave such a value out of averages.

#### Scenario: Stats with a huge stored vote average
- **WHEN** a user's watched history contains an entry whose stored vote average is `1e27`, and they open Stats
- **THEN** the stats response is `200`, and that entry isn't included in the average TMDB score

### Requirement: Episode progress is set only with both fields
Setting a show's episode progress SHALL require both `season` and `episode`. A request missing either SHALL be rejected with `400` naming the missing field, leaving stored progress unchanged. Partial updates (`PATCH`) SHALL NOT be accepted (`405`).

#### Scenario: Episode only
- **WHEN** a user sends `POST` with `{"episode": 5}` for a show they track at S3E2
- **THEN** the response is `400` naming `season`, and progress stays S3E2

#### Scenario: PATCH
- **WHEN** a user sends `PATCH` with `{"episode": 5}`
- **THEN** the response is `405`, and progress is unchanged

### Requirement: Adding to a list that is being deleted is a clean not-found
Adding one or many items to a list that is deleted while the request runs SHALL get `404`, never a server error.

#### Scenario: List deleted during a bulk add
- **WHEN** a user's list is deleted in one request while another request is adding items to it
- **THEN** the adding request gets `404` or succeeds before the delete, and never `500`
