import json
from copy import deepcopy
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from tenancy.models import Branch, Company, DemoSupervisor

pytestmark = pytest.mark.django_db
SEED_PATH = Path(__file__).resolve().parents[2] / "seed" / "arzon-config.json"


@pytest.fixture
def development_account(monkeypatch):
    monkeypatch.setenv("DEV_SUPERVISOR_USERNAME", "test.supervisor")
    monkeypatch.setenv("DEV_SUPERVISOR_EMAIL", "test@example.invalid")
    monkeypatch.setenv("DEV_SUPERVISOR_PASSWORD", "fake-test-password-12345")
    with override_settings(DEBUG=True):
        yield


def write_config(tmp_path, data, name="company.json"):
    path = tmp_path / name
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_seed_loads_confirmed_configuration_and_remains_idempotent(development_account):
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    call_command("seed_arzon")
    call_command("seed_arzon")
    assert Company.objects.count() == 1
    company = Company.objects.get()
    assert company.seed_key == data["company"]["seed_key"]
    assert company.currency == "CAD"
    assert company.timezone == "America/Toronto"
    assert company.configuration == data
    assert Branch.objects.for_company(company.id).count() == len(data["branches"])
    assert company.configuration["labels"]["templates"] == []
    assert DemoSupervisor.objects.for_company(company.id).count() == 1
    assert get_user_model().objects.count() == 1
    assert get_user_model().objects.get().check_password("fake-test-password-12345")


def test_repeated_seed_preserves_local_changes_and_password(development_account, monkeypatch):
    call_command("seed_arzon")
    company = Company.objects.get()
    company.name_en = "Local edited name"
    company.configuration = {"local": "customized"}
    company.save()
    branch = Branch.objects.first()
    branch.name_en = "Local renamed branch"
    branch.active = False
    branch.save()
    user = get_user_model().objects.get()
    user.email = "changed@example.invalid"
    user.set_password("local-custom-password-12345")
    user.is_active = False
    user.save()
    monkeypatch.setenv("DEV_SUPERVISOR_PASSWORD", "another-fake-password")
    call_command("seed_arzon")
    company.refresh_from_db()
    branch.refresh_from_db()
    user.refresh_from_db()
    assert company.name_en == "Local edited name"
    assert company.configuration == {"local": "customized"}
    assert branch.name_en == "Local renamed branch"
    assert branch.active is False
    assert user.email == "changed@example.invalid"
    assert user.check_password("local-custom-password-12345")
    assert user.is_active is False


def test_seeded_demo_supervisor_can_sign_into_the_local_admin(development_account, client):
    import importlib

    from django.urls import clear_url_caches

    from config import urls

    call_command("seed_arzon")
    importlib.reload(urls)
    clear_url_caches()
    assert not client.login(username="test.supervisor", password="wrong-password")
    assert client.login(username="test.supervisor", password="fake-test-password-12345")
    assert client.get("/admin/").status_code == 200
    assert client.get("/api/v1/payables/").status_code == 404


def test_explicit_refresh_changes_settings_but_never_deletes_branches_or_accounts(
    development_account, tmp_path
):
    call_command("seed_arzon")
    company = Company.objects.get()
    original_branch_count = Branch.objects.count()
    user = get_user_model().objects.get()
    original_hash = user.password
    data = deepcopy(company.configuration)
    data["company"]["name"] = "Explicit new company name"
    data["company"].pop("name_en", None)
    data["branches"] = data["branches"][:1]
    data["branches"][0]["name"] = "Explicit new branch name"
    data["branches"][0].pop("name_en", None)
    call_command("seed_arzon", config=write_config(tmp_path, data), refresh_config=True)
    company.refresh_from_db()
    user.refresh_from_db()
    assert company.name_en == "Explicit new company name"
    assert company.configuration == data
    assert Branch.objects.count() == original_branch_count
    assert (
        Branch.objects.get(code=data["branches"][0]["code"]).name_en == "Explicit new branch name"
    )
    assert user.password == original_hash


