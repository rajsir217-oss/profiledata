"""Check why specific users match an occupation search keyword using production DB credentials.

Usage:
    python scripts/check_occupation_match.py --username imaavc903 --keyword doctor

Pass --limit to inspect multiple matches (defaults to 5) or omit --username to list
all matches for the keyword.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import dotenv_values
from pymongo import MongoClient
from pymongo.collection import Collection

ROOT_DIR = Path(__file__).resolve().parent.parent
PROD_ENV_PATH = ROOT_DIR / ".env.production"


def load_prod_config() -> Dict[str, str]:
    if not PROD_ENV_PATH.exists():
        raise FileNotFoundError(f"Production env file not found: {PROD_ENV_PATH}")

    config = dotenv_values(PROD_ENV_PATH)
    mongodb_url = config.get("MONGODB_URL")
    database_name = config.get("DATABASE_NAME", "matrimonialDB")

    if not mongodb_url:
        raise ValueError("MONGODB_URL is missing in .env.production")

    return {"MONGODB_URL": mongodb_url, "DATABASE_NAME": database_name}


def build_occupation_filter(keyword: str) -> Dict[str, Any]:
    """Mirror the occupation filtering logic used in the search API."""
    keyword = keyword.strip()
    return {
        "$or": [
            {"workExperience.workType": keyword},
            {"workExperience.workType": keyword.lower()},
            {"occupation": {"$regex": keyword, "$options": "i"}},
        ]
    }


def highlight_matches(doc: Dict[str, Any], keyword: str) -> Dict[str, Any]:
    """Return a summary showing where the keyword was found."""
    keyword_lower = keyword.lower()
    occupation_text = doc.get("occupation", "") or ""
    work_types: List[str] = []
    for job in doc.get("workExperience", []) or []:
        work_type = (job or {}).get("workType")
        if work_type:
            work_types.append(work_type)

    matches = []
    if keyword_lower in occupation_text.lower():
        matches.append("occupation text")

    for work_type in work_types:
        if work_type.lower() == keyword_lower:
            matches.append(f"workExperience.workType == '{work_type}'")
        elif keyword_lower in work_type.lower():
            matches.append(f"workExperience.workType contains '{work_type}'")

    summary = {
        "username": doc.get("username"),
        "fullName": f"{doc.get('firstName', '')} {doc.get('lastName', '')}".strip(),
        "occupation": occupation_text,
        "workTypes": work_types,
        "matchedFields": matches or ["No explicit match (review record)"]
    }
    return summary


def query_matches(collection: Collection, keyword: str, username: str | None, limit: int) -> List[Dict[str, Any]]:
    occupation_filter = build_occupation_filter(keyword)
    query: Dict[str, Any] = {"$and": [occupation_filter]}
    if username:
        query["$and"].append({"username": username})

    projection = {
        "username": 1,
        "firstName": 1,
        "lastName": 1,
        "occupation": 1,
        "workExperience": 1,
    }

    cursor = collection.find(query, projection).limit(limit)
    results = list(cursor)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect occupation search matches in production DB")
    parser.add_argument("--keyword", required=True, help="Occupation keyword, e.g. 'doctor'")
    parser.add_argument("--username", help="Optional username to narrow down the search")
    parser.add_argument("--limit", type=int, default=5, help="Maximum documents to return")
    args = parser.parse_args()

    config = load_prod_config()
    client = MongoClient(config["MONGODB_URL"])
    db = client[config["DATABASE_NAME"]]

    try:
        matches = query_matches(db.users, args.keyword, args.username, args.limit)
    finally:
        client.close()

    if not matches:
        target_info = f" (username={args.username})" if args.username else ""
        print(f"⚠️ No profiles matched keyword '{args.keyword}'{target_info}")
        return

    print(f"✅ Found {len(matches)} profile(s) matching '{args.keyword}'")
    for idx, doc in enumerate(matches, 1):
        summary = highlight_matches(doc, args.keyword)
        print(f"\n[{idx}] Username: {summary['username']}")
        if summary["fullName"]:
            print(f"    Name: {summary['fullName']}")
        print(f"    Occupation field: {summary['occupation'] or '—'}")
        print(f"    workExperience.workType entries: {summary['workTypes'] or ['—']}")
        print(f"    Matched fields: {summary['matchedFields']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"❌ Error: {exc}")
        sys.exit(1)
