#!/usr/bin/env python3
"""Package and switch reviewed invoice-helper static releases; no network access.

Python 3.10+ on Linux/macOS. Activation and rollback are dry runs unless --apply
is supplied. Production paths are fixed; --sandbox-root is for temporary tests.
"""

import argparse
from contextlib import contextmanager
import fcntl
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tarfile
import tempfile
import uuid


PROJECT = "invoice-helper"
PRODUCTION_ROOT = Path("/var/www/invoice-helper")
PRODUCTION_LIVE = Path("/var/www/html/invoice")
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_MANIFEST_BYTES = 4 * 1024 * 1024
MAX_FILES = 10000
STATIC_SUFFIXES = {
    ".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".webmanifest",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf",
}
SENSITIVE_NAME = re.compile(
    r"(^|[-_.])(secrets?|credentials?|passwords?|passwd|tokens?|private[-_]?key|"
    r"id_rsa|id_ed25519|wrangler|node_modules)([-_.]|$)", re.IGNORECASE
)
PRIVATE_KEY = re.compile(rb"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----")


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def checksum(data):
    return hashlib.sha256(data).hexdigest()


def hex_value(value, length, label):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{%d}" % length, value),
            "Invalid " + label)
    return value


def canonical_directory(path):
    path = Path(os.path.abspath(path))
    require(path.is_dir() and not path.is_symlink(), "Not an ordinary directory: " + str(path))
    require(path.resolve(strict=True) == path, "Symlink ancestor is not allowed: " + str(path))
    return path


