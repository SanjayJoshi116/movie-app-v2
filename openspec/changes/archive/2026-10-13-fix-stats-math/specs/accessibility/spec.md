## ADDED Requirements

### Requirement: The activity heatmap is keyboard-readable
The Stats activity heatmap SHALL be reachable with a single Tab stop. While it has focus, the arrow keys SHALL move between days following the grid (columns are weeks and rows are weekdays, so Up/Down move one day and Left/Right one week), staying within the shown days, and the focused day's date and count SHALL be shown visibly and announced to assistive technology. Leaving the heatmap with Tab SHALL NOT require passing through each day.

#### Scenario: Reading a day from the keyboard
- **WHEN** a keyboard user tabs to the heatmap and presses Up
- **THEN** the previous day is highlighted and its date and count are shown and announced

#### Scenario: Tabbing past
- **WHEN** a keyboard user tabs into the heatmap and presses Tab again
- **THEN** focus moves to the next control after the heatmap
