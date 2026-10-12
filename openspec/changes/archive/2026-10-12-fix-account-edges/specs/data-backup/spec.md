## ADDED Requirements

### Requirement: Export All never saves an incomplete backup silently
"Export All" SHALL produce a file only when every part of the library it contains (watchlist, watched history, ratings, lists) has finished loading successfully. While any part is still loading, the export SHALL NOT produce a file and SHALL say the library is still loading. If any part failed to load, the export SHALL NOT produce a file, SHALL say which data couldn't be loaded, and SHALL offer a way to load it again. If building the file fails, an error SHALL be shown.

#### Scenario: Watched history failed to load
- **WHEN** the user's watched history failed to load and they click "Export All Data (ZIP)"
- **THEN** no file is downloaded, and an error says the backup would be incomplete and offers to load the data again

#### Scenario: Library still loading
- **WHEN** the user opens the profile dialog while their ratings are still loading
- **THEN** the export control shows that the library is loading and produces no file until loading finishes

#### Scenario: Everything loaded
- **WHEN** every part of the library loaded and the user clicks "Export All Data (ZIP)"
- **THEN** the backup file is downloaded with the whole library
