## ADDED Requirements

### Requirement: Bulk import counts add up to the entries sent
A bulk import response SHALL account for every entry it received: entries added, entries skipped as already present (including repeats of a title within the same request), entries ignored for having no id, and entries over the library limit. These counts SHALL add up to the number of entries sent, and the import result SHALL show each non-zero count.

#### Scenario: Chunk with repeats and missing ids
- **WHEN** a 500-entry import holds 20 entries without an id and 10 repeats of titles earlier in the same request, none already in the library
- **THEN** the response reports 470 added, 10 skipped and 20 ignored

### Requirement: A title stored without a name is shown with a fallback
A library entry stored with a blank title SHALL be shown, on its card and in its buttons' accessible names, as "Untitled (#<id>)", so the user can still tell entries apart.

#### Scenario: Imported row without a title
- **WHEN** a CSV import adds a watched row with TMDB id 603 and an empty title
- **THEN** its card reads "Untitled (#603)" and its remove button is named after that label

### Requirement: An import whose account was deleted ends cleanly
A bulk import that runs while its account is deleted SHALL be answered with an authentication error, never a server error, and SHALL store nothing.

#### Scenario: Account deleted mid-restore
- **WHEN** a user deletes their account in one tab while another tab's restore is sending a watched chunk
- **THEN** that chunk is answered 401 and no row is left behind
