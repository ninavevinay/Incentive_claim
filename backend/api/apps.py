from django.apps import AppConfig
from django.conf import settings


_startup_repair_done = False


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.AutoField"
    name = "api"

    def ready(self) -> None:
        global _startup_repair_done
        if _startup_repair_done:
            return
        _startup_repair_done = True

        if not getattr(settings, "RUN_STARTUP_LEGACY_REPAIR", True):
            return

        try:
            from .workflow import repair_legacy_review_history

            updated = repair_legacy_review_history()
            if updated:
                print(f"[startup] repaired legacy application reviews: {updated}")
        except Exception as exc:
            print(f"[startup] legacy repair skipped: {exc}")

