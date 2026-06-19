#!/usr/bin/env python
import os
import sys


def _resolve_runserver_argv(argv: list[str]) -> list[str]:
    if len(argv) < 2 or argv[1] != "runserver":
        return argv

    # If the user already provided an address/port, keep it.
    if any(arg and not arg.startswith("-") for arg in argv[2:]):
        return argv

    port = str(os.getenv("PORT", "8000")).strip() or "8000"
    return [argv[0], "runserver", f"0.0.0.0:{port}", *argv[2:]]


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal_backend.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(_resolve_runserver_argv(sys.argv))


if __name__ == "__main__":
    main()
