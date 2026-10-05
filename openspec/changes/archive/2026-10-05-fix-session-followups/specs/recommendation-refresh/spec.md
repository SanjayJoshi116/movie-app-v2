## ADDED Requirements

### Requirement: A failed refresh never blocks later refreshes
If a background recommendation refresh fails at any point, the system SHALL still release that user's in-flight refresh state. This includes failing before computation starts, e.g. because the database is briefly unreachable while loading the user. A later trigger for the same user SHALL then start a new refresh, and the recommendation endpoints SHALL NOT report the user's cache as "pending" indefinitely because of the earlier failure.

#### Scenario: Database unavailable when a refresh starts
- **WHEN** a refresh is triggered for a user and loading that user from the database raises an error
- **THEN** the failure is logged, the user's in-flight state is released, and the next watch-history change for that user starts a new refresh

#### Scenario: Queued follow-up after a failed refresh
- **WHEN** a refresh for a user fails early while a follow-up refresh was queued for that user
- **THEN** the follow-up refresh still runs (or the user's state is fully released), and the user is not left marked as refreshing with nothing running
