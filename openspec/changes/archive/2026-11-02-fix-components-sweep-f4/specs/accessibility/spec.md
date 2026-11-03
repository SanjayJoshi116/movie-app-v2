## ADDED Requirements

### Requirement: A page has one main landmark
Every page SHALL have exactly one `main` landmark. Regions inside it that need a name SHALL use a labelled section, not another `main`.

#### Scenario: Movies grid
- **WHEN** a screen reader user lists the landmarks on /movies
- **THEN** there is one main landmark, and the results are a region named "Movie results" inside it

### Requirement: A navigation to a page with the same title is announced
After an in-app navigation, the new page's title SHALL be announced even when it is identical to the previously announced title.

#### Scenario: Two films with one name
- **WHEN** a screen reader user on "Dune" (2021) opens "Dune" (1984) from its recommendations
- **THEN** "Dune · CINE DB" is announced again

### Requirement: Shortened titles stay readable after the font loads
A title cut short with an ellipsis SHALL offer its full text (tooltip and hover scroll), including when it only overflows once the app's web font has loaded.

#### Scenario: Font swaps in after the cards render
- **WHEN** a card's title fits in the fallback font but overflows once Poppins loads
- **THEN** the title carries the full text as its tooltip
