## ADDED Requirements

### Requirement: A stalled TMDB proxy can't take other endpoints' time
TMDB proxy calls SHALL run on capacity of their own, separate from the TMDB calls other endpoints wait on (rating sync, TMDB connect, Stats' genre lookup). Proxy calls left running after their deadline SHALL only ever delay other proxy calls, so those endpoints keep their full time budget while TMDB is slow for the proxy.

#### Scenario: Proxy calls stall
- **WHEN** TMDB stops answering proxied requests and enough of them are in flight to fill the proxy's capacity, and a user then changes a rating with TMDB sync on
- **THEN** the rating's TMDB sync starts at once, within its own deadline, instead of waiting behind the stalled proxy calls
