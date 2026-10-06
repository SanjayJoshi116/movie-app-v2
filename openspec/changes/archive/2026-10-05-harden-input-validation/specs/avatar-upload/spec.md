## MODIFIED Requirements

### Requirement: Only JPEG, PNG, and WebP avatars are accepted
The system SHALL reject an avatar upload whose decoded image format isn't JPEG, PNG, or WebP, even if its declared content type is allowed. It SHALL also reject files that can't be decoded as an image, files larger than 5 MB, and images whose pixel dimensions exceed the image decoder's decompression-safety limit. Every such rejection SHALL be a `400` response. A malformed or hostile image SHALL never cause a server error.

#### Scenario: GIF declared as JPEG
- **WHEN** a user uploads a GIF image with declared content type `image/jpeg`
- **THEN** the upload is rejected with "Unsupported image type. Use JPEG, PNG, or WebP." and the existing avatar is unchanged

#### Scenario: Non-image file
- **WHEN** a user uploads a text file with declared content type `image/png`
- **THEN** the upload is rejected with "File is not a valid image."

#### Scenario: Decompression bomb
- **WHEN** a user uploads a small PNG file whose header declares dimensions far above the decoder's pixel limit (for example 30000×30000)
- **THEN** the upload is rejected with `400` "File is not a valid image.", and the existing avatar is unchanged

#### Scenario: Image just above the warning threshold
- **WHEN** a user uploads an image whose pixel count is above the decoder's warning limit but below its hard error limit
- **THEN** the upload is rejected with `400` "File is not a valid image."
