"""Bootstrap data only. Employee permissions and business endpoints arrive in Phase 1."""

import uuid

from django.conf import settings
from django.db import models


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimestampedModel):
    seed_key = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=200)
    name_fa = models.CharField(max_length=200, blank=True)
    currency = models.CharField(max_length=3)
    timezone = models.CharField(max_length=100)
    configuration = models.JSONField(default=dict)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name_en


class CompanyScopedQuerySet(models.QuerySet):
    def for_company(self, company_id):
        if company_id is None:
            raise ValueError("Company scope is required.")
        return self.filter(company_id=company_id)


class BranchQuerySet(CompanyScopedQuerySet):
    def for_branches(self, company_id, allowed_branch_ids):
        return self.for_company(company_id).filter(id__in=allowed_branch_ids)


class Branch(TimestampedModel):
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="branches")
    code = models.CharField(max_length=30)
    name_en = models.CharField(max_length=200)
    name_fa = models.CharField(max_length=200, blank=True)
    active = models.BooleanField(default=True)
    objects = BranchQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_company_branch_code")
        ]

    def __str__(self):
        return self.name_en


class DemoSupervisor(TimestampedModel):
    """Local bootstrap mapping; not the eventual employee account or role model."""

    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    objects = CompanyScopedQuerySet.as_manager()
