"""Password hashing (scrypt, standard library) and session tokens."""

import base64
import hashlib
import hmac
import secrets

# scrypt cost: ~16 MB and tens of milliseconds per hash, which makes guessing slow.
_N, _R, _P = 2**14, 8, 1
_MAXMEM = 64 * 1024 * 1024


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32, maxmem=_MAXMEM
    )
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, expected = stored.split("$")
        if scheme != "scrypt":
            return False
        want = base64.b64decode(expected)
        got = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(want),
            maxmem=_MAXMEM,
        )
    except ValueError:
        return False
    return hmac.compare_digest(got, want)


# Verified against when the email is unknown, so "no such user" takes as long as "wrong password".
DUMMY_HASH = hash_password("not-a-real-password")


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
