"""
L3V3L Score Pre-computation Job Template

Pre-computes L3V3L match scores for all user pairs and stores them
in a matrix table for instant lookup during search.

Benefits:
- Eliminates real-time L3V3L API calls during search
- Reduces search time from 55+ seconds to <1 second
- Scores are always ready, no waiting
"""

from .base import JobTemplate
from datetime import datetime
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# L3V3L scoring weights
L3V3L_WEIGHTS = {
    'pillar_alignment': 0.25,
    'demographics': 0.15,
    'preferences_match': 0.20,
    'habits_personality': 0.15,
    'career_education': 0.10,
    'physical_attributes': 0.05,
    'cultural_factors': 0.10
}


class L3V3LScoreCalculatorTemplate(JobTemplate):
    """Job template for pre-computing L3V3L match scores"""
    
    template_type = "l3v3l_score_calculator"
    template_name = "L3V3L Score Calculator"
    template_description = "Pre-computes L3V3L match scores for all user pairs for instant search lookup"
    
    default_params = {
        "username": "",  # Empty = all users, specific username = single user
        "batch_size": 50
    }
    
    param_schema = {
        "username": {
            "type": "string",
            "description": "Username to calculate scores for (empty = all users)",
            "required": False
        },
        "batch_size": {
            "type": "integer",
            "description": "Number of users to process in each batch",
            "required": False,
            "default": 50
        }
    }
    
    async def execute(self, params: Dict[str, Any], db) -> Dict[str, Any]:
        """Execute the L3V3L score calculation job"""
        start_time = datetime.utcnow()
        
        username = params.get('username', '')
        batch_size = params.get('batch_size', 50)
        
        logger.info(f"🦋 Starting L3V3L score calculation - username: '{username}', batch_size: {batch_size}")
        
        # Ensure indexes exist
        await db.l3v3l_scores.create_index([("fromUsername", 1), ("toUsername", 1)], unique=True)
        await db.l3v3l_scores.create_index([("fromUsername", 1)])
        await db.l3v3l_scores.create_index([("toUsername", 1)])
        
        if username:
            # Calculate for specific user
            result = await self._calculate_for_user(db, username)
        else:
            # Calculate for all users
            result = await self._calculate_all(db, batch_size)
        
        end_time = datetime.utcnow()
        result['durationSeconds'] = (end_time - start_time).total_seconds()
        
        return result
    
    async def _calculate_for_user(self, db, username: str) -> Dict[str, Any]:
        """Calculate scores for a single user"""
        user = await db.users.find_one({"username": username, "accountStatus": "active"})
        if not user:
            return {"error": f"User {username} not found or not active", "calculated": 0}
        
        user_gender = user.get('gender')
        if not user_gender:
            return {"error": f"User {username} has no gender set", "calculated": 0}
        
        opposite_gender = "Female" if user_gender == "Male" else "Male"
        
        # Get all opposite-gender active users
        potential_matches = await db.users.find({
            "gender": opposite_gender,
            "accountStatus": "active",
            "username": {"$ne": username}
        }).to_list(None)
        
        logger.info(f"🦋 Calculating scores for {username} against {len(potential_matches)} {opposite_gender} users")
        
        scores_calculated = await self._calculate_and_store_scores(db, user, potential_matches)
        
        return {
            "status": "completed",
            "username": username,
            "calculated": scores_calculated,
            "oppositeGender": opposite_gender
        }
    
    async def _calculate_all(self, db, batch_size: int) -> Dict[str, Any]:
        """Calculate scores for all active users"""
        users = await db.users.find({
            "accountStatus": "active",
            "gender": {"$in": ["Male", "Female"]}
        }).to_list(None)
        
        logger.info(f"🦋 Starting batch calculation for {len(users)} users")
        
        total_scores = 0
        processed = 0
        errors = []
        
        for user in users:
            try:
                user_gender = user.get('gender')
                if not user_gender:
                    continue
                
                opposite_gender = "Female" if user_gender == "Male" else "Male"
                
                potential_matches = await db.users.find({
                    "gender": opposite_gender,
                    "accountStatus": "active",
                    "username": {"$ne": user['username']}
                }).to_list(None)
                
                count = await self._calculate_and_store_scores(db, user, potential_matches)
                total_scores += count
                processed += 1
                
                if processed % 10 == 0:
                    logger.info(f"📊 Progress: {processed}/{len(users)} users, {total_scores} scores")
                    
            except Exception as e:
                errors.append(f"{user.get('username')}: {str(e)}")
                logger.error(f"❌ Error for {user.get('username')}: {e}")
        
        return {
            "status": "completed",
            "usersProcessed": processed,
            "totalScoresCalculated": total_scores,
            "errorCount": len(errors),
            "errors": errors[:10]
        }
    
    async def _calculate_and_store_scores(self, db, user: dict, matches: list) -> int:
        """Calculate and store scores for a user against matches"""
        from pymongo import UpdateOne
        
        now = datetime.utcnow()
        bulk_ops = []
        
        for match in matches:
            result = self._calculate_score(user, match)
            
            bulk_ops.append(UpdateOne(
                {"fromUsername": user['username'], "toUsername": match['username']},
                {"$set": {
                    "fromUsername": user['username'],
                    "toUsername": match['username'],
                    "score": result['score'],
                    "level": result['level'],
                    "breakdown": result['breakdown'],
                    "calculatedAt": now
                }},
                upsert=True
            ))
        
        if bulk_ops:
            # Execute in batches
            for i in range(0, len(bulk_ops), 500):
                batch = bulk_ops[i:i+500]
                await db.l3v3l_scores.bulk_write(batch)
        
        return len(bulk_ops)
    
    def _calculate_score(self, user1: dict, user2: dict) -> dict:
        """Calculate L3V3L compatibility score between two users"""
        scores = {}
        
        # 1. Pillar Alignment
        scores['pillar_alignment'] = self._score_pillars(user1, user2)
        
        # 2. Demographics
        scores['demographics'] = self._score_demographics(user1, user2)
        
        # 3. Preferences Match
        scores['preferences_match'] = self._score_preferences(user1, user2)
        
        # 4. Habits & Personality
        scores['habits_personality'] = self._score_habits(user1, user2)
        
        # 5. Career & Education
        scores['career_education'] = self._score_career(user1, user2)
        
        # 6. Physical Attributes
        scores['physical_attributes'] = self._score_physical(user1, user2)
        
        # 7. Cultural Factors
        scores['cultural_factors'] = self._score_cultural(user1, user2)
        
        # Calculate weighted total
        total = sum(scores[k] * L3V3L_WEIGHTS[k] for k in L3V3L_WEIGHTS)
        
        # Determine level
        if total >= 80:
            level = 'Excellent'
        elif total >= 65:
            level = 'Very Good'
        elif total >= 50:
            level = 'Good'
        elif total >= 35:
            level = 'Fair'
        else:
            level = 'Low'
        
        return {'score': round(total, 1), 'level': level, 'breakdown': scores}
    
    def _score_pillars(self, u1: dict, u2: dict) -> float:
        """Score L3V3L pillar alignment"""
        p1 = u1.get('l3v3lPillars', {})
        p2 = u2.get('l3v3lPillars', {})
        if not p1 or not p2:
            return 50
        
        matches = 0
        total = 0
        for pillar in ['values', 'lifestyle', 'goals', 'communication', 'family']:
            if pillar in p1 and pillar in p2:
                total += 1
                if p1[pillar] == p2[pillar]:
                    matches += 1
        
        return (matches / total * 100) if total > 0 else 50
    
    def _score_demographics(self, u1: dict, u2: dict) -> float:
        """Score location proximity"""
        if u1.get('region') and u2.get('region'):
            if u1['region'].lower() == u2['region'].lower():
                return 100
            if u1.get('city') and u2.get('city') and u1['city'].lower() == u2['city'].lower():
                return 90
        return 50
    
    def _score_preferences(self, u1: dict, u2: dict) -> float:
        """Score partner preferences match"""
        prefs = u1.get('partnerPreferences', {})
        if not prefs:
            return 50
        
        matches = checks = 0
        
        # Age
        if 'ageMin' in prefs and 'ageMax' in prefs:
            age = self._get_age(u2)
            if age:
                checks += 1
                if prefs['ageMin'] <= age <= prefs['ageMax']:
                    matches += 1
        
        # Height
        if 'heightMin' in prefs and 'heightMax' in prefs:
            height = u2.get('heightInches')
            if height:
                checks += 1
                if prefs['heightMin'] <= height <= prefs['heightMax']:
                    matches += 1
        
        return (matches / checks * 100) if checks > 0 else 50
    
    def _score_habits(self, u1: dict, u2: dict) -> float:
        """Score habits compatibility"""
        fields = ['eatingPreference', 'drinking', 'smoking']
        matches = checks = 0
        for f in fields:
            if u1.get(f) and u2.get(f):
                checks += 1
                if u1[f].lower() == u2[f].lower():
                    matches += 1
        return (matches / checks * 100) if checks > 0 else 50
    
    def _score_career(self, u1: dict, u2: dict) -> float:
        """Score career/education compatibility"""
        if not u1.get('education') or not u2.get('education'):
            return 50
        
        levels = ['high school', 'bachelor', 'master', 'phd', 'doctorate']
        l1 = next((i for i, e in enumerate(levels) if e in u1['education'].lower()), -1)
        l2 = next((i for i, e in enumerate(levels) if e in u2['education'].lower()), -1)
        
        if l1 >= 0 and l2 >= 0:
            return max(0, 100 - abs(l1 - l2) * 20)
        return 50
    
    def _score_physical(self, u1: dict, u2: dict) -> float:
        """Score physical attribute compatibility (age)"""
        a1 = self._get_age(u1)
        a2 = self._get_age(u2)
        if not a1 or not a2:
            return 50
        
        diff = abs(a1 - a2)
        if diff <= 2:
            return 100
        elif diff <= 5:
            return 80
        elif diff <= 10:
            return 60
        return 40
    
    def _score_cultural(self, u1: dict, u2: dict) -> float:
        """Score cultural compatibility"""
        score = 50
        if u1.get('religion') and u2.get('religion'):
            if u1['religion'].lower() == u2['religion'].lower():
                score = 100
        if u1.get('caste') and u2.get('caste'):
            if u1['caste'].lower() == u2['caste'].lower():
                score = min(100, score + 20)
        return score
    
    def _get_age(self, user: dict) -> int:
        """Calculate age from birth year/month"""
        year = user.get('birthYear')
        if not year:
            return None
        
        now = datetime.now()
        age = now.year - year
        month = user.get('birthMonth')
        if month and now.month < month:
            age -= 1
        return age
