"""Load a configurable company's local development bootstrap without replacing user data."""

import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tenancy.models import Branch, Company, DemoSupervisor


class Command(BaseCommand):
    help = "Load local company configuration and create a development-only demo supervisor."

    def add_arguments(self, parser):
        parser.add_argument(
            "--config", type=Path, default=settings.BASE_DIR.parent / "seed/arzon-config.json"
        )
        parser.add_argument("--company-key", help="Stable seed identity when absent from the JSON.")
        parser.add_argument(
            "--refresh-config",
            action="store_true",
            help="Explicitly refresh company/branch settings; preserve accounts and other rows.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Development seeding is disabled unless DJANGO_DEBUG=1.")
        try:
            data = json.loads(options["config"].read_text(encoding="utf-8"))
            info = data["company"]
            seed_key = options["company_key"] or info.get("seed_key")
            if not seed_key:
                raise ValueError("company.seed_key or --company-key is required.")
            currency = info["currency"]
            if len(currency) != 3 or not currency.isalpha() or currency != currency.upper():
                raise ValueError("company.currency must be a three-letter uppercase currency code.")
            ZoneInfo(info["timezone"])
            branches = data["branches"]
            codes = [branch["code"] for branch in branches]
            if len(codes) != len(set(codes)):
                raise ValueError("Branch codes must be unique within the company.")
            defaults = {
                "name_en": info.get("name_en") or info["name"],
                "name_fa": info.get("name_fa", ""),
                "currency": currency,
                "timezone": info["timezone"],
                "configuration": data,
            }
        except (
            OSError,
            json.JSONDecodeError,
            KeyError,
            ValueError,
            TypeError,
            ZoneInfoNotFoundError,
        ) as exc:
            raise CommandError(f"Invalid seed configuration: {exc}") from exc

        company, created = Company.objects.get_or_create(seed_key=seed_key, defaults=defaults)
        if options["refresh_config"] and not created:
            for key, value in defaults.items():
                setattr(company, key, value)
            company.save(update_fields=[*defaults, "updated_at"])
        for branch in branches:
            branch_defaults = {
                "name_en": branch.get("name_en") or branch["name"],
                "name_fa": branch.get("name_fa", ""),
            }
            if options["refresh_config"]:
                Branch.objects.update_or_create(
                    company=company, code=branch["code"], defaults=branch_defaults
                )
            else:
                Branch.objects.get_or_create(
                    company=company, code=branch["code"], defaults=branch_defaults
                )

        username = os.environ.get("DEV_SUPERVISOR_USERNAME", "")
        if not username:
            raise CommandError("Set DEV_SUPERVISOR_USERNAME for the local demo account.")
        user_model = get_user_model()
        user = user_model.objects.filter(username=username).first()
        if user is None:
            password = os.environ.get("DEV_SUPERVISOR_PASSWORD", "")
            if not password:
                raise CommandError("Set DEV_SUPERVISOR_PASSWORD to create the local demo account.")
            user = user_model.objects.create_superuser(
                username=username,
                email=os.environ.get("DEV_SUPERVISOR_EMAIL", ""),
                password=password,
            )
            DemoSupervisor.objects.create(company=company, user=user)
        elif not DemoSupervisor.objects.filter(company=company, user=user).exists():
            raise CommandError(
                "That username is already used outside this company's demo bootstrap. "
                "Choose a different DEV_SUPERVISOR_USERNAME; existing accounts are preserved."
            )
        self.stdout.write(
            self.style.SUCCESS("Development company, branches and demo supervisor are ready.")
        )
