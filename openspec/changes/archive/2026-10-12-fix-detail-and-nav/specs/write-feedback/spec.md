## MODIFIED Requirements

### Requirement: Follow state is consistent across views
Whether a person is followed SHALL be shared state for the session. Every view showing that person SHALL reflect a follow or unfollow made from any other view, without a reload. Showing a grid of people SHALL NOT make a separate followed-people request per card. While the followed-people list has failed to load, every Follow control, on person cards and on the person page alike, SHALL be disabled rather than claim the person is not followed. The Following page's recommendations SHALL be refetched whenever the set of followed people changes, including when one follow and one unfollow leave the count unchanged.

#### Scenario: Unfollow from a card on the Following page
- **WHEN** the user unfollows a person from their card on the Following page
- **THEN** that person is removed from the Following page's list

#### Scenario: Grid of people
- **WHEN** the People page renders a page of person cards
- **THEN** the followed-people list is fetched at most once for the whole grid

#### Scenario: Person page after a failed load
- **WHEN** the followed-people list failed to load and the user opens a person page
- **THEN** that page's Follow button is disabled

#### Scenario: Swap one followed person for another
- **WHEN** the user follows one person and unfollows another, then opens Following
- **THEN** the recommendations from followed people are fetched again for the new set
