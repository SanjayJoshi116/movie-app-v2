# untrusted-content Specification

## Purpose

Defines how values that come from TMDB or other third parties are used in the page, so community-edited data can't turn into script execution or other unsafe behavior in any deployment, with or without a content security policy.

## Requirements

### Requirement: Third-party URLs become links only with a web scheme
A URL taken from third-party data (such as a person's homepage) SHALL be rendered as a link only when its scheme is `http` or `https`. Any other value SHALL be shown as plain text or not at all.

#### Scenario: Script URL in a homepage
- **WHEN** a person's TMDB homepage is `javascript:alert(1)`
- **THEN** the person page shows no link with that target

#### Scenario: Normal homepage
- **WHEN** a person's homepage is `https://example.com`
- **THEN** it is shown as a link that opens in a new tab
