"""
L3V3L Score Pre-computation Job Template

This job pre-computes L3V3L match scores for all user pairs and stores them
in a matrix table for instant lookup during search.

Benefits:
- Eliminates real-time L3V3L API calls during search
- Reduces search time from 55+ seconds to <1 second
- Scores are always ready, no waiting

Schedule: Run nightly or on-demand per user
"""

import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
import logging

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# L3V3L scoring weights (same as routes.py)
L3V3L_WEIGHTS = {
    'pillar_alignment': 0.25,      # L3V3L pillars match
    'demographics': 0.15,          # Location, background
    'preferences_match': 0.20,     # Partner preferences alignment
    'habits_personality': 0.15,    # Lifestyle compatibility
    'career_education': 0.10,      # Professional alignment
    'physical_attributes': 0.05,  # Height, age compatibility
    'cultural_factors': 0.10       # Religion, traditions
}


def calculate_l3v3l_score(user1: dict, user2: dict) -> dict:
    """
    Calculate L3V3L compatibility score between two users.
    Returns score (0-100) and compatibility level.
    """
    scores = {}
    
    # 1. L3V3L Pillar Alignment (values, personality)
    pillar_score = 0
    user1_pillars = user1.get('l3v3lPillars', {})
    user2_pillars = user2.get('l3v3lPillars', {})
    if user1_pillars and user2_pillars:
        matching_pillars = 0
        total_pillars = 0
        for pillar in ['values', 'lifestyle', 'goals', 'communication', 'family']:
            if pillar in user1_pillars and pillar in user2_pillars:
                total_pillars += 1
                # Simple similarity check
                if user1_pillars[pillar] == user2_pillars[pillar]:
                    matching_pillars += 1
                elif isinstance(user1_pillars[pillar], list) and isinstance(user2_pillars[pillar], list):
                    # Check overlap for list values
                    overlap = len(set(user1_pillars[pillar]) & set(user2_pillars[pillar]))
                    if overlap > 0:
                        matching_pillars += overlap / max(len(user1_pillars[pillar]), len(user2_pillars[pillar]))
        if total_pillars > 0:
            pillar_score = (matching_pillars / total_pillars) * 100
    scores['pillar_alignment'] = pillar_score
    
    # 2. Demographics (location proximity)
    demo_score = 50  # Base score
    if user1.get('region') and user2.get('region'):
        if user1['region'].lower() == user2['region'].lower():
            demo_score = 100
        elif user1.get('city') and user2.get('city'):
            if user1['city'].lower() == user2['city'].lower():
                demo_score = 90
    scores['demographics'] = demo_score
    
    # 3. Partner Preferences Match
    pref_score = 50
    user1_prefs = user1.get('partnerPreferences', {})
    if user1_prefs:
        matches = 0
        checks = 0
        # Age preference
        if 'ageMin' in user1_prefs and 'ageMax' in user1_prefs:
            user2_age = user2.get('age') or _calculate_age(user2)
            if user2_age:
                checks += 1
                if user1_prefs['ageMin'] <= user2_age <= user1_prefs['ageMax']:
                    matches += 1
        # Height preference
        if 'heightMin' in user1_prefs and 'heightMax' in user1_prefs:
            user2_height = user2.get('heightInches')
            if user2_height:
                checks += 1
                if user1_prefs['heightMin'] <= user2_height <= user1_prefs['heightMax']:
                    matches += 1
        # Religion preference
        if user1_prefs.get('religion'):
            checks += 1
            if user2.get('religion') and user2['religion'].lower() in [r.lower() for r in user1_prefs['religion']] if isinstance(user1_prefs['religion'], list) else user2.get('religion', '').lower() == user1_prefs['religion'].lower():
                matches += 1
        if checks > 0:
            pref_score = (matches / checks) * 100
    scores['preferences_match'] = pref_score
    
    # 4. Habits & Personality
    habits_score = 50
    habit_fields = ['eatingPreference', 'drinking', 'smoking']
    habit_matches = 0
    habit_checks = 0
    for field in habit_fields:
        if user1.get(field) and user2.get(field):
            habit_checks += 1
            if user1[field].lower() == user2[field].lower():
                habit_matches += 1
    if habit_checks > 0:
        habits_score = (habit_matches / habit_checks) * 100
    scores['habits_personality'] = habits_score
    
    # 5. Career & Education
    career_score = 50
    if user1.get('education') and user2.get('education'):
        # Simple education level comparison
        edu_levels = ['high school', 'bachelor', 'master', 'phd', 'doctorate']
        u1_level = next((i for i, e in enumerate(edu_levels) if e in user1['education'].lower()), -1)
        u2_level = next((i for i, e in enumerate(edu_levels) if e in user2['education'].lower()), -1)
        if u1_level >= 0 and u2_level >= 0:
            career_score = 100 - abs(u1_level - u2_level) * 20
    scores['career_education'] = max(0, career_score)
    
    # 6. Physical Attributes (age compatibility)
    physical_score = 50
    u1_age = user1.get('age') or _calculate_age(user1)
    u2_age = user2.get('age') or _calculate_age(user2)
    if u1_age and u2_age:
        age_diff = abs(u1_age - u2_age)
        if age_diff <= 2:
            physical_score = 100
        elif age_diff <= 5:
            physical_score = 80
        elif age_diff <= 10:
            physical_score = 60
        else:
            physical_score = 40
    scores['physical_attributes'] = physical_score
    
    # 7. Cultural Factors
    cultural_score = 50
    if user1.get('religion') and user2.get('religion'):
        if user1['religion'].lower() == user2['religion'].lower():
            cultural_score = 100
    if user1.get('caste') and user2.get('caste'):
        if user1['caste'].lower() == user2['caste'].lower():
            cultural_score = min(100, cultural_score + 20)
    scores['cultural_factors'] = min(100, cultural_score)
    
    # Calculate weighted total
    total_score = sum(scores[k] * L3V3L_WEIGHTS[k] for k in L3V3L_WEIGHTS)
    
    # Determine compatibility level
    if total_score >= 80:
        level = 'Excellent'
    elif total_score >= 65:
        level = 'Very Good'
    elif total_score >= 50:
        level = 'Good'
    elif total_score >= 35:
        level = 'Fair'
    else:
        level = 'Low'
    
    return {
        'score': round(total_score, 1),
        'level': level,
        'breakdown': scores
    }


