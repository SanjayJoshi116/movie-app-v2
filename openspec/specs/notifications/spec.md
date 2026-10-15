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
SHALL NOT be cached: the next poll SHALL try that person again. TMDB
answering that a person doesn't exist is not a failure: that person SHALL be
cached as having no credits, for the same limited time. Cached credits SHALL
be stored apart from the server's rate-limit counters and TMDB proxy entries,
and their storage SHALL be bounded, so that no number of follows or polls can
evict a rate-limit counter.

#### Scenario: Repeated polls
- **WHEN** the notifications endpoint is called twice within a few minutes
- **THEN** the second call makes no TMDB credit requests for people already fetched successfully

#### Scenario: Failed fetch
- **WHEN** fetching one person's credits fails during a poll
- **THEN** the next poll fetches that person's credits again

#### Scenario: Followed person removed from TMDB
- **WHEN** TMDB reports a followed person as not found during a poll
- **THEN** that person shows no new releases, and the next poll within the cache time makes no TMDB request for them

#### Scenario: Credit cache fills up
- **WHEN** enough people's credits are cached to reach the credit cache's size limit
- **THEN** older credit entries are evicted, and no rate-limit counter or proxy entry is lost

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

### Requirement: Marking seen is not undone by an earlier poll
After notifications are marked seen, a poll response for a request that started before the mark-seen request finished SHALL NOT bring back the unread badge or unread state. A poll that starts after the mark-seen request finished SHALL be shown as usual.

#### Scenario: Poll in flight while closing the dropdown
- **WHEN** a notifications poll is in flight, the user closes the dropdown (marking items seen), and the poll then responds with those items as unread
- **THEN** the badge stays cleared

#### Scenario: Poll starts while the mark-seen request is in flight
- **WHEN** the user closes the dropdown, a poll starts before the mark-seen request has finished, and the server answers that poll with the items still unread
- **THEN** the badge stays cleared, and the next poll after the mark-seen request finished is shown as usual

### Requirement: Notifications follow the user's follows and skip watched titles
Following or unfollowing a person, or restoring follows from a backup, SHALL update the notifications shortly after the change succeeds, without waiting for the next scheduled check. Several follow changes in quick succession SHALL lead to one update, not one each. An update SHALL NOT be replaced by the answer to an earlier check that arrives after it. Notifications SHALL NOT include titles the user has already marked watched.

#### Scenario: Follow someone with a new release
- **WHEN** a user follows a person who has a release in the past week
- **THEN** that release appears in the notifications without waiting for the next scheduled check

#### Scenario: Unfollow
- **WHEN** a user unfollows the only person behind a notification
- **THEN** that notification disappears without waiting for the next scheduled check

#### Scenario: Already watched
- **WHEN** a followed person's new release is a title the user already marked watched
- **THEN** it isn't listed in the notifications

#### Scenario: Follow many people quickly
- **WHEN** a user follows ten people on the People page within a few seconds
- **THEN** the notifications are checked once after the last follow, and the bell doesn't show an error

#### Scenario: Earlier check answers last
- **WHEN** a user follows person A and then person B, and the check started for A answers after the check started for B
- **THEN** the notifications show the result that includes B

#### Scenario: Restored follows
- **WHEN** a user restores a backup that adds followed people, one of whom has a release in the past week
- **THEN** that release appears in the notifications without waiting for the next scheduled check

### Requirement: A followed person without a name is still labelled
A followed person whose stored name is blank (for example from a hand-edited backup) SHALL be shown as "Person <id>" wherever a name is shown: their card, their notifications, and the follow and unfollow messages.

#### Scenario: Blank name in a restored backup
- **WHEN** a restored backup follows person 287 with an empty name, and that person has a release in the past week
- **THEN** the Following page card and the notification both read "Person 287"

### Requirement: A notifications poll's work grows with recent releases, not total credits
A notifications poll SHALL read, for each followed person, only the credits that can fall inside the notification window, not the person's full credit list. The amount of cached data one poll loads SHALL depend on how many recent and upcoming releases the followed people have, not on how many credits they have in total.

#### Scenario: Prolific followed people
- **WHEN** a user follows 1,000 people whose cached credit lists hold hundreds of titles each, and only a few of those titles were released in the last 30 days
- **THEN** a poll loads data for those few recent titles per person, not the full credit lists, and returns the same notifications as before

#### Scenario: A release moves into the window
- **WHEN** a followed person's title is dated tomorrow at the time their credits are cached, and the user polls the next day within the cache lifetime
- **THEN** the title appears as a new release

### Requirement: A person's work behind the camera counts
A followed person's new releases SHALL include titles they worked on in any crew job (directing, writing, producing, composing and every other job), not only titles they acted in. A title SHALL appear once however many jobs the person had on it. Appearances as themselves on talk shows and news programmes SHALL NOT count as releases.

#### Scenario: Follow a director
- **WHEN** a user follows a director who directed a film released in the last 30 days and has no acting credit on it
- **THEN** that film appears in the user's notifications

#### Scenario: Several jobs on one title
- **WHEN** a followed person directed, wrote and produced the same new film
- **THEN** the film appears once

#### Scenario: Talk-show appearance
- **WHEN** a followed actor appears as themselves on a talk show episode aired this week
- **THEN** the talk show doesn't appear in the notifications

### Requirement: Unread means not seen at the last mark-seen
Marking notifications seen SHALL remember every notification the user had at that moment. On later polls, a notification SHALL be unread exactly when it wasn't among them, whatever its release date. A notification the user had when they last marked seen SHALL stay read. A user who hasn't marked notifications seen since this rule took effect SHALL keep the previous rule (unread when released after the last mark-seen day) until their next mark-seen.

#### Scenario: Title added late with a past date
- **WHEN** a user marks notifications seen, and the next day TMDB adds a followed person's film released five days ago
- **THEN** that film is unread and counts toward the badge

#### Scenario: Seen item stays read
- **WHEN** a user marks notifications seen while a film is in their list
- **THEN** that film is read on every later poll

#### Scenario: New follow
- **WHEN** a user follows someone whose film came out two weeks ago, after having marked notifications seen
- **THEN** that film appears unread

#### Scenario: Release appears later the same day
- **WHEN** a user marks notifications seen in the morning, and later that day a followed person's credits gain a title released that day
- **THEN** that title is unread and counts toward the unread badge
