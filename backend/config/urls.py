from django.conf import settings
from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import HealthAPIView, health, ready

urlpatterns = [
    path("healthz", health, name="health"),
    path("readyz", ready, name="ready"),
    path("api/v1/health/", HealthAPIView.as_view(), name="api-health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
]

# The bootstrap supervisor is a local Django admin account, not the Phase 1 employee login.
# Keep its login surface out of production while the actual permission model is not built.
if settings.DEBUG:
    urlpatterns.append(path("admin/", admin.site.urls))
