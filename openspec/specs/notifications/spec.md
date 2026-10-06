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
