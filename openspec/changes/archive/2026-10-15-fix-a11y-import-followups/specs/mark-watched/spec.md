## MODIFIED Requirements

### Requirement: Platform choices follow the user's region
The Mark as Watched platform list SHALL offer the providers TMDB lists for the user's region, falling back to the US when it lists none there. "Other" SHALL always be offered. When the region changes while the dialog is open, only the platform list SHALL follow it: the runtime and anything else the user entered SHALL be kept.

#### Scenario: Region with providers
- **WHEN** a user whose region is India marks a movie watched that streams on Indian services
- **THEN** the platform list offers those services and "Other"

#### Scenario: Region changes while the dialog is open
- **WHEN** the user has typed 95 into the runtime and the region changes (for example, from another tab)
- **THEN** the platform list shows the new region's providers and the runtime still reads 95
