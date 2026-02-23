#!/usr/bin/env python3
"""
Create collections for recurring contributions system
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def create_collections():
    """Create collections and indexes for recurring contributions"""
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print("🔧 Creating recurring contributions collections...")
        
        # Create recurring_contributions collection with indexes
        collection = db.recurring_contributions
        
        # Indexes for performance
        indexes = [
            [("username", 1)],  # User's contributions
            [("status", 1)],  # Status filtering
            [("next_payment_date", 1)],  # Find due payments
            [("status", 1), ("next_payment_date", 1)],  # Find active due payments
            [("created_at", -1)],  # Recent contributions
            [("paypal_vault_id", 1)],  # PayPal token lookup
        ]
        
        for index in indexes:
            await collection.create_index(index)
            print(f"✅ Created index: {index}")
        
        # Create recurring_transactions collection for payment history
        transactions = db.recurring_transactions
        
        transaction_indexes = [
            [("contribution_id", 1)],  # Transaction history
            [("username", 1), ("created_at", -1)],  # User's payment history
            [("status", 1)],  # Status filtering
            [("created_at", -1)],  # Recent transactions
            [("paypal_order_id", 1)],  # PayPal order lookup
        ]
        
        for index in transaction_indexes:
            await transactions.create_index(index)
            print(f"✅ Created transaction index: {index}")
        
        print("\n✅ All collections and indexes created successfully!")
        
        # Show collection stats
        recurring_count = await collection.count_documents({})
        transaction_count = await transactions.count_documents({})
        
        print(f"\n📊 Collection Stats:")
        print(f"  Recurring contributions: {recurring_count}")
        print(f"  Transactions: {transaction_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_collections())
