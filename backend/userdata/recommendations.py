import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchedEntry, RatingEntry
from . import tmdb_client


def _fill_genre(entry):
    """Fetch and cache genre IDs for a single WatchedEntry."""
    try:
        ids = tmdb_client.get_genre_ids(entry.media_id, entry.media_type)
    except Exception:
        ids = []
    entry.genre_ids = ids
    entry.save(update_fields=["genre_ids"])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def personalized_recommendations(request):
    watched = list(WatchedEntry.objects.filter(user=request.user))
    if len(watched) < 3:
        return Response([])

    # Build rating lookup: "type-id" -> user_rating (0..10)
    rating_map = {
        f"{r.media_type}-{r.media_id}": r.user_rating
        for r in RatingEntry.objects.filter(user=request.user)
    }

    # --- Fill genre cache concurrently for entries missing it ---
    missing = [e for e in watched if not e.genre_ids]
    if missing:
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(_fill_genre, e): e for e in missing}
            for f in as_completed(futures):
                f.result()  # surface exceptions if any

    # --- Build genre vocabulary ---
    all_genre_ids = sorted({g for entry in watched for g in (entry.genre_ids or [])})
    if not all_genre_ids:
        return Response([])
    genre_index = {g: i for i, g in enumerate(all_genre_ids)}
    n_genres = len(all_genre_ids)

    # --- Build rating-weighted feature matrix (N_items × N_genres) ---
    X = np.zeros((len(watched), n_genres))
    for i, entry in enumerate(watched):
        key = f"{entry.media_type}-{entry.media_id}"
        weight = rating_map.get(key, 5.0) / 10.0  # default 0.5 if unrated
        for g in (entry.genre_ids or []):
            if g in genre_index:
                X[i, genre_index[g]] = weight

    # --- K-Means: k scales with watchlist size ---
    k = max(2, min(4, len(watched) // 3))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)
    centroids = kmeans.cluster_centers_  # (k, n_genres)

    # --- Fetch genre name maps ---
    try:
        genre_name_map = {**tmdb_client.get_genre_names("movie"), **tmdb_client.get_genre_names("tv")}
    except Exception:
        genre_name_map = {}

    watched_set = {(e.media_id, e.media_type) for e in watched}
    seen = set()
    sections = []

    for cluster_idx in range(k):
        centroid = centroids[cluster_idx]

        # Top 2 genres by centroid weight
        top_indices = np.argsort(centroid)[::-1][:2]
        top_genre_ids = [all_genre_ids[i] for i in top_indices if centroid[i] > 0]
        if not top_genre_ids:
            continue

        label = "Your Taste: " + " & ".join(
            genre_name_map.get(g, str(g)) for g in top_genre_ids
        )

        # Fetch candidates from TMDB Discover (movie + tv)
        candidates = []
        for media_type in ("movie", "tv"):
            try:
                results = tmdb_client.discover(media_type, top_genre_ids)
            except Exception:
                results = []
            for r in results:
                mid = r.get("id")
                key = (mid, media_type)
                if key in watched_set or key in seen:
                    continue
                seen.add(key)
                candidates.append({
                    "id": mid,
                    "type": media_type,
                    "title": r.get("title") or r.get("name", ""),
                    "posterPath": r.get("poster_path"),
                    "voteAverage": r.get("vote_average", 0),
                    "popularity": r.get("popularity", 0),
                    "genre_ids": r.get("genre_ids", []),
                })

        if not candidates:
            continue

        # Score: 0.5 * genre_cosine_sim + 0.3 * norm_vote + 0.2 * (1 - norm_pop)
        max_pop = max((c["popularity"] for c in candidates), default=1) or 1
        scored = []
        for c in candidates:
            c_vec = np.zeros(n_genres)
            for g in c["genre_ids"]:
                if g in genre_index:
                    c_vec[genre_index[g]] = 1.0
            sim = (
                float(cosine_similarity(c_vec.reshape(1, -1), centroid.reshape(1, -1))[0][0])
                if c_vec.sum() > 0 and centroid.sum() > 0
                else 0.0
            )
            norm_vote = c["voteAverage"] / 10.0
            norm_pop = min(c["popularity"] / max_pop, 1.0)
            score = 0.5 * sim + 0.3 * norm_vote + 0.2 * (1.0 - norm_pop)
            scored.append((score, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        items = [
            {k: v for k, v in c.items() if k != "genre_ids"}
            for _, c in scored[:12]
        ]

        sections.append({"key": f"cluster-{cluster_idx}", "label": label, "items": items})

    return Response(sections)
