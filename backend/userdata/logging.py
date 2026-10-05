import logging

from django.conf import settings


class RedactingFormatter(logging.Formatter):
    """Strips the TMDB API key from formatted records, tracebacks included.

    tmdb_client passes the key as a v3 `?api_key=` query param, so any
    requests.HTTPError message (and its traceback) embeds it verbatim.
    Redacting here, on the handler, covers every logger call site at once.
    """

    def format(self, record):
        text = super().format(record)
        key = getattr(settings, "TMDB_API_KEY", "")
        if key:
            text = text.replace(key, "***")
        return text
