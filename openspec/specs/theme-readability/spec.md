# theme-readability Specification

## Purpose

Makes page text and UI chrome readable in both the light and dark themes, so switching theme never leaves labels, legends or tooltips washed out against the background.

## Requirements

### Requirement: Stats page is readable in both themes
The Stats page SHALL render its stat-card labels and suffixes, heatmap month
and legend labels, empty heatmap cells, chart and heatmap tooltips, and poster
captions in colors derived from the active theme. In light mode, none of these
SHALL be drawn as white or near-white text or fills on the light background. In
dark mode, they SHALL look as they did before this change.

#### Scenario: Light mode labels
- **WHEN** a user with watched titles opens Stats in light mode
- **THEN** the stat-card labels, heatmap "Less"/"More" legend and month labels are dark text that is clearly readable on the light background

#### Scenario: Light mode empty heatmap cells
- **WHEN** the heatmap shows days with no activity in light mode
- **THEN** those cells are visible as a light gray grid, not invisible white-on-white

#### Scenario: Tooltip in light mode
- **WHEN** the user hovers a chart point or heatmap cell in light mode
- **THEN** the tooltip's background and text follow the light theme and are readable

#### Scenario: Dark mode unchanged
- **WHEN** a user opens Stats in dark mode
- **THEN** labels, legend, cells and tooltips look the same as before this change
