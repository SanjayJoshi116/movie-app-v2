import logging
import re

from django.conf import settings

# TMDB credentials that travel as query params (`?session_id=`, `request_token=`)
# or in a JSON body. requests puts the full URL in HTTPError messages.
_CREDENTIAL_PARAM = re.compile(r"\b(session_id|request_token)=[^&\s'\"]+")
_CREDENTIAL_JSON = re.compile(r'("(?:session_id|request_token)"\s*:\s*)"[^"]*"')


class RedactingFormatter(logging.Formatter):
    """Strips the TMDB API key and TMDB session ids / request tokens from
    formatted records, tracebacks included.

    tmdb_client passes the key as a v3 `?api_key=` query param, so any
    requests.HTTPError message (and its traceback) embeds it verbatim.
    Redacting here, on the handler, covers every logger call site at once.
    """

    def format(self, record):
        text = super().format(record)
        key = getattr(settings, "TMDB_API_KEY", "")
        if key:
            text = text.replace(key, "***")
        text = _CREDENTIAL_PARAM.sub(r"\1=***", text)
        return _CREDENTIAL_JSON.sub(r'\1"***"', text)
