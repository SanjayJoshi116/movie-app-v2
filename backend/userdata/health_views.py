from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])  # polled every 10s by docker-compose; must never 429
def health(request):
    return Response({"status": "ok"})
