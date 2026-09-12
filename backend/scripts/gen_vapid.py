"""Run once to generate VAPID keys for browser push notifications.

Usage:
    cd backend
    ./anchorai-pvenv/bin/python scripts/gen_vapid.py

Then copy the output into your .env file.
"""
import base64
from pywebpush import Vapid
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption,
)

v = Vapid()
v.generate_keys()

# Public key: base64url uncompressed EC point (65 bytes) — used by browser
pub_bytes = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
pub = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()

# Private key: base64url DER — pywebpush Vapid.from_string() expects this format
priv_der = v.private_key.private_bytes(Encoding.DER, PrivateFormat.TraditionalOpenSSL, NoEncryption())
priv = base64.urlsafe_b64encode(priv_der).rstrip(b"=").decode()

print("\n✅ VAPID keys generated — add these to backend/.env:\n")
print(f"VAPID_PUBLIC_KEY={pub}")
print(f"VAPID_PRIVATE_KEY={priv}")
print(f"VAPID_CLAIMS_EMAIL=mailto:kirthi.genai@gmail.com\n")
