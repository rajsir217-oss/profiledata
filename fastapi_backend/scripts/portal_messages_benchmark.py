#!/usr/bin/env python3
"""
Benchmark messenger Portal Members message-list and group endpoints.

Usage examples:
  python3 fastapi_backend/scripts/portal_messages_benchmark.py
  python3 fastapi_backend/scripts/portal_messages_benchmark.py --runs 20 --limit 50
  python3 fastapi_backend/scripts/portal_messages_benchmark.py --backend-url https://api.example.com --token "$ACCESS_TOKEN"
"""

import argparse
import asyncio
import os
import statistics
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from jose import jwt
from motor.motor_asyncio import AsyncIOMotorClient


def _load_env_file(path: str) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not os.path.exists(path):
        return values

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            row = line.strip()
            if not row or row.startswith("#") or "=" not in row:
                continue
            key, value = row.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _p95(values: List[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, int(0.95 * len(ordered)) - 1))
    return ordered[idx]


def _summary(values: List[float]) -> Dict[str, float]:
    return {
        "avg_ms": round(statistics.mean(values), 2) if values else 0.0,
        "p50_ms": round(statistics.median(values), 2) if values else 0.0,
        "p95_ms": round(_p95(values), 2),
        "min_ms": round(min(values), 2) if values else 0.0,
        "max_ms": round(max(values), 2) if values else 0.0,
    }


async def _measure(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    params: Optional[Dict[str, str]],
    runs: int,
) -> Tuple[List[float], List[int]]:
    timings: List[float] = []
    statuses: List[int] = []

    for _ in range(runs):
        started = time.perf_counter()
        response = await client.get(url, headers=headers, params=params)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        timings.append(elapsed_ms)
        statuses.append(response.status_code)

    return timings, statuses


async def _resolve_local_token(
    mongo_url: str,
    database_name: str,
    jwt_secret: str,
    jwt_algo: str,
) -> Tuple[str, str, str]:
    mongo = AsyncIOMotorClient(mongo_url)
    db = mongo[database_name]

    conv = await db.messenger_conversations.find_one(
        {"type": "group", "groupName": "Portal Members"},
        {"_id": 1, "participants": 1},
    )
    if not conv:
        raise RuntimeError("Portal Members conversation not found")

    username = None
    for p in conv.get("participants") or []:
        candidate = p.get("username") if isinstance(p, dict) else None
        if candidate:
            username = candidate
            break
    if not username:
        user_doc = await db.users.find_one({}, {"username": 1})
        username = user_doc.get("username") if user_doc else None
    if not username:
        raise RuntimeError("Could not resolve benchmark username")

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": username,
            "role": "admin",
            "permissions": [],
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=30),
        },
        jwt_secret,
        algorithm=jwt_algo,
    )

    mongo.close()
    return token, str(conv["_id"]), username


async def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Portal Members messenger endpoints")
    parser.add_argument("--runs", type=int, default=12, help="Requests per endpoint variant")
    parser.add_argument("--limit", type=int, default=50, help="Message page size")
    parser.add_argument("--backend-url", type=str, default=None, help="Backend base URL (overrides env)")
    parser.add_argument("--token", type=str, default=None, help="Bearer access token (required for non-local runs)")
    parser.add_argument("--conversation-id", type=str, default=None, help="Portal conversation id override")
    parser.add_argument("--env-file", type=str, default="fastapi_backend/.env", help="Path to backend env file")
    args = parser.parse_args()

    env = _load_env_file(args.env_file)
    backend_url = (args.backend_url or env.get("BACKEND_URL") or "http://localhost:8000").rstrip("/")

    token = args.token
    conversation_id = args.conversation_id
    benchmark_username = "unknown"

    if not token or not conversation_id:
        mongo_url = env.get("MONGODB_URL", "mongodb://localhost:27017")
        database_name = env.get("DATABASE_NAME", "matrimonialDB")
        jwt_secret = env.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        jwt_algo = env.get("JWT_ALGORITHM", "HS256")

        generated_token, generated_conv_id, benchmark_username = await _resolve_local_token(
            mongo_url,
            database_name,
            jwt_secret,
            jwt_algo,
        )
        token = token or generated_token
        conversation_id = conversation_id or generated_conv_id

    headers = {"Authorization": f"Bearer {token}"}

    messages_url = f"{backend_url}/api/messenger/conversations/{conversation_id}/messages"
    portal_group_url = f"{backend_url}/api/messenger/portal-members-group"

    async with httpx.AsyncClient(timeout=25.0) as client:
        await client.get(messages_url, headers=headers, params={"limit": args.limit, "includeTotal": "false"})
        await client.get(messages_url, headers=headers, params={"limit": args.limit, "includeTotal": "true"})
        await client.get(portal_group_url, headers=headers)

        fast_vals, fast_status = await _measure(
            client,
            messages_url,
            headers,
            {"limit": str(args.limit), "includeTotal": "false"},
            args.runs,
        )
        total_vals, total_status = await _measure(
            client,
            messages_url,
            headers,
            {"limit": str(args.limit), "includeTotal": "true"},
            args.runs,
        )
        group_vals, group_status = await _measure(
            client,
            portal_group_url,
            headers,
            None,
            args.runs,
        )

    fast_summary = _summary(fast_vals)
    total_summary = _summary(total_vals)
    group_summary = _summary(group_vals)

    fast_p50 = fast_summary["p50_ms"]
    total_p50 = total_summary["p50_ms"]
    delta_pct = ((total_p50 - fast_p50) / total_p50 * 100.0) if total_p50 > 0 else 0.0

    print(f"Backend={backend_url}")
    print(f"ConversationId={conversation_id}")
    print(f"Username={benchmark_username}")
    print(f"Runs={args.runs}, Limit={args.limit}")
    print()

    print("messages includeTotal=false")
    print(f"  status_set={sorted(set(fast_status))}")
    print(f"  avg_ms={fast_summary['avg_ms']} p50_ms={fast_summary['p50_ms']} p95_ms={fast_summary['p95_ms']} min_ms={fast_summary['min_ms']} max_ms={fast_summary['max_ms']}")

    print("messages includeTotal=true")
    print(f"  status_set={sorted(set(total_status))}")
    print(f"  avg_ms={total_summary['avg_ms']} p50_ms={total_summary['p50_ms']} p95_ms={total_summary['p95_ms']} min_ms={total_summary['min_ms']} max_ms={total_summary['max_ms']}")

    print("portal-members-group")
    print(f"  status_set={sorted(set(group_status))}")
    print(f"  avg_ms={group_summary['avg_ms']} p50_ms={group_summary['p50_ms']} p95_ms={group_summary['p95_ms']} min_ms={group_summary['min_ms']} max_ms={group_summary['max_ms']}")

    print()
    print(f"delta p50 fast_vs_total: {round(delta_pct, 2)}% faster when includeTotal=false")


if __name__ == "__main__":
    asyncio.run(main())