def read_regular(path, limit):
    """Open without following the final symlink, then verify the opened inode."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
                "Only ordinary, non-hardlinked files are allowed: " + str(path))
        require(info.st_size <= limit, "File exceeds size limit: " + str(path))
        data = source.read(limit + 1)
        require(len(data) <= limit, "File grew beyond size limit: " + str(path))
        return data


def valid_path(name, directory=False):
    require(isinstance(name, str) and 0 < len(name) <= 240, "Invalid path length")
    parts = name.split("/")
    require(all(re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*", part) for part in parts),
            "Unsafe path: " + name)
    require(not any(SENSITIVE_NAME.search(part) or part.lower().startswith("_worker")
                    for part in parts), "Sensitive or server-only path: " + name)
    if not directory:
        require(Path(name).suffix.lower() in STATIC_SUFFIXES,
                "Unknown static file type: " + name)
    return name


def snapshot_tree(root, allow_build_metadata=False):
    """Snapshot a static tree; the resulting exact list is the release allowlist."""
    root = canonical_directory(root)
    result = {}
    total = 0
    for parent, directories, files in os.walk(root, followlinks=False):
        for name in directories:
            path = Path(parent) / name
            relative = path.relative_to(root).as_posix()
            valid_path(relative, directory=True)
            require(stat.S_ISDIR(path.lstat().st_mode), "Symlink or special directory: " + relative)
        for name in files:
            path = Path(parent) / name
            relative = path.relative_to(root).as_posix()
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
                    "Symlink or special file: " + relative)
            # Cloudflare's build metadata is deliberately excluded from a static release.
            if allow_build_metadata and relative == ".assetsignore":
                continue
            valid_path(relative)
            data = read_regular(path, MAX_FILE_BYTES)
            require(not PRIVATE_KEY.search(data), "Private key material in static output: " + relative)
            total += len(data)
            require(total <= MAX_TOTAL_BYTES and len(result) < MAX_FILES, "Static output is too large")
            result[relative] = data
    require("index.html" in result, "Static output must contain index.html")
    require(len({name.casefold() for name in result}) == len(result), "Case-colliding paths")
    return dict(sorted(result.items()))


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def parse_manifest(data, commit=None):
    value = json.loads(data, object_pairs_hook=no_duplicate_keys)
    require(isinstance(value, dict) and set(value) == {
        "schemaVersion", "project", "commit", "archiveSha256", "files"
    }, "Unexpected manifest fields")
    require(type(value["schemaVersion"]) is int and value["schemaVersion"] == 1
            and value["project"] == PROJECT, "Unsupported manifest schema or project")
    hex_value(value["commit"], 40, "manifest commit")
    hex_value(value["archiveSha256"], 64, "archive checksum")
    require(commit is None or value["commit"] == commit, "Manifest commit differs from expected commit")
    entries = value["files"]
    require(isinstance(entries, list) and 0 < len(entries) <= MAX_FILES, "Invalid manifest file count")
    names = []
    total = 0
    for entry in entries:
        require(isinstance(entry, dict) and set(entry) == {"path", "size", "sha256"},
                "Unexpected file manifest fields")
        names.append(valid_path(entry["path"]))
        require(type(entry["size"]) is int and 0 <= entry["size"] <= MAX_FILE_BYTES,
                "Invalid file size")
        total += entry["size"]
        hex_value(entry["sha256"], 64, "file checksum")
    require(total <= MAX_TOTAL_BYTES, "Manifest is too large")
    require(names == sorted(names) and len(set(name.casefold() for name in names)) == len(names),
            "Manifest paths must be sorted and unique")
    require("index.html" in names, "Manifest must contain index.html")
    names_set = set(names)
    for name in names:
        require(not any(parent.as_posix() in names_set for parent in Path(name).parents),
                "Manifest file/directory collision")
    return value


def manifest_bytes(manifest):
    return (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")


def package(args):
    commit = hex_value(args.commit, 40, "commit")
    source = canonical_directory(args.source)
    require(source.name == "client" and source.parent.name == "dist", "Source must be dist/client")
    output = Path(os.path.abspath(args.output))
    canonical_directory(output.parent)
    require(not output.exists() and not output.is_symlink(), "Output directory already exists")
    require(not output.is_relative_to(source), "Output must be outside dist/client")
    files = snapshot_tree(source, allow_build_metadata=True)
    archive = io.BytesIO()
    with gzip.GzipFile(fileobj=archive, mode="wb", mtime=0, filename="") as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as bundle:
            for name, data in files.items():
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                entry.mode = 0o644
                bundle.addfile(entry, io.BytesIO(data))
    archive_data = archive.getvalue()
    require(len(archive_data) <= MAX_TOTAL_BYTES, "Archive exceeds size limit")
    manifest = {
        "schemaVersion": 1, "project": PROJECT, "commit": commit,
        "archiveSha256": checksum(archive_data),
        "files": [{"path": name, "size": len(data), "sha256": checksum(data)}
                  for name, data in files.items()],
    }
    encoded = manifest_bytes(manifest)
    parse_manifest(encoded, commit)
    temporary = Path(tempfile.mkdtemp(prefix=".invoice-package-", dir=output.parent))
    try:
        (temporary / "client.tar.gz").write_bytes(archive_data)
        (temporary / "manifest.json").write_bytes(encoded)
        os.rename(temporary, output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return {"status": "packaged", "commit": commit, "files": len(files),
            "artifact": str(output), "manifestSha256": checksum(encoded),
            "archiveSha256": manifest["archiveSha256"]}


def verified_artifact(args):
    commit = hex_value(args.commit, 40, "commit")
    expected_manifest = hex_value(args.manifest_sha256, 64, "manifest checksum")
    artifact = canonical_directory(args.artifact)
    require(set(os.listdir(artifact)) == {"manifest.json", "client.tar.gz"},
            "Artifact must contain exactly manifest.json and client.tar.gz")
    encoded = read_regular(artifact / "manifest.json", MAX_MANIFEST_BYTES)
    require(checksum(encoded) == expected_manifest, "Manifest checksum mismatch")
    manifest = parse_manifest(encoded, commit)
    # Read once into bounded memory: mutable upload paths cannot change after validation.
    archive = read_regular(artifact / "client.tar.gz", MAX_TOTAL_BYTES)
    require(checksum(archive) == manifest["archiveSha256"], "Archive checksum mismatch")
    expected = {entry["path"]: entry for entry in manifest["files"]}
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        for entry in bundle:
            name = valid_path(entry.name)
            require(entry.type in (tarfile.REGTYPE, tarfile.AREGTYPE)
                    and entry.sparse is None and not entry.pax_headers and not bundle.pax_headers,
                    "Only ordinary tar files without extended headers are allowed")
            require(name in expected and name not in files, "Unexpected or duplicate archive path: " + name)
            info = expected[name]
            require(entry.size == info["size"], "Archive file size mismatch: " + name)
            with bundle.extractfile(entry) as source:
                data = source.read(info["size"] + 1)
            require(len(data) == info["size"] and checksum(data) == info["sha256"],
                    "File checksum mismatch: " + name)
            require(not PRIVATE_KEY.search(data), "Private key material in static output: " + name)
            files[name] = data
    require(set(files) == set(expected), "Archive is missing manifest files")
    return manifest, encoded, files


def layout(args):
    sandbox = args.sandbox_root is not None
    if sandbox:
        root = canonical_directory(args.sandbox_root)
        # Do not let TMPDIR/TEMP/TMP redirect privileged sandbox writes elsewhere.
        temporary_root = Path("/tmp").resolve(strict=True)
        require(root != temporary_root and root.is_relative_to(temporary_root),
                "Sandbox must be a child of the fixed /tmp directory")
        live = root / "current"
    else:
        root = canonical_directory(PRODUCTION_ROOT)
        canonical_directory(PRODUCTION_LIVE.parent)
        live = PRODUCTION_LIVE
    for name in ("releases", "manifests"):
        path = root / name
        if path.exists() or path.is_symlink():
            canonical_directory(path)
        else:
            require(sandbox, "Production release directories must be pre-provisioned")
    if not sandbox:
        for directory in (root, root / "releases", root / "manifests", live.parent):
            info = directory.stat()
            require(info.st_uid in (0, os.geteuid()) and not info.st_mode & 0o022,
                    "Production directories must be owned by root/deployer and not group/world writable")
    return root, live, sandbox


@contextmanager
def deployment_lock(root):
    path = root / ".deploy.lock"
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not info.st_mode & 0o022,
                "Unsafe deployment lock")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ReleaseError("Another deployment holds the lock") from error
        yield
    finally:
        os.close(fd)


def current_commit(root, live):
    if not live.is_symlink():
        require(not live.exists(), "Live path must be a symlink, never a real directory/file")
        return "none"
    target = os.readlink(live)
    commit = Path(target).name
    hex_value(commit, 40, "live commit")
    require(target == str(root / "releases" / commit), "Live link points outside this project's releases")
    canonical_directory(root / "releases" / commit)
    return commit


def installed_release(root, commit):
    encoded = read_regular(root / "manifests" / (commit + ".json"), MAX_MANIFEST_BYTES)
    manifest = parse_manifest(encoded, commit)
    files = snapshot_tree(root / "releases" / commit)
    expected = {entry["path"]: entry for entry in manifest["files"]}
    require(set(files) == set(expected), "Installed file list differs from manifest")
    for name, data in files.items():
        require(len(data) == expected[name]["size"] and checksum(data) == expected[name]["sha256"],
                "Installed file checksum mismatch: " + name)
    return manifest, encoded


def check_expected(root, live, expected, sandbox, verify_current=True):
    if expected == "none":
        require(sandbox, "Production bootstrap requires a separately approved baseline")
    else:
        hex_value(expected, 40, "expected current commit")
    require(current_commit(root, live) == expected, "Current release differs from expected-current")
    if expected != "none" and verify_current:
        installed_release(root, expected)


def switch_link(root, live, expected, target):
    temporary = live.parent / (".invoice-next-" + uuid.uuid4().hex)
    try:
        os.symlink(str(root / "releases" / target), temporary)
        # The lock serializes every cooperating deployer; check again at the switch.
        require(current_commit(root, live) == expected, "Current release changed before switch")
        os.replace(temporary, live)
        require(current_commit(root, live) == target, "Live link verification failed after switch")
    finally:
        if temporary.is_symlink():
            temporary.unlink()


def activate(args):
    manifest, encoded, files = verified_artifact(args)
    root, live, sandbox = layout(args)
    commit = manifest["commit"]
    require(commit != args.expected_current, "Release is already current")
    check_expected(root, live, args.expected_current, sandbox)
    release = root / "releases" / commit
    manifest_path = root / "manifests" / (commit + ".json")
    require(not release.exists() and not release.is_symlink()
            and not manifest_path.exists() and not manifest_path.is_symlink(),
            "Target release already exists; do not overwrite retained releases")
    if args.apply:
        with deployment_lock(root):
            check_expected(root, live, args.expected_current, sandbox)
            if sandbox:
                (root / "releases").mkdir(exist_ok=True, mode=0o755)
                (root / "manifests").mkdir(exist_ok=True, mode=0o755)
            canonical_directory(root / "releases")
            canonical_directory(root / "manifests")
            stage = Path(tempfile.mkdtemp(prefix=".invoice-stage-", dir=root / "releases"))
            try:
                for name, data in files.items():
                    destination = stage / name
                    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                    with destination.open("xb") as output:
                        output.write(data)
                    destination.chmod(0o644)
                # mkdir's mode is masked by umask; Nginx must traverse every directory.
                for directory, _, _ in os.walk(stage):
                    Path(directory).chmod(0o755)
                # No tar extraction and no shell commands: only verified regular bytes.
                require(not release.exists() and not release.is_symlink(), "Target release appeared")
                os.rename(stage, release)
                with manifest_path.open("xb") as output:
                    output.write(encoded)
                manifest_path.chmod(0o644)
                installed_release(root, commit)
                switch_link(root, live, args.expected_current, commit)
            finally:
                if stage.exists():
                    shutil.rmtree(stage)
    return {"status": "activated" if args.apply else "dry-run", "commit": commit,
            "previousCommit": args.expected_current, "manifestSha256": checksum(encoded),
            "live": str(live), "files": len(files)}


def rollback(args):
    target = hex_value(args.to, 40, "rollback target")
    hex_value(args.expected_current, 40, "expected current commit")
    require(target != args.expected_current, "Rollback target is already current")
    root, live, sandbox = layout(args)
    check_expected(root, live, args.expected_current, sandbox, verify_current=False)
    _, encoded = installed_release(root, target)
    if args.apply:
        with deployment_lock(root):
            check_expected(root, live, args.expected_current, sandbox, verify_current=False)
            installed_release(root, target)
            switch_link(root, live, args.expected_current, target)
    return {"status": "rolled-back" if args.apply else "dry-run", "commit": target,
            "previousCommit": args.expected_current, "manifestSha256": checksum(encoded),
            "live": str(live)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    pack = commands.add_parser("pack", help="Package only dist/client with a deterministic manifest")
    pack.add_argument("--source", default="dist/client")
    pack.add_argument("--commit", required=True)
    pack.add_argument("--output", required=True)
    for name in ("verify", "activate"):
        command = commands.add_parser(name)
        command.add_argument("--artifact", required=True)
        command.add_argument("--commit", required=True)
        command.add_argument("--manifest-sha256", required=True)
        if name == "activate":
            activation = command
    recovery = commands.add_parser("rollback")
    recovery.add_argument("--to", required=True)
    for command in (activation, recovery):
        command.add_argument("--expected-current", required=True)
        command.add_argument("--apply", action="store_true", help="Actually switch the live symlink")
        command.add_argument("--sandbox-root", help="Existing project directory under /tmp (ignores TMPDIR)")
    args = parser.parse_args()
    try:
        if args.command == "pack":
            result = package(args)
        elif args.command == "verify":
            manifest, encoded, files = verified_artifact(args)
            result = {"status": "verified", "commit": manifest["commit"], "files": len(files),
                      "manifestSha256": checksum(encoded), "archiveSha256": manifest["archiveSha256"]}
        elif args.command == "activate":
            result = activate(args)
        else:
            result = rollback(args)
        print(json.dumps(result, sort_keys=True))
    except (ReleaseError, OSError, ValueError, tarfile.TarError, EOFError) as error:
        print("ERROR: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
