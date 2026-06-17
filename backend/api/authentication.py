from __future__ import annotations

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User
from .security import decode_access_token


class JWTAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            raise AuthenticationFailed("Invalid token")

        token = parts[1].strip()
        if not token:
            raise AuthenticationFailed("Invalid token")

        try:
            payload = decode_access_token(token)
            user_id = int(payload.get("sub"))
        except Exception as exc:
            raise AuthenticationFailed("Invalid token") from exc

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed("User not found") from exc

        if not user.is_active:
            raise AuthenticationFailed("Account is deactivated")

        return user, token

