## ADDED Requirements

### Requirement: Platform choices follow the user's region
The Mark as Watched platform list SHALL offer the providers TMDB lists for the user's region, falling back to the US when it lists none there. "Other" SHALL always be offered.

#### Scenario: Region with providers
- **WHEN** a user whose region is India marks a movie watched that streams on Indian services
- **THEN** the platform list offers those services and "Other"
