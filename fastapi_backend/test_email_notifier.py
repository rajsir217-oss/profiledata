#!/usr/bin/env python3
"""Manual test runner for EmailNotifierTemplate to send queued notifications."""

import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from job_templates.email_notifier_template import EmailNotifierTemplate
from job_templates.base import JobExecutionContext


async def main() -> None:
    load_dotenv(".env.local")

    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME", "matrimonialDB")

    if not mongodb_url:
        raise RuntimeError("MONGODB_URL is not set in .env.local")

    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    # Parameters for the email notifier job
    params = {
        "batchSize": 10,
    }

    print("📧 Running Email Notifier test run...\n")
    print(f"📅 Start time: {datetime.utcnow().isoformat()}Z")
    print(f"📂 Database: {db_name}\n")

    # Create job context
    template = EmailNotifierTemplate()
    context = JobExecutionContext(
        job_id="test-email-notifier-001",
        job_name="Email Notifier Test",
        db=db,
        parameters=params
    )

    result = await template.execute(context)

    print("\n✅ Job finished")
    print(f"Status: {result.status}")
    print(f"Message: {result.message}")
    print(f"Duration: {result.duration_seconds:.2f}s")
    print(f"Records processed: {result.records_processed}")
    print(f"Records affected: {result.records_affected}")
    print(f"Details: {result.details}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
