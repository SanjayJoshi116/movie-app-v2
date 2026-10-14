## MODIFIED Requirements

### Requirement: Only JPEG, PNG, and WebP avatars are accepted
The system SHALL reject an avatar upload whose decoded image format isn't JPEG, PNG, or WebP, even if its declared content type is allowed. It SHALL also reject files that can't be decoded as an image, files larger than 5 MB, and images whose pixel dimensions exceed the image decoder's decompression-safety limit. It SHALL also reject images over 16 megapixels, checked from the header before the pixels are decoded. Every such rejection SHALL be a `400` response. A malformed or hostile image SHALL never cause a server error.

#### Scenario: GIF declared as JPEG
- **WHEN** a user uploads a GIF image with declared content type `image/jpeg`
- **THEN** the upload is rejected with "Unsupported image type. Use JPEG, PNG, or WebP." and the existing avatar is unchanged

#### Scenario: Non-image file
- **WHEN** a user uploads a text file with declared content type `image/png`
- **THEN** the upload is rejected with "File is not a valid image."

#### Scenario: Decompression bomb
- **WHEN** a user uploads a small PNG file whose header declares dimensions far above the decoder's pixel limit (for example 30000×30000)
- **THEN** the upload is rejected with `400` "File is not a valid image.", and the existing avatar is unchanged

#### Scenario: Large single-colour image under the decoder limit
- **WHEN** a user uploads a 9400×9400 single-colour PNG of a few hundred KB
- **THEN** the upload is rejected with `400` saying the image is too large, and the existing avatar is unchanged

## ADDED Requirements

### Requirement: Stored avatars have a bounded resolution
An accepted avatar larger than 1024 pixels on either side SHALL be stored scaled down, keeping its aspect ratio, so that neither side exceeds 1024 pixels. Smaller images SHALL keep their size.

#### Scenario: Large phone photo
- **WHEN** a user uploads a 4000×3000 JPEG
- **THEN** the stored avatar is 1024×768

#### Scenario: Small image
- **WHEN** a user uploads a 400×400 PNG
- **THEN** the stored avatar is 400×400

### Requirement: Concurrent avatar replaces leave no orphaned file
When two avatar uploads for one account run at the same time, exactly one file SHALL remain stored for that account afterwards, and it SHALL be the one the profile points to.

#### Scenario: Two uploads at once
- **WHEN** a user's two browser tabs upload different avatars at the same moment
- **THEN** the profile points to one of them, and the other new file and the previous avatar are no longer served
