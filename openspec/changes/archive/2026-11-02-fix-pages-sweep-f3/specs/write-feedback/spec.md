## MODIFIED Requirements

### Requirement: Forms submit once per activation
While a form's submit request is in flight (registration, creating a list, editing a list, requesting a password reset, setting a new password), the submit control SHALL show a busy state, and repeated activation (double-click, a second Enter) SHALL NOT send another request. This holds wherever a list can be created, including the Add to List dialog's inline create.

#### Scenario: Double-click Register
- **WHEN** the user double-clicks Register with valid details
- **THEN** one registration request is sent, and no "username already exists" error appears over the successful signup

#### Scenario: Double-click OK on New List
- **WHEN** the user double-clicks OK in the New List dialog
- **THEN** exactly one list is created

#### Scenario: Double-click Save on list edit
- **WHEN** the user double-clicks Save in the list edit dialog
- **THEN** one update request is sent and one success message is shown

#### Scenario: Enter twice on Reset Password
- **WHEN** the user presses Enter twice quickly on the Reset Password form with a valid new password
- **THEN** one reset request is sent, and no "invalid or expired link" error appears beside the success message

#### Scenario: Enter twice on Forgot Password
- **WHEN** the user presses Enter twice quickly on the Forgot Password form
- **THEN** one reset email request is sent

## ADDED Requirements

### Requirement: Watched and watchlist buttons run the action they show
A button that marks a title watched or unwatched, or adds it to or removes it from the watchlist, SHALL run that exact action, never a toggle that decides at run time. Its success message SHALL name the action that ran. If the title's state changed before the action ran (another card, a reload), the action SHALL still be the one shown when the user clicked or confirmed. This SHALL hold on every card and page that offers these buttons, including the Recommendations cards and the Watchlist page.

#### Scenario: Title became watched while the dialog was open
- **WHEN** the user opens Mark as Watched on a Recommendations card, and the title becomes watched elsewhere before they confirm
- **THEN** confirming leaves the title watched (with the entered details), and the title is never unmarked

#### Scenario: Watchlist button after a stale render
- **WHEN** a Recommendations card shows "Add to watchlist" for a title that another view has just added, and the user clicks it
- **THEN** the title stays in the watchlist, and no "Removed from watchlist" message appears

### Requirement: List dialogs hold while saving
While the Create List or Edit List dialog's save is in flight, the dialog SHALL NOT close: Cancel, Escape, the mask and the close button SHALL do nothing. When the save fails, the dialog SHALL stay open with what the user typed.

#### Scenario: Escape during create
- **WHEN** the user clicks Create in the New List dialog and presses Escape before the server answers
- **THEN** the dialog stays open, and if the create fails the typed name and description are still there
