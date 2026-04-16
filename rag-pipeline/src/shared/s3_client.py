"""
S3 helpers: upload, download, move, delete, list.
All pipeline stages go through this — never call boto3 directly elsewhere.
"""

import hashlib
import json
import os
import tempfile
from typing import Optional

import boto3
from config.settings import AWS_REGION, S3_BUCKET, S3_PATHS


_s3 = boto3.client("s3", region_name=AWS_REGION)


# ── Core operations ────────────────────────────────────────────────────────────

def upload_file(local_path: str, s3_key: str) -> str:
    """Upload a local file to S3. Returns the full s3_key."""
    _s3.upload_file(local_path, S3_BUCKET, s3_key)
    return s3_key


def download_file(s3_key: str, local_path: str) -> str:
    """Download an S3 file to a local path. Returns local_path."""
    _s3.download_file(S3_BUCKET, s3_key, local_path)
    return local_path


def download_to_temp(s3_key: str, suffix: str = "") -> str:
    """
    Download to a temp file. Caller is responsible for cleanup.
    Usage: path = download_to_temp(key, ".pdf")
           # do stuff
           os.unlink(path)
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.close()
    _s3.download_file(S3_BUCKET, s3_key, tmp.name)
    return tmp.name


def upload_json(data: dict | list, s3_key: str) -> str:
    """Serialize dict/list to JSON and upload directly (no temp file)."""
    body = json.dumps(data, ensure_ascii=False, indent=2)
    _s3.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )
    return s3_key


def download_json(s3_key: str) -> dict | list:
    """Download and deserialize a JSON file from S3."""
    response = _s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
    return json.loads(response["Body"].read().decode("utf-8"))


def move_file(src_key: str, dst_key: str) -> None:
    """Move a file within the same S3 bucket (copy + delete)."""
    _s3.copy_object(
        Bucket=S3_BUCKET,
        CopySource={"Bucket": S3_BUCKET, "Key": src_key},
        Key=dst_key,
    )
    _s3.delete_object(Bucket=S3_BUCKET, Key=src_key)


def delete_file(s3_key: str) -> None:
    _s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)


def list_files(prefix: str, suffix: str = "") -> list[str]:
    """List all keys under a prefix, optionally filtered by suffix."""
    paginator = _s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(suffix):
                keys.append(key)
    return keys


def key_exists(s3_key: str) -> bool:
    try:
        _s3.head_object(Bucket=S3_BUCKET, Key=s3_key)
        return True
    except _s3.exceptions.ClientError:
        return False


# ── Key builders ───────────────────────────────────────────────────────────────

def inbox_key(file_name: str) -> str:
    return S3_PATHS["inbox"] + file_name


def parsed_key(stem: str) -> str:
    return S3_PATHS["parsed"] + stem + ".json"


def chunks_key(stem: str) -> str:
    return S3_PATHS["chunks"] + stem + ".json"


def enriched_key(stem: str) -> str:
    return S3_PATHS["enriched"] + stem + ".json"


def processed_key(file_name: str) -> str:
    return S3_PATHS["processed"] + file_name


def failed_key(file_name: str) -> str:
    return S3_PATHS["failed"] + file_name


# ── Hashing ────────────────────────────────────────────────────────────────────

def hash_s3_file(s3_key: str) -> str:
    """
    SHA256 hash of an S3 file — used as the dedup key in registry.
    Streams the file in chunks, never loads it all into memory.
    """
    response = _s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
    sha256 = hashlib.sha256()
    for chunk in response["Body"].iter_chunks(chunk_size=8192):
        sha256.update(chunk)
    return sha256.hexdigest()


# ── Metadata sidecar ──────────────────────────────────────────────────────────

def get_sidecar_metadata(pdf_s3_key: str) -> Optional[dict]:
    """
    Look for a JSON sidecar next to the PDF in inbox/.
    e.g. inbox/wef-jobs-2025.pdf → inbox/wef-jobs-2025.json
    Returns None if not found.
    """
    sidecar_key = pdf_s3_key.replace(".pdf", ".json")
    try:
        return download_json(sidecar_key)
    except Exception:
        return None