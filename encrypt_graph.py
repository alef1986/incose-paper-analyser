import gzip
import json
import os
import sys
import getpass
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

INPUT_JSON = sys.argv[1] if len(sys.argv) > 1 else "incose_full_graph_v2_repaired.json"
OUTPUT_ENC = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "data.enc")

def main():
    if not os.path.exists(INPUT_JSON):
        print(f"Error: Input file '{INPUT_JSON}' not found.")
        sys.exit(1)

    passphrase = getpass.getpass("Enter access key (passphrase): ").strip()
    if len(passphrase) < 6:
        print("Error: Passphrase must be at least 6 characters.")
        sys.exit(1)

    confirm = getpass.getpass("Confirm access key: ").strip()
    if passphrase != confirm:
        print("Error: Passphrases do not match.")
        sys.exit(1)

    print(f"Reading and minifying {INPUT_JSON}...")
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Minify JSON (removes whitespace/indentation to save ~30-40% size)
    raw_bytes = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw_bytes, compresslevel=9)

    salt = os.urandom(16)
    iv = os.urandom(12)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    key = kdf.derive(passphrase.encode("utf-8"))
    ciphertext = AESGCM(key).encrypt(iv, compressed, None)

    os.makedirs(os.path.dirname(OUTPUT_ENC) or ".", exist_ok=True)
    with open(OUTPUT_ENC, "wb") as f:
        f.write(salt + iv + ciphertext)

    raw_mb = len(raw_bytes) / (1024 * 1024)
    enc_mb = (len(salt) + len(iv) + len(ciphertext)) / (1024 * 1024)
    print(f"Done! {raw_mb:.2f} MB JSON -> {enc_mb:.2f} MB encrypted -> {OUTPUT_ENC}")

if __name__ == "__main__":
    main()