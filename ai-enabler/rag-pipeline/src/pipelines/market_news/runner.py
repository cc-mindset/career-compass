"""
runner.py
Orchestrates the full market_news pipeline:
  fetch → transform → enrich → embed → cleanup (opt-in)
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def run_pipeline(
    fetch: bool = True,
    transform: bool = True,
    enrich: bool = True,
    embed: bool = True,
    cleanup: bool = False,   # opt-in only — run weekly, not every fetch
    dry_run: bool = False,
) -> dict:
    """
    Run market_news pipeline stages in sequence.
    Each stage is independently skippable for debugging.
    """
    results = {
        "pipeline": "market_news",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "stages": {},
    }

    # ── Stage 1: Fetch ────────────────────────────────────────────────────────
    if fetch:
        logger.info("=== Stage 1: Fetch ===")
        from src.pipelines.market_news.fetcher_serp import fetch_all
        fetch_stats = fetch_all(dry_run=dry_run)
        results["stages"]["fetch"] = fetch_stats
        logger.info(f"Fetch complete: {fetch_stats}")

        if fetch_stats.get("kept", 0) == 0 and not dry_run:
            logger.warning("No articles fetched — stopping pipeline")
            results["completed_at"] = datetime.now(timezone.utc).isoformat()
            return results
    else:
        logger.info("Skipping fetch stage")

    # ── Stage 2: Transform ────────────────────────────────────────────────────
    if transform:
        logger.info("=== Stage 2: Transform ===")
        from src.pipelines.market_news.transformer import run_transform
        transform_stats = run_transform()
        results["stages"]["transform"] = transform_stats
        logger.info(f"Transform complete: {transform_stats}")
    else:
        logger.info("Skipping transform stage")

    # ── Stage 3: Enrich ───────────────────────────────────────────────────────
    if enrich:
        logger.info("=== Stage 3: Enrich ===")
        from src.pipelines.market_news.enricher import run_enrich
        enrich_stats = run_enrich()
        results["stages"]["enrich"] = enrich_stats
        logger.info(f"Enrich complete: {enrich_stats}")
    else:
        logger.info("Skipping enrich stage")

    # ── Stage 4: Embed ────────────────────────────────────────────────────────
    if embed:
        logger.info("=== Stage 4: Embed ===")
        from src.pipelines.market_news.embedder import run_embed
        embed_stats = run_embed()
        results["stages"]["embed"] = embed_stats
        logger.info(f"Embed complete: {embed_stats}")
    else:
        logger.info("Skipping embed stage")

    # ── Stage 5: Cleanup (opt-in, run weekly) ────────────────────────────────
    if cleanup:
        logger.info("=== Stage 5: Cleanup ===")
        from src.pipelines.market_news.cleanup import run_cleanup
        cleanup_stats = run_cleanup(dry_run=dry_run)
        results["stages"]["cleanup"] = cleanup_stats
        logger.info(f"Cleanup complete: {cleanup_stats}")
    else:
        logger.info("Skipping cleanup stage (run with --cleanup to enable)")

    results["completed_at"] = datetime.now(timezone.utc).isoformat()
    logger.info(f"Pipeline complete: {json.dumps(results, indent=2)}")
    return results


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="market_news pipeline runner")
    parser.add_argument("--fetch-only",     action="store_true", help="Run fetch stage only")
    parser.add_argument("--transform-only", action="store_true", help="Run transform stage only")
    parser.add_argument("--enrich-only",    action="store_true", help="Run enrich stage only")
    parser.add_argument("--embed-only",     action="store_true", help="Run embed stage only")
    parser.add_argument("--skip-fetch",     action="store_true", help="Skip fetch stage")
    parser.add_argument("--skip-transform", action="store_true", help="Skip transform stage")
    parser.add_argument("--skip-enrich",    action="store_true", help="Skip enrich stage")
    parser.add_argument("--skip-embed",     action="store_true", help="Skip embed stage")
    parser.add_argument("--cleanup",        action="store_true", help="Run cleanup stage (TTL deletions)")
    parser.add_argument("--dry-run",        action="store_true", help="Fetch but do not write to S3")
    parser.add_argument("--log-level",      default="INFO",      help="Logging level")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Stage selection logic
    if args.fetch_only:
        fetch, transform, enrich, embed = True, False, False, False
    elif args.transform_only:
        fetch, transform, enrich, embed = False, True, False, False
    elif args.enrich_only:
        fetch, transform, enrich, embed = False, False, True, False
    elif args.embed_only:
        fetch, transform, enrich, embed = False, False, False, True
    else:
        fetch = not args.skip_fetch
        transform = not args.skip_transform
        enrich = not args.skip_enrich
        embed = not args.skip_embed

    result = run_pipeline(
        fetch=fetch,
        transform=transform,
        enrich=enrich,
        embed=embed,
        cleanup=args.cleanup,
        dry_run=args.dry_run,
    )

    print(json.dumps(result, indent=2))
    sys.exit(0)


# ── Lambda handler (for future EventBridge wiring) ────────────────────────────

def lambda_handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point.
    event can optionally pass stage flags:
      {"fetch": true, "transform": true, "embed": true}
    """
    logging.basicConfig(level=logging.INFO)
    logger.info(f"Lambda triggered with event: {event}")

    result = run_pipeline(
        fetch=event.get("fetch", True),
        transform=event.get("transform", True),
        enrich=event.get("enrich", True),
        embed=event.get("embed", True),
        cleanup=event.get("cleanup", False),
        dry_run=event.get("dry_run", False),
    )
    return result


if __name__ == "__main__":
    main()