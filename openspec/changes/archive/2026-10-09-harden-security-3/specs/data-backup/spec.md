## ADDED Requirements

### Requirement: Oversized backup files are rejected before decompression
The backup import SHALL refuse a file larger than 50 MB, or one whose entries declare an uncompressed size above 50 MB each or 200 MB in total. It SHALL do this before decompressing anything, and SHALL show a message saying the file is too large to be a backup.

#### Scenario: Zip bomb
- **WHEN** a user selects a 1 MB ZIP whose single entry expands to 2 GB
- **THEN** the import shows the too-large message, nothing is decompressed, and the tab stays responsive

#### Scenario: Normal backup
- **WHEN** a user selects a backup exported by the app
- **THEN** it is previewed and imported as before
