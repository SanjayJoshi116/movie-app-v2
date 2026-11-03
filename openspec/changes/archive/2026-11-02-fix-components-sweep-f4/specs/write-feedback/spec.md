## MODIFIED Requirements

### Requirement: Watched and watchlist buttons run the action they show
A button that marks a title watched or unwatched, or adds it to or removes it from the watchlist, SHALL run that exact action, never a toggle that decides at run time. Its success message SHALL name the action that ran. If the title's state changed before the action ran (another card, a reload), the action SHALL still be the one shown when the user clicked or confirmed. This SHALL hold on every card and page that offers these buttons, including the Recommendations cards, the Watchlist page, and the movie and TV detail pages.

#### Scenario: Title became watched while the dialog was open
- **WHEN** the user opens Mark as Watched on a Recommendations card, and the title becomes watched elsewhere before they confirm
- **THEN** confirming leaves the title watched (with the entered details), and the title is never unmarked

#### Scenario: Watchlist button after a stale render
- **WHEN** a Recommendations card shows "Add to watchlist" for a title that another view has just added, and the user clicks it
- **THEN** the title stays in the watchlist, and no "Removed from watchlist" message appears

#### Scenario: Detail page watchlist button after a stale render
- **WHEN** a movie page shows "Add to watchlist" for a title that another tab has just added, and the user clicks it
- **THEN** the title stays in the watchlist and the message says it was added
