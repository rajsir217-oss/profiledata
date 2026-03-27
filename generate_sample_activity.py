#!/usr/bin/env python3
"""
Generate sample historical activity logs for testing
"""
import asyncio
import random
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from models.activity_models import ActivityType

async def generate_sample_activity():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client.matrimonialDB
        collection = db.activity_logs
        
        print("🔧 Generating sample historical activity logs...")
        
        # Sample users and actions
        users = ["admin", "user1", "user2", "user3", "testuser"]
        action_types = list(ActivityType)
        
        # Generate logs for the last 30 days
        days_back = 30
        logs_to_generate = 500
        
        generated_logs = []
        
        for i in range(logs_to_generate):
            # Random date within the last 30 days
            random_days = random.randint(0, days_back)
            random_hours = random.randint(0, 23)
            random_minutes = random.randint(0, 59)
            
            timestamp = datetime.utcnow() - timedelta(
                days=random_days,
                hours=random_hours,
                minutes=random_minutes
            )
            
            # Random user and action
            username = random.choice(users)
            action_type = random.choice(action_types)
            
            log_entry = {
                "username": username,
                "action_type": action_type,
                "target_username": random.choice([u for u in users if u != username]) if random.random() > 0.7 else None,
                "metadata": {
                    "source": "sample_data_generator"
                },
                "ip_address": "192.168.1.0",  # Masked IP
                "timestamp": timestamp,
                "pii_logged": False
            }
            
            generated_logs.append(log_entry)
        
        # Insert in batches
        batch_size = 100
        for i in range(0, len(generated_logs), batch_size):
            batch = generated_logs[i:i + batch_size]
            await collection.insert_many(batch)
            print(f"✅ Inserted batch {i//batch_size + 1}: {len(batch)} logs")
        
        print(f"\n🎉 Generated {len(generated_logs)} sample activity logs!")
        
        # Verify the data
        total_count = await collection.count_documents({})
        print(f"📊 Total logs in database: {total_count}")
        
        # Show distribution by date
        pipeline = [
            {
                "$project": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
                }
            },
            {
                "$group": {
                    "_id": "$date",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        
        print(f"\n📅 Activity by date:")
        for result in results[-10:]:  # Show last 10 dates
            print(f"  {result['_id']}: {result['count']} logs")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(generate_sample_activity())
