## ADDED Requirements

### Requirement: A Back-restore survives a failed page
Restoring a browse page's loaded pages after Back SHALL request at most 4 of them at a time. When any of them fails, the page SHALL show the load error with Retry, and Retry SHALL restore the same number of pages and the scroll position, not start again from the first page.

#### Scenario: One page fails during the restore
- **WHEN** the user had 10 pages of Movies loaded, opens a movie, goes Back, and the request for page 7 fails
- **THEN** the page shows the load error, and Retry shows the 10 pages at the saved scroll position

#### Scenario: Many saved pages
- **WHEN** the user had 20 pages of People loaded and goes Back to People
- **THEN** no more than 4 page requests are in flight at any time while the 20 pages are restored
