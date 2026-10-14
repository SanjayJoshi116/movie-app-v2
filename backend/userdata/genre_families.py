"""One genre vocabulary for movies and TV.

TMDB genre ids are specific to a media type: movies have Action (28) and
Adventure (12), TV only Action & Adventure (10759). Counting raw ids split one
taste in two, and sending a movie id to /discover/tv (or AND-ing 28 with 10759)
returned nothing. A *family* groups a movie genre with its TV counterpart;
counts and clusters use families, and every TMDB query translates a family back
into that media type's own ids.

Static, like tmdb_client.STATIC_GENRE_NAMES: TMDB's genre ids haven't changed
in years. An id this table doesn't know becomes a family of its own, for the
media type it was seen on, so a new TMDB genre degrades to the old behavior.
"""

# Families that merge ids, primary id first (the one used when AND-ing
# several families, since TMDB doesn't document mixing `|` and `,`).
MERGED = {
    "action-adventure": {"movie": [28, 12], "tv": [10759]},
    "scifi-fantasy": {"movie": [878, 14], "tv": [10765]},
    "war-politics": {"movie": [10752], "tv": [10768]},
}
# The TV genre's name is TMDB's own name for the merged family.
MERGED_NAME_ID = {"action-adventure": 10759, "scifi-fantasy": 10765, "war-politics": 10768}

_SHARED = [16, 35, 80, 99, 18, 10751, 9648, 37]
_MOVIE_ONLY = [36, 27, 10402, 10749, 10770, 53]
_TV_ONLY = [10762, 10763, 10764, 10766, 10767]

IDS: dict[str, dict[str, list[int]]] = {
    **MERGED,
    **{str(g): {"movie": [g], "tv": [g]} for g in _SHARED},
    **{str(g): {"movie": [g], "tv": []} for g in _MOVIE_ONLY},
    **{str(g): {"movie": [], "tv": [g]} for g in _TV_ONLY},
}

FAMILY_OF: dict[int, str] = {
    gid: family for family, by_type in IDS.items() for ids in by_type.values() for gid in ids
}


def family_of(genre_id, media_type=None):
    """The family of one TMDB genre id. An unknown id is its own family,
    registered for each `media_type` it is seen with (both types when unknown)."""
    family = FAMILY_OF.get(genre_id)
    if family is not None:
        return family
    family = str(genre_id)
    types = [media_type] if media_type in ("movie", "tv") else ["movie", "tv"]
    if family not in IDS:
        IDS[family] = {"movie": [], "tv": []}
    # Each type it's seen on, not only the first: the same new id on the
    # other type must be queryable there too.
    for t in types:
        if genre_id not in IDS[family][t]:
            IDS[family][t].append(genre_id)
    return family


def families(genre_ids, media_type=None):
    """Distinct families of a title's genre ids, in first-seen order: a movie
    tagged Action and Adventure counts once for action-adventure."""
    out = []
    for gid in genre_ids or []:
        family = family_of(gid, media_type)
        if family not in out:
            out.append(family)
    return out


def with_genres(media_type, family_keys):
    """A TMDB `with_genres` value for `media_type`, or None when that type has
    no id for one of the families (don't query it).

    One family: all its ids OR-ed (`28|12`). Several: each family's primary id
    AND-ed (`28,18`); mixing `|` and `,` in one value isn't documented.
    """
    keys = list(dict.fromkeys(family_keys))
    if not keys:
        return None
    id_lists = [IDS.get(k, {}).get(media_type, []) for k in keys]
    if any(not ids for ids in id_lists):
        return None
    if len(id_lists) == 1:
        return "|".join(str(g) for g in id_lists[0])
    return ",".join(str(ids[0]) for ids in id_lists)


def family_name(family, names):
    """Display name: TMDB's TV name for a merged family, else the name of its
    single id from `names` ({genre_id: name})."""
    name_id = MERGED_NAME_ID.get(family)
    if name_id is None:
        by_type = IDS.get(family, {})
        ids = by_type.get("movie") or by_type.get("tv") or []
        name_id = ids[0] if ids else None
    if name_id is None:
        return f"Genre {family}"
    return names.get(name_id, f"Genre {name_id}")
