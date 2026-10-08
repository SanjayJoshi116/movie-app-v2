# notifications Specification

## Purpose

Defines how the new-release notification bell polls for releases and shows which notifications are unread, so the badge count is consistent everywhere and the user can see what's new before it gets marked as seen.

## Requirements

### Requirement: One shared notification poll per session
An authenticated session SHALL poll for new-release notifications from a single source. Every notification bell shown in the app SHALL display the same unread count and items.

#### Scenario: Sidebar and bottom-nav bells agree
- **WHEN** the app shows notification bells in both the sidebar and the bottom navigation
- **THEN** both show the same unread badge count, and only one poll runs per polling interval

### Requirement: Unread items are visible before they are marked seen
When the user opens the notification dropdown, items that were unread at that moment SHALL be shown as unread for as long as the dropdown stays open. Notifications SHALL be marked seen when the dropdown closes, and the unread badge SHALL then clear.

#### Scenario: Opening the dropdown with unread items
- **WHEN** the user opens the notification dropdown while two items are unread
- **THEN** those two items are visually marked as unread in the open dropdown

#### Scenario: Closing the dropdown
- **WHEN** the user closes the dropdown
- **THEN** the notifications are marked seen and the unread badge clears

### Requirement: Notifications cover every followed person
New-release notifications SHALL consider the recent credits of every person
the user follows, regardless of how many people they follow or when they
followed them. When many followed people have no cached credits, a single
poll MAY cover only some of them, but each poll SHALL cover people not yet
covered, so that every followed person is covered within a bounded number of
consecutive polls.

#### Scenario: Early follow
- **WHEN** a user follows 15 people, and only the first person they followed has a release in the last 30 days
- **THEN** that release appears in their notifications

#### Scenario: Many follows with a cold cache
- **WHEN** a user follows 500 people, none of whose credits are cached, and the notifications endpoint is polled repeatedly
- **THEN** each poll covers people the previous polls didn't, and after a bounded number of polls every followed person's releases can appear

### Requirement: Per-person credit lookups are cached without caching failures
The system SHALL reuse a person's fetched credits for a limited time, so
repeated polls don't refetch every followed person from TMDB. A failed fetch
SHALL NOT be cached: the next poll SHALL try that person again.

#### Scenario: Repeated polls
- **WHEN** the notifications endpoint is called twice within a few minutes
- **THEN** the second call makes no TMDB credit requests for people already fetched successfully

#### Scenario: Failed fetch
- **WHEN** fetching one person's credits fails during a poll
- **THEN** the next poll fetches that person's credits again

### Requirement: Notification popup opens fully on-screen
When the user opens the notification dropdown from any bell, the whole popup SHALL lie inside the viewport. This applies at phone (<768px), tablet (768–991px) and desktop (≥992px) widths, including the desktop sidebar's manually collapsed icon rail. The popup SHALL stay attached to its bell while the page scrolls.

#### Scenario: Desktop sidebar bell
- **WHEN** a signed-in user opens the bell in the sidebar at 1366×768
- **THEN** the popup's left, right, top and bottom edges are all inside the viewport

#### Scenario: Tablet icon-rail bell
- **WHEN** a signed-in user opens the bell in the 64px icon rail at 800px width
- **THEN** the popup's left edge is at or right of the viewport's left edge, and its right edge is inside the viewport

#### Scenario: Phone bottom-nav bell
- **WHEN** a signed-in user opens the bell in the bottom navigation at 375px width
- **THEN** the popup sits above the bottom navigation and fits horizontally inside the viewport

#### Scenario: Popup follows its bell on scroll
- **WHEN** the popup is open on a browse page and the page scrolls
- **THEN** the popup stays anchored to its bell and does not drift or jump

### Requirement: A notifications poll finishes within a bounded time
The notifications endpoint SHALL respond within a fixed time budget that is shorter than the server's request timeout, however many people the user follows and however slow TMDB is. Credits fetched during a poll SHALL be cached as they arrive, so a poll cut short by its budget still saves what it fetched.

#### Scenario: Slow TMDB
- **WHEN** every TMDB credits request takes the full request timeout to answer
- **THEN** the notifications endpoint still responds within its budget, without the server killing the request

#### Scenario: Budget reached mid-batch
- **WHEN** a poll reaches its time budget after some people's credits have arrived
- **THEN** those people's credits are cached, and the next poll doesn't fetch them again
