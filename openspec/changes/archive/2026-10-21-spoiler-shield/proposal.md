## Why

A TV show's Episode Guide shows every episode's title, and an expanded episode shows its still and overview, even for episodes past where the user is. Someone tracking "Currently on S02E04" can read the title and plot of the season finale by scrolling the guide. The app already knows where they are (episode progress), so it can hide what comes after.

## What Changes

- The Episode Guide hides the title, still and overview of every episode after the user's tracked progress, for shows they track and haven't marked watched. Air date, runtime and score stay visible.
- A hidden episode can be revealed one at a time ("Show details").
- A "Hide spoilers" switch in the guide turns the shield off or on. The choice is a device preference, remembered like the theme.
- While the user's progress is loading, the guide waits instead of showing episodes it may need to hide. If progress fails to load, the guide shows episodes unhidden and says spoilers can't be hidden right now.
- When the user tracks a show, the guide opens on the season they're in instead of season 1.
- Hidden text isn't in the page at all, so screen readers don't read it out, and hidden stills aren't downloaded.

## Capabilities

### New Capabilities
- `spoiler-shield`: hiding episode titles, stills and overviews beyond the user's episode progress in the TV Episode Guide, revealing them per episode, and the device-wide on/off preference.

### Modified Capabilities
(none)

## Impact

- Frontend only. `src/components/EpisodeGuide.tsx` gains the shield. `src/components/TVShowDetails.tsx` passes it the progress state and watched status it already has.
- A new `localStorage` key (`cinedb_spoiler_shield`) through `useLocalStorage`, a device preference like `cinedb_theme`.
- No backend, API, migration or TMDB request changes. Hidden stills are simply not requested.
- Tests: Jest for the shield logic and guide, and the Python e2e detail tests (`e2e/python/test_detail.py`), whose default mock has no progress, so existing guide tests stay unshielded.
