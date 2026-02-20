"""
Create Inactivity Tracking Collection
====================================
Script to create MongoDB indexes for the admin_inactivity_tracking collection

Usage:
  # Development (default)
  python3 scripts/create_inactivity_tracking.py
  
  # Production
  python3 scripts/create_inactivity_tracking.py --env production
  
  # Staging  
  python3 scripts/create_inactivity_tracking.py --env staging
"""

import asyncio
import logging
import sys
import os
import argparse
from pathlib import Path

# Add parent directory to path to import config
sys.path.append(str(Path(__file__).parent.parent))
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from config import Settings

logger = logging.getLogger(__name__)


async def create_inactivity_tracking_indexes(env="development"):
    """Create indexes for admin_inactivity_tracking collection"""
    
    # Set environment before loading settings
    os.environ['ENV'] = env
    settings = Settings()
    
    logger.info(f"🌍 Environment: {env}")
    logger.info(f"📊 Database: {settings.database_name}")
    logger.info(f"🔗 MongoDB URL: {settings.mongodb_url}")
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        logger.info("🔧 Creating indexes for admin_inactivity_tracking collection...")
        
        # Create collection if it doesn't exist
        try:
            await db.create_collection("admin_inactivity_tracking")
            logger.info("✅ Collection created")
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✅ Collection already exists")
            else:
                raise e
        
        # Indexes for performance
        indexes = [
            # Primary lookup indexes
            [("username", ASCENDING), ("sentAt", DESCENDING)],
            [("jobExecutionId", ASCENDING)],
            [("escalationDays", ASCENDING)],
            
            # Analytics queries
            [("sentAt", DESCENDING), ("escalationDays", ASCENDING)],
            [("channels", ASCENDING)],
            [("userResponse.reactivatedAt", ASCENDING)],
            
            # Rate limiting and deduplication
            [("username", ASCENDING), ("escalationDays", ASCENDING), ("sentAt", DESCENDING)],
            
            # Test tracking
            [("isTest", ASCENDING)],
            [("testSentBy", ASCENDING)],
            
            # TTL for old test records (optional - keep test records for 30 days)
            # [("sentAt", ASCENDING)],  # Uncomment TTL if needed
        ]
        
        created_indexes = []
        
        for index_spec in indexes:
            index_name = "_".join([f"{field}_{direction}" for field, direction in index_spec])
            
            try:
                await db.admin_inactivity_tracking.create_index(
                    index_spec,
                    name=f"idx_{index_name}",
                    background=True
                )
                created_indexes.append(f"idx_{index_name}")
                logger.info(f"✅ Created index: idx_{index_name}")
            except Exception as e:
                logger.warning(f"⚠️ Could not create index {index_name}: {e}")
        
        # Optional: TTL index for test records (auto-delete after 30 days)
        try:
            await db.admin_inactivity_tracking.create_index(
                [("sentAt", ASCENDING)],
                name="idx_ttl_test_records",
                expireAfterSeconds=30 * 24 * 60 * 60,  # 30 days
                partialFilterExpression={"isTest": True},
                background=True
            )
            created_indexes.append("idx_ttl_test_records")
            logger.info("✅ Created TTL index for test records")
        except Exception as e:
            logger.warning(f"⚠️ Could not create TTL index: {e}")
        
        logger.info(f"🎉 Successfully created {len(created_indexes)} indexes")
        
        # Verify indexes
        existing_indexes = db.admin_inactivity_tracking.list_indexes()
        index_list = await existing_indexes.to_list(length=100)
        logger.info(f"📋 Total indexes on collection: {len(index_list)}")
        
        for idx in index_list:
            logger.info(f"   - {idx['name']}: {idx['key']}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating indexes: {e}", exc_info=True)
        return False
        
    finally:
        client.close()