def test_bootstrap_company_and_branch_scopes_cannot_read_another_company(
    development_account, tmp_path, monkeypatch
):
    call_command("seed_arzon")
    first = Company.objects.get()
    first_branch = first.branches.first()
    other_data = deepcopy(first.configuration)
    other_data["company"]["seed_key"] = "other-market"
    other_data["company"]["name"] = "Other market"
    other_data["company"].pop("name_en", None)
    monkeypatch.setenv("DEV_SUPERVISOR_USERNAME", "other.supervisor")
    call_command("seed_arzon", config=write_config(tmp_path, other_data))
    other = Company.objects.exclude(id=first.id).get()
    other_branch = other.branches.first()
    assert not Branch.objects.for_company(first.id).filter(id=other_branch.id).exists()
    assert not Branch.objects.for_branches(first.id, [other_branch.id]).exists()
    assert list(Branch.objects.for_branches(first.id, [first_branch.id])) == [first_branch]
    assert not DemoSupervisor.objects.for_company(first.id).filter(company_id=other.id).exists()
    assert other.branches.count() == len(other_data["branches"])
    assert first.configuration != other.configuration
    with pytest.raises(ValueError, match="Company scope"):
        Branch.objects.for_company(None)


def test_seed_cannot_reassign_existing_account_to_another_company(development_account, tmp_path):
    call_command("seed_arzon")
    first = Company.objects.get()
    other_data = deepcopy(first.configuration)
    other_data["company"]["seed_key"] = "other-market"
    with pytest.raises(CommandError, match="username is already used"):
        call_command("seed_arzon", config=write_config(tmp_path, other_data))
    assert Company.objects.count() == 1  # Entire failed seed transaction rolled back.
    assert DemoSupervisor.objects.get().company_id == first.id


def test_seed_preserves_existing_unmanaged_user(development_account):
    user = get_user_model().objects.create_user(
        "test.supervisor", password="unmanaged-password-12345"
    )
    with pytest.raises(CommandError, match="existing accounts are preserved"):
        call_command("seed_arzon")
    user.refresh_from_db()
    assert user.is_superuser is False
    assert user.check_password("unmanaged-password-12345")
    assert Company.objects.count() == 0


def test_seed_is_forbidden_outside_development(development_account):
    with override_settings(DEBUG=False), pytest.raises(CommandError, match="Development seeding"):
        call_command("seed_arzon")
    assert Company.objects.count() == 0


@pytest.mark.parametrize("missing", ["DEV_SUPERVISOR_USERNAME", "DEV_SUPERVISOR_PASSWORD"])
def test_seed_missing_credentials_rolls_back_everything(development_account, monkeypatch, missing):
    monkeypatch.delenv(missing)
    with pytest.raises(CommandError, match=missing):
        call_command("seed_arzon")
    assert Company.objects.count() == 0
    assert Branch.objects.count() == 0
    assert get_user_model().objects.count() == 0


def test_seed_requires_stable_identity_and_accepts_explicit_identity(development_account, tmp_path):
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    data["company"].pop("seed_key")
    path = write_config(tmp_path, data)
    with pytest.raises(CommandError, match="company.seed_key"):
        call_command("seed_arzon", config=path)
    call_command("seed_arzon", config=path, company_key="explicit-company-identity")
    assert Company.objects.get().seed_key == "explicit-company-identity"


@pytest.mark.parametrize("field,value", [("currency", "PLACEHOLDER"), ("timezone", "PLACEHOLDER")])
def test_seed_rejects_unusable_business_settings(development_account, tmp_path, field, value):
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    data["company"][field] = value
    with pytest.raises(CommandError, match="Invalid seed configuration"):
        call_command("seed_arzon", config=write_config(tmp_path, data))
    assert Company.objects.count() == 0
