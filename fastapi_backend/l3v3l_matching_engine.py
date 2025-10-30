"""
L3V3L Matching Algorithm - AI-Powered Comprehensive Compatibility Scoring

This module implements a sophisticated matching algorithm that considers:
1. Gender compatibility (opposite gender)
2. L3V3L Pillars alignment (values, personality)
3. Demographics (location, background)
4. Partner preferences match
5. Habits & personality compatibility
6. Career & education compatibility
7. Physical attributes (height, age, education level)
8. Cultural factors (religion, origin, traditions)
9. Machine Learning-based scoring with Scikit-learn

@author: Matrimonial App Team
@version: 1.0.0
"""

import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
import logging

logger = logging.getLogger(__name__)

class L3V3LMatchingEngine:
    """
    Comprehensive matching engine using ML techniques to calculate compatibility scores
    """
    
    # Scoring weights (total = 100%)
    WEIGHTS = {
        'gender': 0.15,              # 15% - Must be opposite gender
        'l3v3l_pillars': 0.20,       # 20% - L3V3L values alignment
        'demographics': 0.10,        # 10% - Location, background
        'partner_preferences': 0.15, # 15% - User's stated preferences
        'habits_personality': 0.10,  # 10% - Lifestyle compatibility
        'career_education': 0.10,    # 10% - Work-life compatibility
        'physical_attributes': 0.10, # 10% - Height, age, education
        'cultural_factors': 0.10     # 10% - Religion, origin, traditions
    }
    
    # Profession stress levels (for work-life compatibility)
    PROFESSION_STRESS = {
        'doctor': {'stress': 9, 'shifts': True, 'nature': 'high_stakes'},
        'lawyer': {'stress': 8, 'shifts': False, 'nature': 'high_stakes'},
        'teacher': {'stress': 6, 'shifts': False, 'nature': 'service'},
        'professor': {'stress': 5, 'shifts': False, 'nature': 'academic'},
        'nurse': {'stress': 8, 'shifts': True, 'nature': 'high_stakes'},
        'engineer': {'stress': 6, 'shifts': False, 'nature': 'technical'},
        'software': {'stress': 7, 'shifts': False, 'nature': 'technical'},
        'manager': {'stress': 7, 'shifts': False, 'nature': 'leadership'},
        'finance': {'stress': 7, 'shifts': False, 'nature': 'analytical'},
        'business': {'stress': 6, 'shifts': False, 'nature': 'entrepreneurial'},
        'consultant': {'stress': 7, 'shifts': False, 'nature': 'analytical'},
        'police': {'stress': 9, 'shifts': True, 'nature': 'high_stakes'},
        'military': {'stress': 9, 'shifts': True, 'nature': 'high_stakes'},
        'pilot': {'stress': 8, 'shifts': True, 'nature': 'high_stakes'},
        'default': {'stress': 5, 'shifts': False, 'nature': 'standard'}
    }
    
    # Education levels (hierarchical)
    EDUCATION_LEVELS = {
        'High School': 1,
        'Diploma': 2,
        'Associate': 2,
        'Bachelor': 3,
        'BS': 3,
        'BA': 3,
        'Master': 4,
        'MS': 4,
        'MA': 4,
        'MBA': 4,
        'PhD': 5,
        'MD': 5,
        'JD': 5,
        'Professional': 5
    }
    
    def __init__(self):
        self.scaler = MinMaxScaler()
    
    def calculate_match_score(self, user1: Dict, user2: Dict) -> Dict:
        """
        Calculate comprehensive L3V3L match score between two users
        
        Args:
            user1: First user profile dictionary
            user2: Second user profile dictionary
            
        Returns:
            Dictionary containing total score and component scores
        """
        try:
            scores = {}
            
            # 1. Gender Compatibility (15%)
            scores['gender'] = self._score_gender(user1, user2)
            
            # 2. L3V3L Pillars Alignment (20%)
            scores['l3v3l_pillars'] = self._score_l3v3l_pillars(user1, user2)
            
            # 3. Demographics (10%)
            scores['demographics'] = self._score_demographics(user1, user2)
            
            # 4. Partner Preferences Match (15%)
            scores['partner_preferences'] = self._score_partner_preferences(user1, user2)
            
            # 5. Habits & Personality (10%)
            scores['habits_personality'] = self._score_habits_personality(user1, user2)
            
            # 6. Career & Education (10%)
            scores['career_education'] = self._score_career_education(user1, user2)
            
            # 7. Physical Attributes (10%)
            scores['physical_attributes'] = self._score_physical_attributes(user1, user2)
            
            # 8. Cultural Factors (10%)
            scores['cultural_factors'] = self._score_cultural_factors(user1, user2)
            
            # Calculate weighted total score
            total_score = sum(
                scores[key] * self.WEIGHTS[key] 
                for key in scores.keys()
            ) * 100  # Convert to 0-100 scale
            
            return {
                'total_score': round(total_score, 2),
                'component_scores': {k: round(v * 100, 2) for k, v in scores.items()},
                'compatibility_level': self._get_compatibility_level(total_score),
                'match_reasons': self._generate_match_reasons(scores, user1, user2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating match score: {e}")
            return {
                'total_score': 0,
                'component_scores': {},
                'compatibility_level': 'Unknown',
                'match_reasons': []
            }
    
    def _score_gender(self, user1: Dict, user2: Dict) -> float:
        """Score gender compatibility (opposite gender preferred)"""
        gender1 = user1.get('gender', '').lower()
        gender2 = user2.get('gender', '').lower()
        
        if not gender1 or not gender2:
            return 0.0
        
        # Perfect score for opposite gender
        if (gender1 == 'male' and gender2 == 'female') or \
           (gender1 == 'female' and gender2 == 'male'):
            return 1.0
        
        return 0.0  # Same gender = no match
    
    def _score_l3v3l_pillars(self, user1: Dict, user2: Dict) -> float:
        """
        Score L3V3L Pillars alignment
        Pillars: Love, Loyalty, Laughter, Vulnerability, Elevation, Effort
        """
        score = 0.0
        factors = 0
        
        # Extract L3V3L-related fields from profiles
        # This can be enhanced with dedicated L3V3L questionnaire responses
        
        # 1. Family Values alignment (Loyalty)
        family_values1 = user1.get('familyValues', '').lower()
        family_values2 = user2.get('familyValues', '').lower()
        if family_values1 and family_values2:
            if family_values1 == family_values2:
                score += 1.0
            elif 'traditional' in family_values1 and 'moderate' in family_values2:
                score += 0.7
            elif 'moderate' in family_values1 and 'liberal' in family_values2:
                score += 0.7
            factors += 1
        
        # 2. Partner Preference text analysis (Vulnerability, Effort)
        partner_pref1 = user1.get('partnerPreference', '').lower()
        partner_pref2 = user2.get('partnerPreference', '').lower()
        if partner_pref1 and partner_pref2:
            # Look for emotional depth keywords
            emotional_keywords = ['honest', 'open', 'caring', 'understanding', 
                                  'supportive', 'kind', 'empathetic', 'loyal']
            matches = sum(1 for keyword in emotional_keywords 
                         if keyword in partner_pref1 and keyword in partner_pref2)
            if matches > 0:
                score += min(matches / len(emotional_keywords), 1.0)
            factors += 1
        
        # 3. About Me text analysis (Elevation, Laughter)
        about1 = user1.get('aboutMe', '').lower()
        about2 = user2.get('aboutMe', '').lower()
        if about1 and about2:
            # Look for positive personality traits
            positive_traits = ['fun', 'funny', 'humor', 'adventure', 'travel',
                              'growth', 'ambitious', 'positive', 'optimistic']
            matches = sum(1 for trait in positive_traits 
                         if trait in about1 and trait in about2)
            if matches > 0:
                score += min(matches / len(positive_traits), 1.0)
            factors += 1
        
        # 4. Languages compatibility (Communication = Laughter)
        lang1 = set(user1.get('languagesSpoken', []))
        lang2 = set(user2.get('languagesSpoken', []))
        if lang1 and lang2:
            common_langs = lang1.intersection(lang2)
            if common_langs:
                score += len(common_langs) / max(len(lang1), len(lang2))
            factors += 1
        
        return score / factors if factors > 0 else 0.5  # Default neutral score
    
    def _score_demographics(self, user1: Dict, user2: Dict) -> float:
        """Score demographic compatibility"""
        score = 0.0
        factors = 0
        
        # 1. Country of origin match
        if user1.get('countryOfOrigin') == user2.get('countryOfOrigin'):
            score += 1.0
        else:
            score += 0.5  # Different origin = partial compatibility
        factors += 1
        
        # 2. Country of residence match (more important)
        if user1.get('countryOfResidence') == user2.get('countryOfResidence'):
            score += 1.0
            factors += 1
            
            # 2a. State match (if same country)
            if user1.get('state') == user2.get('state'):
                score += 1.0
                factors += 1
                
                # 2b. Location/city proximity
                loc1 = user1.get('location', '').lower()
                loc2 = user2.get('location', '').lower()
                if loc1 and loc2:
                    if loc1 == loc2:
                        score += 1.0
                    elif any(word in loc2 for word in loc1.split()) or \
                         any(word in loc1 for word in loc2.split()):
                        score += 0.7  # Nearby cities
                    factors += 1
        else:
            score += 0.3  # Different country = lower compatibility
            factors += 1
        
        # 3. Citizenship status (for US profiles)
        if user1.get('countryOfResidence') == 'US' and user2.get('countryOfResidence') == 'US':
            status1 = user1.get('citizenshipStatus', '')
            status2 = user2.get('citizenshipStatus', '')
            if status1 and status2:
                if status1 == status2:
                    score += 1.0
                else:
                    score += 0.7  # Mixed status still compatible
                factors += 1
        
        return score / factors if factors > 0 else 0.0
    
    def _score_partner_preferences(self, user1: Dict, user2: Dict) -> float:
        """Score how well each user matches the other's partner criteria"""
        # This is bi-directional scoring
        score1 = self._check_matches_criteria(user2, user1.get('partnerCriteria', {}))
        score2 = self._check_matches_criteria(user1, user2.get('partnerCriteria', {}))
        
        # Average both directions
        return (score1 + score2) / 2.0
    
    def _check_matches_criteria(self, profile: Dict, criteria: Dict) -> float:
        """Check if profile matches the given criteria"""
        if not criteria:
            return 0.8  # No criteria = assume general compatibility
        
        score = 0.0
        checks = 0
        
        # Age range
        if 'ageRange' in criteria:
            age = self._calculate_age(profile.get('dateOfBirth'))
            if age:
                # Convert to int to handle string values from MongoDB
                # Handle empty strings by using defaults
                min_age_val = criteria['ageRange'].get('min', 18)
                max_age_val = criteria['ageRange'].get('max', 100)
                min_age = int(min_age_val) if min_age_val not in ['', None] else 18
                max_age = int(max_age_val) if max_age_val not in ['', None] else 100
                if min_age <= age <= max_age:
                    score += 1.0
                elif min_age - 2 <= age <= max_age + 2:
                    score += 0.7  # Close to range
                checks += 1
        
        # Height range
        if 'heightRange' in criteria:
            height_inches = self._height_to_inches(profile.get('height', ''))
            if height_inches:
                min_height = self._height_to_inches(criteria['heightRange'].get('min', ''))
                max_height = self._height_to_inches(criteria['heightRange'].get('max', ''))
                if min_height and max_height:
                    if min_height <= height_inches <= max_height:
                        score += 1.0
                    elif min_height - 2 <= height_inches <= max_height + 2:
                        score += 0.7
                    checks += 1
        
        # Education level
        if 'educationLevel' in criteria:
            user_edu = self._extract_education_level(profile)
            preferred_edu = criteria['educationLevel']
            if isinstance(preferred_edu, list) and user_edu in preferred_edu:
                score += 1.0
                checks += 1
            elif user_edu:
                checks += 1
        
        # Religion
        if 'religion' in criteria:
            preferred_religions = criteria['religion']
            if isinstance(preferred_religions, list):
                if profile.get('religion') in preferred_religions:
                    score += 1.0
                checks += 1
        
        # Languages
        if 'languages' in criteria:
            profile_langs = set(profile.get('languagesSpoken', []))
            preferred_langs = set(criteria.get('languages', []))
            if profile_langs.intersection(preferred_langs):
                score += 1.0
                checks += 1
        
        # Eating preference
        if 'eatingPreference' in criteria:
            preferred_eating = criteria['eatingPreference']
            if isinstance(preferred_eating, list):
                if profile.get('eatingPreference') in preferred_eating:
                    score += 1.0
                checks += 1
        
        return score / checks if checks > 0 else 0.8
    
    def _score_habits_personality(self, user1: Dict, user2: Dict) -> float:
        """Score lifestyle and personality compatibility"""
        score = 0.0
        factors = 0
        
        # 1. Eating preferences
        eat1 = user1.get('eatingPreference', '')
        eat2 = user2.get('eatingPreference', '')
        if eat1 and eat2:
            if eat1 == eat2:
                score += 1.0
            elif (eat1 == 'Vegetarian' and eat2 == 'Eggetarian') or \
                 (eat1 == 'Eggetarian' and eat2 == 'Vegetarian'):
                score += 0.8  # Close compatibility
            elif 'Non-Veg' in eat1 or 'Non-Veg' in eat2:
                score += 0.6  # Mixed but workable
            factors += 1
        
        # 2. Family type compatibility
        family1 = user1.get('familyType', '')
        family2 = user2.get('familyType', '')
        if family1 and family2:
            if family1 == family2:
                score += 1.0
            else:
                score += 0.7  # Different family types can work
            factors += 1
        
        # 3. Mother tongue (for cultural connection)
        tongue1 = user1.get('motherTongue', '')
        tongue2 = user2.get('motherTongue', '')
        if tongue1 and tongue2:
            if tongue1 == tongue2:
                score += 1.0
            factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _score_career_education(self, user1: Dict, user2: Dict) -> float:
        """
        Score career and education compatibility
        Considers: work stress, shifts, education level match
        """
        score = 0.0
        factors = 0
        
        # 1. Education level compatibility (BS <-> MS range)
        edu_level1 = self._get_education_numeric(user1)
        edu_level2 = self._get_education_numeric(user2)
        if edu_level1 and edu_level2:
            diff = abs(edu_level1 - edu_level2)
            if diff == 0:
                score += 1.0  # Same level
            elif diff == 1:
                score += 0.9  # BS <-> MS (perfect)
            elif diff == 2:
                score += 0.7  # 2 levels apart
            else:
                score += 0.5  # More than 2 levels
            factors += 1
        
        # 2. Work-life balance compatibility
        work1 = self._analyze_profession(user1)
        work2 = self._analyze_profession(user2)
        
        if work1 and work2:
            # Stress level compatibility (convert to int to handle any string values)
            stress1_val = work1.get('stress', 5)
            stress2_val = work2.get('stress', 5)
            stress1 = int(stress1_val) if stress1_val not in ['', None] else 5
            stress2 = int(stress2_val) if stress2_val not in ['', None] else 5
            stress_diff = abs(stress1 - stress2)
            if stress_diff <= 2:
                score += 1.0  # Similar stress levels
            elif stress_diff <= 4:
                score += 0.7  # Manageable difference
            else:
                score += 0.4  # High stress mismatch
            factors += 1
            
            # Shift work compatibility
            if work1['shifts'] == work2['shifts']:
                score += 1.0  # Both have shifts or both don't
            else:
                score += 0.6  # One has shifts, challenging but workable
            factors += 1
            
            # Work nature compatibility
            if work1['nature'] == work2['nature']:
                score += 0.8  # Similar work nature
            else:
                score += 0.6  # Different but complementary
            factors += 1
        
        # 3. Work location compatibility
        work_loc1 = user1.get('workLocation', '').lower()
        work_loc2 = user2.get('workLocation', '').lower()
        if work_loc1 and work_loc2:
            if work_loc1 == work_loc2:
                score += 1.0
            elif any(word in work_loc2 for word in work_loc1.split()):
                score += 0.7  # Nearby
            factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _score_physical_attributes(self, user1: Dict, user2: Dict) -> float:
        """
        Score physical attribute compatibility
        Height: ±1-3 inches, Age: -1 to +3 years
        """
        score = 0.0
        factors = 0
        
        # 1. Height compatibility (user preference: 1-3 inch difference)
        height1 = self._height_to_inches(user1.get('height', ''))
        height2 = self._height_to_inches(user2.get('height', ''))
        
        if height1 and height2:
            # _height_to_inches returns float, convert to int for comparison
            try:
                height1 = int(height1)
                height2 = int(height2)
            except (ValueError, TypeError):
                # Skip height comparison if conversion fails
                pass
            else:
                # Assuming male should be taller (traditional preference)
                if user1.get('gender') == 'Male':
                    height_diff = height1 - height2
                else:
                    height_diff = height2 - height1
                
                if 1 <= height_diff <= 3:
                    score += 1.0  # Perfect range
                elif 0 <= height_diff <= 5:
                    score += 0.8  # Acceptable
                elif height_diff < 0:
                    score += 0.5  # Female taller (less preferred traditionally)
                else:
                    score += 0.6  # More than 5 inches difference
                factors += 1
        
        # 2. Age compatibility (-1 to +3 years)
        age1 = self._calculate_age(user1.get('dateOfBirth'))
        age2 = self._calculate_age(user2.get('dateOfBirth'))
        
        if age1 and age2:
            # _calculate_age returns int, already validated
            # Assuming male should be slightly older or same age
            if user1.get('gender') == 'Male':
                age_diff = age1 - age2
            else:
                age_diff = age2 - age1
            
            if -1 <= age_diff <= 3:
                score += 1.0  # Perfect range
            elif -2 <= age_diff <= 5:
                score += 0.8  # Acceptable
            elif age_diff < -2:
                score += 0.6  # Female significantly older
            else:
                score += 0.7  # Male much older
            factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _score_cultural_factors(self, user1: Dict, user2: Dict) -> float:
        """Score cultural and religious compatibility"""
        score = 0.0
        factors = 0
        
        # 1. Religion match
        religion1 = user1.get('religion', '')
        religion2 = user2.get('religion', '')
        if religion1 and religion2:
            if religion1 == religion2:
                score += 1.0
            elif 'No Religion' in religion1 or 'No Religion' in religion2:
                score += 0.7  # One non-religious
            else:
                score += 0.3  # Different religions
            factors += 1
        
        # 2. Caste compatibility (if applicable and specified)
        caste1 = user1.get('caste', '')
        caste2 = user2.get('caste', '')
        caste_pref1 = user1.get('castePreference', 'None')
        caste_pref2 = user2.get('castePreference', 'None')
        
        if caste1 and caste2 and caste_pref1 != 'None' and caste_pref2 != 'None':
            if caste1 == caste2:
                score += 1.0
            elif 'Any' in caste_pref1 or 'Any' in caste_pref2:
                score += 0.9
            else:
                score += 0.4
            factors += 1
        
        # 3. Country of origin (cultural background)
        origin1 = user1.get('countryOfOrigin', '')
        origin2 = user2.get('countryOfOrigin', '')
        if origin1 and origin2:
            if origin1 == origin2:
                score += 1.0
            else:
                score += 0.6  # Different origins can work
            factors += 1
        
        # 4. Family values alignment
        values1 = user1.get('familyValues', '')
        values2 = user2.get('familyValues', '')
        if values1 and values2:
            if values1 == values2:
                score += 1.0
            elif ('Traditional' in values1 and 'Moderate' in values2) or \
                 ('Moderate' in values1 and 'Traditional' in values2):
                score += 0.8
            elif ('Moderate' in values1 and 'Liberal' in values2) or \
                 ('Liberal' in values1 and 'Moderate' in values2):
                score += 0.7
            else:
                score += 0.5
            factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    # Helper methods
    
    def _calculate_age(self, dob_str: Optional[str]) -> Optional[int]:
        """Calculate age from date of birth string"""
        if not dob_str:
            return None
        try:
            dob = datetime.strptime(dob_str, '%Y-%m-%d')
            today = datetime.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            return age
        except:
            return None
    
    def _height_to_inches(self, height_str: str) -> Optional[float]:
        """Convert height string to inches"""
        if not height_str or height_str.strip() == '':
            return None
        try:
            # Parse formats: 5'8", 5 ft 8 in, 170cm
            if '"' in height_str or "'" in height_str:
                # Format: 5'8"
                match = re.search(r"(\d+)'(\d+)", height_str)
                if match and match.group(1) and match.group(2):
                    feet = int(match.group(1))
                    inches = int(match.group(2))
                    return feet * 12 + inches
            elif 'ft' in height_str.lower():
                # Format: 5 ft 8 in
                match = re.search(r"(\d+)\s*ft\s*(\d+)", height_str.lower())
                if match and match.group(1) and match.group(2):
                    feet = int(match.group(1))
                    inches = int(match.group(2))
                    return feet * 12 + inches
            elif 'cm' in height_str.lower():
                # Format: 170cm
                match = re.search(r"(\d+)", height_str)
                if match and match.group(1):
                    cm = int(match.group(1))
                    return cm / 2.54  # Convert cm to inches
        except (ValueError, TypeError, AttributeError) as e:
            logger.debug(f"Failed to parse height '{height_str}': {e}")
        return None
    
    def _get_education_numeric(self, user: Dict) -> Optional[int]:
        """Get numeric education level"""
        # Check structured education history first
        edu_history = user.get('educationHistory', [])
        if edu_history:
            highest = max(
                (self.EDUCATION_LEVELS.get(edu.get('degree', ''), 0) for edu in edu_history),
                default=0
            )
            if highest > 0:
                return highest
        
        # Fall back to legacy education field
        edu = user.get('education', '')
        for key, level in self.EDUCATION_LEVELS.items():
            if key.lower() in edu.lower():
                return level
        return None
    
    def _extract_education_level(self, user: Dict) -> Optional[str]:
        """Extract education level string"""
        edu_history = user.get('educationHistory', [])
        if edu_history:
            # Get highest degree
            highest_edu = max(edu_history, key=lambda x: self.EDUCATION_LEVELS.get(x.get('degree', ''), 0), default={})
            return highest_edu.get('degree', '')
        return user.get('education', '')
    
    def _analyze_profession(self, user: Dict) -> Optional[Dict]:
        """Analyze user's profession for work-life compatibility"""
        work_exp = user.get('workExperience', [])
        if not work_exp:
            return None
        
        # Get current/latest job
        current_job = work_exp[0] if work_exp else {}
        title = current_job.get('title', '').lower()
        
        # Match against profession categories
        for prof, details in self.PROFESSION_STRESS.items():
            if prof in title:
                return details
        
        return self.PROFESSION_STRESS['default']
    
    def _get_compatibility_level(self, score: float) -> str:
        """Convert numeric score to compatibility level"""
        if score >= 85:
            return 'Excellent L3V3L Match 🦋'
        elif score >= 75:
            return 'Great Match ⭐'
        elif score >= 65:
            return 'Good Match 👍'
        elif score >= 50:
            return 'Moderate Match 🤝'
        else:
            return 'Low Match 📊'
    
    def _generate_match_reasons(self, scores: Dict, user1: Dict, user2: Dict) -> List[str]:
        """Generate human-readable reasons for the match score"""
        reasons = []
        
        # Top 3 strongest factors
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:3]
        
        for factor, score in sorted_scores:
            if score >= 0.8:
                if factor == 'gender':
                    reasons.append("✅ Perfect gender compatibility")
                elif factor == 'l3v3l_pillars':
                    reasons.append("✅ Strong L3V3L values alignment")
                elif factor == 'demographics':
                    reasons.append("✅ Excellent location & background match")
                elif factor == 'partner_preferences':
                    reasons.append("✅ You match each other's preferences")
                elif factor == 'career_education':
                    reasons.append("✅ Great career & education compatibility")
                elif factor == 'cultural_factors':
                    reasons.append("✅ Strong cultural connection")
                elif factor == 'physical_attributes':
                    reasons.append("✅ Ideal age & height match")
        
        return reasons[:5]  # Return top 5 reasons


# Global instance
matching_engine = L3V3LMatchingEngine()