async def create_sample_data(env="development"):
    """Create sample data for testing (optional)"""
    
    # Set environment before loading settings
    os.environ['ENV'] = env
    settings = Settings()
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        logger.info("📝 Creating sample inactivity tracking data...")
        
        sample_data = [
            {
                "username": "testuser1",
                "jobExecutionId": "test_job_001",
                "escalationDays": 15,
                "channels": ["email", "push"],
                "sentAt": "2024-01-15T10:00:00Z",
                "templateData": {
                    "newMatchesCount": 5,
                    "unreadMessagesCount": 2,
                    "profileViewsCount": 8
                },
                "deliveryStatus": {
                    "email": {"sent": True, "delivered": True, "opened": True},
                    "push": {"sent": True, "delivered": False, "opened": False}
                },
                "userResponse": {
                    "reactivatedAt": "2024-01-16T14:30:00Z",
                    "respondedAt": "2024-01-16T14:30:00Z"
                },
                "isTest": True,
                "testSentBy": "admin"
            },
            {
                "username": "testuser2",
                "jobExecutionId": "test_job_001",
                "escalationDays": 30,
                "channels": ["email", "sms"],
                "sentAt": "2024-01-10T10:00:00Z",
                "templateData": {
                    "newMatchesCount": 12,
                    "unreadMessagesCount": 5,
                    "profileViewsCount": 15
                },
                "deliveryStatus": {
                    "email": {"sent": True, "delivered": True, "opened": False},
                    "sms": {"sent": True, "delivered": True}
                },
                "userResponse": {
                    "reactivatedAt": None,
                    "respondedAt": None
                },
                "isTest": True,
                "testSentBy": "admin"
            },
            {
                "username": "testuser3",
                "jobExecutionId": "test_job_002",
                "escalationDays": 60,
                "channels": ["email", "sms", "push"],
                "sentAt": "2024-01-05T10:00:00Z",
                "templateData": {
                    "newMatchesCount": 3,
                    "unreadMessagesCount": 1,
                    "profileViewsCount": 4
                },
                "deliveryStatus": {
                    "email": {"sent": True, "delivered": False, "opened": False},
                    "sms": {"sent": True, "delivered": False},
                    "push": {"sent": True, "delivered": True, "opened": True}
                },
                "userResponse": {
                    "reactivatedAt": None,
                    "respondedAt": None
                },
                "isTest": True,
                "testSentBy": "admin"
            }
        ]
        
        if sample_data:
            result = await db.admin_inactivity_tracking.insert_many(sample_data)
            logger.info(f"✅ Created {len(result.inserted_ids)} sample records")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating sample data: {e}", exc_info=True)
        return False
        
    finally:
        client.close()


async def verify_collection(env="development"):
    """Verify the collection is properly set up"""
    
    # Set environment before loading settings
    os.environ['ENV'] = env
    settings = Settings()
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        logger.info("🔍 Verifying admin_inactivity_tracking collection...")
        
        # Check collection exists
        collections = await db.list_collection_names()
        if "admin_inactivity_tracking" not in collections:
            logger.error("❌ Collection not found")
            return False
        
        # Check indexes
        indexes = db.admin_inactivity_tracking.list_indexes()
        index_list = await indexes.to_list(length=100)
        logger.info(f"✅ Collection exists with {len(index_list)} indexes")
        
        # Check sample data count
        count = await db.admin_inactivity_tracking.count_documents({"isTest": True})
        logger.info(f"✅ Found {count} test records")
        
        # Test a sample query
        sample = await db.admin_inactivity_tracking.find_one({"isTest": True})
        if sample:
            logger.info("✅ Sample query successful")
            logger.info(f"   Sample record: {sample['username']} - {sample['escalationDays']} days")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error verifying collection: {e}", exc_info=True)
        return False
        
    finally:
        client.close()


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Create inactivity tracking collection and indexes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/create_inactivity_tracking.py
  python3 scripts/create_inactivity_tracking.py --env production
  python3 scripts/create_inactivity_tracking.py --env staging --no-sample
        """
    )
    
    parser.add_argument(
        "--env",
        choices=["development", "staging", "production", "local", "docker"],
        default="development",
        help="Environment to use (default: development)"
    )
    
    parser.add_argument(
        "--no-sample",
        action="store_true",
        help="Skip creating sample data (recommended for production)"
    )
    
    parser.add_argument(
        "--verify-only",
        action="store_true", 
        help="Only verify existing setup, don't create anything"
    )
    
    return parser.parse_args()


async def main():
    """Main execution function"""
    
    args = parse_arguments()
    
    print(f"🚀 Setting up Inactivity Tracking Collection")
    print(f"🌍 Environment: {args.env}")
    print("=" * 50)
    
    # Step 1: Create indexes (unless verify-only)
    if not args.verify_only:
        print("\n1. Creating indexes...")
        success = await create_inactivity_tracking_indexes(args.env)
        
        if not success:
            print("❌ Failed to create indexes. Exiting.")
            return
    else:
        print("\n1. Skipping index creation (verify-only mode)")
    
    # Step 2: Create sample data (optional, skip for production unless forced)
    if not args.verify_only and not args.no_sample and args.env != "production":
        print("\n2. Creating sample data...")
        await create_sample_data(args.env)
    elif args.env == "production" and not args.no_sample:
        print("\n2. Skipping sample data (production environment)")
        print("   Use --no-sample to suppress this message or --force-sample to create")
    elif args.no_sample:
        print("\n2. Skipping sample data (--no-sample flag)")
    
    # Step 3: Verify setup
    print("\n3. Verifying setup...")
    success = await verify_collection(args.env)
    
    if success:
        print(f"\n🎉 Inactivity tracking collection setup complete for {args.env}!")
        print("\nNext steps:")
        print("1. Restart the backend server")
        print("2. Test the enhanced login reminder job")
        print("3. Check the admin analytics dashboard")
        
        if args.env == "production":
            print("\n🚨 Production Notes:")
            print("- Sample data was NOT created (recommended)")
            print("- All indexes are optimized for production workloads")
            print("- TTL index will auto-cleanup test records after 30 days")
    else:
        print("\n❌ Setup verification failed. Please check the logs.")


if __name__ == "__main__":
    import sys
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Run the setup
    asyncio.run(main())
