"""
Patch app-builder.exe so it accepts our cleaned winCodeSign archive.

electron-builder's app-builder hard-codes the sha512 (base64) of the upstream
winCodeSign-2.6.0.7z. That archive contains macOS symlinks that Windows refuses
to extract without Developer Mode / admin. We serve a symlink-free copy via a
local mirror; this script swaps the embedded expected checksum for the checksum
of our copy (same base64 length => safe in-place byte replacement).

A backup (.orig) is written so the change can be reverted.
"""
import base64
import hashlib
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXE = os.path.join(ROOT, "node_modules", "app-builder-bin", "win", "x64", "app-builder.exe")
ARCHIVE = os.path.join(ROOT, "serve", "winCodeSign-2.6.0", "winCodeSign-2.6.0.7z")

EXPECTED_UPSTREAM = b"6LQI2d9BPC3Xs0ZoTQe1o3tPiA28c7+PY69Q9i/pD8lY45psMtHuLwv3vRckiVr3Zx1cbNyLlBR8STwCdcHwtA=="


def main():
    with open(ARCHIVE, "rb") as f:
        our = base64.b64encode(hashlib.sha512(f.read()).digest())
    print("our archive sha512:", our.decode())

    if len(our) != len(EXPECTED_UPSTREAM):
        print("ERROR: length mismatch, cannot patch in place", file=sys.stderr)
        sys.exit(1)

    with open(EXE, "rb") as f:
        data = f.read()

    count = data.count(EXPECTED_UPSTREAM)
    if count == 0:
        if our in data:
            print("Already patched with our checksum. Nothing to do.")
            return
        print("ERROR: expected upstream checksum not found in binary", file=sys.stderr)
        sys.exit(1)
    if count != 1:
        print("ERROR: expected exactly 1 occurrence, found", count, file=sys.stderr)
        sys.exit(1)

    backup = EXE + ".orig"
    if not os.path.exists(backup):
        shutil.copy2(EXE, backup)
        print("backup written:", backup)

    patched = data.replace(EXPECTED_UPSTREAM, our)
    with open(EXE, "wb") as f:
        f.write(patched)
    print("patched:", EXE)


if __name__ == "__main__":
    main()
