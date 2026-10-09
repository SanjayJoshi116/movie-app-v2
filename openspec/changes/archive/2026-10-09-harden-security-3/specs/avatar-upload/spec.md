## ADDED Requirements

### Requirement: Stored avatars carry no embedded metadata
The system SHALL store an uploaded avatar as a newly encoded image in the same format, with EXIF and other embedded metadata (GPS position, camera make and serial, timestamps) removed. The stored image SHALL show the same orientation the uploaded photo displayed with.

#### Scenario: Phone photo with GPS
- **WHEN** a user uploads a JPEG whose EXIF contains GPS coordinates
- **THEN** the served avatar contains no EXIF data

#### Scenario: Rotated phone photo
- **WHEN** a user uploads a JPEG whose EXIF orientation says "rotate 90°"
- **THEN** the served avatar is stored already rotated and displays upright without EXIF
