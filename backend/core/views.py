from django.conf import settings
from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from drf_spectacular.utils import extend_schema
from redis import Redis, RedisError
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


@require_GET
def health(request):
    """Liveness must remain available even when dependencies are restarting."""
    return JsonResponse({"status": "ok"})


@require_GET
def ready(request):
    checks = {"database": False, "redis": False}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            checks["database"] = cursor.fetchone() == (1,)
    except (DatabaseError, OSError):
        pass
    try:
        with Redis.from_url(
            settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1
        ) as client:
            checks["redis"] = bool(client.ping())
    except (RedisError, OSError):
        pass
    healthy = all(checks.values())
    return JsonResponse(
        {"status": "ok" if healthy else "unavailable", "checks": checks},
        status=200 if healthy else 503,
    )


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()


class HealthAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses=HealthSerializer, auth=[], summary="API process liveness")
    def get(self, request):
        return Response({"status": "ok"})
