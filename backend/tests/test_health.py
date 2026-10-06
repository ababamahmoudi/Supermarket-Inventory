from unittest.mock import MagicMock, patch

import pytest
from django.db import OperationalError
from django.test import override_settings
from django.urls import clear_url_caches
from redis import ConnectionError as RedisConnectionError


@pytest.mark.parametrize("path", ["/healthz", "/api/v1/health/"])
def test_liveness_is_public_and_independent_of_dependencies(client, path):
    with (
        patch("core.views.connection.cursor", side_effect=OperationalError("database offline")),
        patch("core.views.Redis.from_url", side_effect=RedisConnectionError("redis offline")),
    ):
        response = client.get(path)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def dependency_mocks(database_ok=True, redis_ok=True):
    cursor = MagicMock()
    cursor.__enter__.return_value.fetchone.return_value = (1,)
    database = patch("core.views.connection.cursor", return_value=cursor)
    if not database_ok:
        database = patch(
            "core.views.connection.cursor", side_effect=OperationalError("private details")
        )
    redis = MagicMock()
    redis.__enter__.return_value.ping.return_value = True
    cache = patch("core.views.Redis.from_url", return_value=redis)
    if not redis_ok:
        cache = patch(
            "core.views.Redis.from_url", side_effect=RedisConnectionError("private details")
        )
    return database, cache


@pytest.mark.parametrize(
    "database_ok,redis_ok", [(True, True), (False, True), (True, False), (False, False)]
)
def test_readiness_reports_dependency_failures_without_private_details(
    client, database_ok, redis_ok
):
    database, cache = dependency_mocks(database_ok, redis_ok)
    with database, cache:
        response = client.get("/readyz")
    healthy = database_ok and redis_ok
    assert response.status_code == (200 if healthy else 503)
    assert response.json() == {
        "status": "ok" if healthy else "unavailable",
        "checks": {"database": database_ok, "redis": redis_ok},
    }


@pytest.mark.parametrize("path", ["/healthz", "/readyz", "/api/v1/health/"])
def test_health_endpoints_do_not_accept_writes(client, path):
    assert client.post(path).status_code == 405


def test_openapi_schema_only_exposes_the_public_health_scaffold(client):
    response = client.get("/api/schema/", HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    assert response.json()["openapi"].startswith("3.")
    assert set(response.json()["paths"]) == {"/api/v1/health/"}
    assert client.get("/api/docs").status_code == 200


@pytest.mark.parametrize("path", ["/api/v1/companies/", "/api/v1/branches/", "/api/v1/payables/"])
def test_no_business_data_api_exists_in_phase_zero(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.django_db
def test_demo_admin_requires_authentication(client):
    with override_settings(DEBUG=True):
        import importlib

        from config import urls

        importlib.reload(urls)
        clear_url_caches()
        response = client.get("/admin/")
        assert response.status_code == 302
        assert "/admin/login/" in response.url


def test_admin_login_is_not_available_with_debug_disabled(client):
    with override_settings(DEBUG=False):
        import importlib

        from config import urls

        importlib.reload(urls)
        clear_url_caches()
        assert client.get("/admin/").status_code == 404
    importlib.reload(urls)
    clear_url_caches()