def _calculate_age(user: dict) -> int:
    """Calculate age from birthMonth and birthYear"""
    birth_year = user.get('birthYear')
    birth_month = user.get('birthMonth')
    if not birth_year:
        return None
    
    now = datetime.now()
    age = now.year - birth_year
    if birth_month and now.month < birth_month:
        age -= 1
    return age


async def calculate_scores_for_user(db, username: str) -> dict:
    """
    Calculate L3V3L scores for a single user against all opposite-gender users.
    Returns count of scores calculated.
    """
    # Get the user
    user = await db.users.find_one({"username": username, "accountStatus": "active"})
    if not user:
        return {"error": f"User {username} not found or not active", "calculated": 0}
    
    user_gender = user.get('gender')
    if not user_gender:
        return {"error": f"User {username} has no gender set", "calculated": 0}
    
    # Get opposite gender
    opposite_gender = "Female" if user_gender == "Male" else "Male"
    
    # Get all opposite-gender active users
    potential_matches = await db.users.find({
        "gender": opposite_gender,
        "accountStatus": "active",
        "username": {"$ne": username}
    }).to_list(None)
    
    logger.info(f"🦋 Calculating L3V3L scores for {username} against {len(potential_matches)} {opposite_gender} users")
    
    # Calculate scores
    scores_to_insert = []
    now = datetime.utcnow()
    
    for match in potential_matches:
        result = calculate_l3v3l_score(user, match)
        
        # Store bidirectional scores
        scores_to_insert.append({
            "fromUsername": username,
            "toUsername": match['username'],
            "score": result['score'],
            "level": result['level'],
            "breakdown": result['breakdown'],
            "calculatedAt": now
        })
    
    # Bulk upsert scores
    if scores_to_insert:
        bulk_ops = []
        for score in scores_to_insert:
            bulk_ops.append({
                "updateOne": {
                    "filter": {"fromUsername": score['fromUsername'], "toUsername": score['toUsername']},
                    "update": {"$set": score},
                    "upsert": True
                }
            })
        
        # Execute in batches of 500
        for i in range(0, len(bulk_ops), 500):
            batch = bulk_ops[i:i+500]
            await db.l3v3l_scores.bulk_write([
                __import__('pymongo').UpdateOne(
                    op['updateOne']['filter'],
                    op['updateOne']['update'],
                    upsert=op['updateOne']['upsert']
                ) for op in batch
            ])
    
    logger.info(f"✅ Calculated {len(scores_to_insert)} L3V3L scores for {username}")
    
    return {
        "username": username,
        "calculated": len(scores_to_insert),
        "oppositeGender": opposite_gender
    }


