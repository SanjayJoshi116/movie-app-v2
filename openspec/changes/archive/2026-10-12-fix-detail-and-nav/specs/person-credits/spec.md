## Purpose

Defines which credits a person page lists, so actors, directors, writers and other crew all show the work they are known for, in a predictable order.

## ADDED Requirements

### Requirement: Person pages list crew credits in their own tab
A person page SHALL list the person's acting credits in "Movies" and "TV Shows" tabs and their crew credits (directing, writing, producing and every other job, movies and TV together) in a "Crew" tab. A tab SHALL be shown only when it has at least one credit. In the Crew tab a title SHALL appear once per media type, with all of the person's jobs on it joined in its subtitle. Each crew card SHALL open the right movie or TV page.

#### Scenario: Director's page
- **WHEN** the user opens the page of a person known for directing who has a few acting cameos
- **THEN** a "Crew" tab lists the titles they directed with "Director" in each subtitle

#### Scenario: Several jobs on one title
- **WHEN** a person is credited as Director and Writer on the same film
- **THEN** that film appears once in the Crew tab with both jobs in its subtitle

#### Scenario: Crew-only person
- **WHEN** a person has crew credits but no acting credits
- **THEN** the page shows the Crew tab and does not say "No credits available"

### Requirement: Credits open on the person's main department, newest first
When no tab is chosen in the URL, the page SHALL open the Crew tab for a person whose known-for department is not acting and who has crew credits, and the first available acting tab otherwise. In every credits tab, titles SHALL be ordered by release or first-air date, newest first, with undated titles last.

#### Scenario: Director opens on Crew
- **WHEN** the user opens a director's page with no tab in the URL
- **THEN** the Crew tab is selected

#### Scenario: Newest first
- **WHEN** a person's movie credits include films from 1999, 2019 and an unreleased film with no date
- **THEN** the tab lists the 2019 film, then the 1999 film, then the undated one
