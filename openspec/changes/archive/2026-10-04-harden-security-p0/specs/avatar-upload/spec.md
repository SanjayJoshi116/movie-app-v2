## Purpose

Ensures that files users upload as profile pictures can only ever be stored and served as images, so an upload can't be used to run script on the application's origin.

## ADDED Requirements

### Requirement: Stored avatar type comes from the image content
The system SHALL determine an uploaded avatar's format by decoding the file content, and SHALL store it with the file extension for that decoded format (`.jpg`, `.png`, or `.webp`). The client-supplied filename and declared content type SHALL NOT affect the stored extension.

#### Scenario: Image with a misleading filename
- **WHEN** a user uploads a valid PNG image named `avatar.html` with declared type `image/png`
- **THEN** the upload succeeds and the stored avatar has a `.png` extension

#### Scenario: Polyglot file
- **WHEN** a user uploads a file that decodes as a valid image but also contains HTML/script, named `x.html`
- **THEN** the stored file has an image extension, and fetching its avatar URL returns an image content type, never `text/html`

### Requirement: Only JPEG, PNG, and WebP avatars are accepted
The system SHALL reject an avatar upload whose decoded image format isn't JPEG, PNG, or WebP, even if its declared content type is allowed. It SHALL also reject files that can't be decoded as an image, and files larger than 5 MB.

#### Scenario: GIF declared as JPEG
- **WHEN** a user uploads a GIF image with declared content type `image/jpeg`
- **THEN** the upload is rejected with "Unsupported image type. Use JPEG, PNG, or WebP." and the existing avatar is unchanged

#### Scenario: Non-image file
- **WHEN** a user uploads a text file with declared content type `image/png`
- **THEN** the upload is rejected with "File is not a valid image."

### Requirement: Served avatars are never interpreted as documents
Every file served from the avatar storage location SHALL be served with an image content type and with content-type sniffing disabled.

#### Scenario: Existing non-image extension
- **WHEN** the system is upgraded and an avatar stored earlier has a non-image extension
- **THEN** that file is no longer served as a document: it is either renamed to its decoded image format or removed, and the account falls back to having no avatar if it was removed