async def calculate_all_scores(db, batch_size: int = 50) -> dict:
    """
    Calculate L3V3L scores for ALL active users.
    This is the main batch job function.
    """
    start_time = datetime.utcnow()
    
    # Get all active users
    users = await db.users.find({
        "accountStatus": "active",
        "gender": {"$in": ["Male", "Female"]}
    }, {"username": 1, "gender": 1}).to_list(None)
    
    logger.info(f"🦋 Starting L3V3L batch calculation for {len(users)} users")
    
    total_scores = 0
    processed_users = 0
    errors = []
    
    for user in users:
        try:
            result = await calculate_scores_for_user(db, user['username'])
            if 'error' in result:
                errors.append(result['error'])
            else:
                total_scores += result.get('calculated', 0)
            processed_users += 1
            
            # Log progress every 10 users
            if processed_users % 10 == 0:
                logger.info(f"📊 Progress: {processed_users}/{len(users)} users processed, {total_scores} scores calculated")
                
        except Exception as e:
            errors.append(f"Error processing {user['username']}: {str(e)}")
            logger.error(f"❌ Error calculating scores for {user['username']}: {e}")
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    result = {
        "status": "completed",
        "usersProcessed": processed_users,
        "totalScoresCalculated": total_scores,
        "errors": errors[:10] if errors else [],  # Limit errors in response
        "errorCount": len(errors),
        "durationSeconds": round(duration, 2),
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat()
    }
    
    logger.info(f"✅ L3V3L batch calculation complete: {total_scores} scores in {duration:.1f}s")
    
    return result


async def run_job(params: dict = None) -> dict:
    """
    Entry point for Dynamic Scheduler.
    
    Params:
        - username: (optional) Calculate for specific user only
        - full_recalc: (optional) Force full recalculation for all users
    """
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    try:
        params = params or {}
        
        # Ensure index exists for fast lookups
        await db.l3v3l_scores.create_index([("fromUsername", 1), ("toUsername", 1)], unique=True)
        await db.l3v3l_scores.create_index([("fromUsername", 1)])
        await db.l3v3l_scores.create_index([("toUsername", 1)])
        
        if params.get('username'):
            # Calculate for specific user
            result = await calculate_scores_for_user(db, params['username'])
        else:
            # Full batch calculation
            result = await calculate_all_scores(db)
        
        return result
        
    finally:
        client.close()


# For direct execution
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='L3V3L Score Calculator')
    parser.add_argument('--username', help='Calculate for specific user')
    parser.add_argument('--all', action='store_true', help='Calculate for all users')
    
    args = parser.parse_args()
    
    if args.username:
        result = asyncio.run(run_job({'username': args.username}))
    else:
        result = asyncio.run(run_job({}))
    
    print(result)
