from __future__ import annotations

from collections.abc import Iterable

from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def _flatten_detail(detail) -> list[str]:
    if isinstance(detail, dict):
        items: list[str] = []
        for key, value in detail.items():
            flattened = _flatten_detail(value)
            if key == "detail" and not flattened:
                continue
            if key == "detail" and len(flattened) == 1:
                items.append(flattened[0])
                continue
            if len(flattened) == 1:
                items.append(f"{key}: {flattened[0]}")
            else:
                items.extend(f"{key}: {item}" for item in flattened)
        return items

    if isinstance(detail, list):
        items: list[str] = []
        for value in detail:
            items.extend(_flatten_detail(value))
        return items

    return [str(detail)]


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    if isinstance(exc, ValidationError):
        messages = _flatten_detail(response.data)
        response.data = {"detail": messages[0] if len(messages) == 1 else messages}
    elif "detail" not in response.data:
        response.data = {"detail": response.data}
    return response

