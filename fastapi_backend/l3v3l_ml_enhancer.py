"""
L3V3L ML Enhancer - Machine Learning Features for Match Prediction

Uses scikit-learn to:
1. Train a collaborative filtering model
2. Predict compatibility using user interaction data
3. Cluster similar profiles
4. Feature importance analysis

@author: Matrimonial App Team
@version: 1.0.0
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class L3V3LMLEnhancer:
    """
    Machine Learning enhancements for L3V3L matching
    Uses user interaction data to improve predictions
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=5)
        self.rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.kmeans = KMeans(n_clusters=10, random_state=42)
        self.is_trained = False
    
    def extract_features(self, user: Dict) -> np.ndarray:
        """
        Extract numerical features from user profile for ML
        
        Features:
        - Age (normalized)
        - Height (normalized)
        - Education level (1-5)
        - Religion encoded
        - Location encoded
        - Profession stress level
        - Languages count
        - Family values encoded
        """
        features = []
        
        # 1. Age
        age = self._parse_age(user.get('dateOfBirth', ''))
        features.append(age if age else 30)  # Default 30
        
        # 2. Height (in inches)
        height = self._parse_height(user.get('height', ''))
        features.append(height if height else 66)  # Default 5'6"
        
        # 3. Education level (1-5)
        edu_level = self._education_to_number(user)
        features.append(edu_level)
        
        # 4. Religion (one-hot encoded as number)
        religion_map = {'Hindu': 1, 'Muslim': 2, 'Christian': 3, 'Sikh': 4, 
                       'Buddhist': 5, 'Jain': 6, 'Jewish': 7, 'Other': 8}
        religion = religion_map.get(user.get('religion', ''), 0)
        features.append(religion)
        
        # 5. Location importance (state-based)
        state = user.get('state', '')
        # Major states get higher values (representing metro areas)
        state_importance = {'CA': 10, 'NY': 9, 'TX': 8, 'FL': 7, 
                           'Maharashtra': 10, 'Karnataka': 9, 'Delhi': 9}
        features.append(state_importance.get(state, 5))
        
        # 6. Profession stress (1-10)
        stress = self._get_profession_stress(user)
        features.append(stress)
        
        # 7. Languages count
        lang_count = len(user.get('languagesSpoken', []))
        features.append(lang_count)
        
        # 8. Family values (Traditional=3, Moderate=2, Liberal=1)
        values_map = {'Traditional': 3, 'Moderate': 2, 'Liberal': 1}
        values = values_map.get(user.get('familyValues', ''), 2)
        features.append(values)
        
        # 9. Eating preference (Veg=1, Egg=2, NonVeg=3)
        eating_map = {'Vegetarian': 1, 'Eggetarian': 2, 'Non-Veg': 3}
        eating = eating_map.get(user.get('eatingPreference', ''), 2)
        features.append(eating)
        
        # 10. Gender (Male=1, Female=0)
        gender = 1 if user.get('gender') == 'Male' else 0
        features.append(gender)
        
        return np.array(features)
    
    def train_from_interactions(self, interactions: List[Dict]) -> bool:
        """
        Train ML model from user interaction data
        
        Interactions include: favorites, shortlists, messages, profile views
        Each interaction has: user1, user2, interaction_type, outcome (positive/negative)
        """
        if not interactions or len(interactions) < 10:
            logger.warning("Not enough interaction data to train ML model")
            return False
        
        try:
            X_train = []
            y_train = []
            
            for interaction in interactions:
                user1_features = self.extract_features(interaction['user1'])
                user2_features = self.extract_features(interaction['user2'])
                
                # Combine features (concatenate + difference + product)
                combined = np.concatenate([
                    user1_features,
                    user2_features,
                    np.abs(user1_features - user2_features),  # Difference
                    user1_features * user2_features  # Element-wise product
                ])
                
                X_train.append(combined)
                
                # Outcome score (0-1)
                outcome = interaction.get('outcome', 0.5)
                y_train.append(outcome)
            
            X_train = np.array(X_train)
            y_train = np.array(y_train)
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X_train)
            
            # Train Random Forest
            self.rf_model.fit(X_scaled, y_train)
            
            # Train clustering
            self.kmeans.fit(X_scaled)
            
            self.is_trained = True
            logger.info(f"✅ ML model trained on {len(interactions)} interactions")
            return True
            
        except Exception as e:
            logger.error(f"Error training ML model: {e}")
            return False
    
    def predict_compatibility(self, user1: Dict, user2: Dict) -> float:
        """
        Predict compatibility using trained ML model
        Returns score 0-1
        """
        if not self.is_trained:
            logger.warning("ML model not trained, using rule-based scoring")
            return 0.5  # Neutral
        
        try:
            user1_features = self.extract_features(user1)
            user2_features = self.extract_features(user2)
            
            # Combine features
            combined = np.concatenate([
                user1_features,
                user2_features,
                np.abs(user1_features - user2_features),
                user1_features * user2_features
            ])
            
            # Scale
            combined_scaled = self.scaler.transform([combined])
            
            # Predict
            prediction = self.rf_model.predict(combined_scaled)[0]
            
            # Clip to 0-1 range
            return np.clip(prediction, 0.0, 1.0)
            
        except Exception as e:
            logger.error(f"Error predicting compatibility: {e}")
            return 0.5
    
    def find_similar_profiles(self, user: Dict, all_users: List[Dict], top_k: int = 10) -> List[str]:
        """
        Find similar profiles using clustering and cosine similarity
        Returns list of usernames
        """
        try:
            # Extract feature for target user
            target_features = self.extract_features(user)
            
            # Extract features for all users
            all_features = np.array([self.extract_features(u) for u in all_users])
            
            # Calculate cosine similarity
            similarities = cosine_similarity([target_features], all_features)[0]
            
            # Get top K similar profiles (excluding self)
            similar_indices = np.argsort(similarities)[::-1][1:top_k+1]
            
            similar_usernames = [all_users[i]['username'] for i in similar_indices]
            
            return similar_usernames
            
        except Exception as e:
            logger.error(f"Error finding similar profiles: {e}")
            return []
    
    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance from trained Random Forest
        Helps understand which factors matter most
        """
        if not self.is_trained:
            return {}
        
        feature_names = [
            'Age', 'Height', 'Education', 'Religion', 'Location',
            'Profession Stress', 'Languages', 'Family Values', 
            'Eating Preference', 'Gender'
        ]
        
        importances = self.rf_model.feature_importances_[:len(feature_names)]
        
        return dict(zip(feature_names, importances.tolist()))
    
    def cluster_profiles(self, users: List[Dict]) -> Dict[str, int]:
        """
        Cluster users into groups for better matching
        Returns username -> cluster_id mapping
        """
        try:
            # Extract features
            features = np.array([self.extract_features(u) for u in users])
            
            # Scale
            features_scaled = self.scaler.fit_transform(features)
            
            # Cluster
            clusters = self.kmeans.fit_predict(features_scaled)
            
            # Map username to cluster
            cluster_map = {
                users[i]['username']: int(clusters[i])
                for i in range(len(users))
            }
            
            return cluster_map
            
        except Exception as e:
            logger.error(f"Error clustering profiles: {e}")
            return {}
    
    # Helper methods
    
    def _parse_age(self, dob: str) -> Optional[int]:
        """Parse age from date of birth"""
        if not dob:
            return None
        try:
            from datetime import datetime
            dob_date = datetime.strptime(dob, '%Y-%m-%d')
            today = datetime.today()
            age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            return age
        except:
            return None
    
    def _parse_height(self, height_str: str) -> Optional[float]:
        """Parse height to inches"""
        if not height_str:
            return None
        try:
            import re
            if '"' in height_str or "'" in height_str:
                match = re.search(r"(\d+)'(\d+)", height_str)
                if match:
                    feet = int(match.group(1))
                    inches = int(match.group(2))
                    return feet * 12 + inches
        except:
            pass
        return None
    
    def _education_to_number(self, user: Dict) -> int:
        """Convert education to numeric level"""
        edu_levels = {'High School': 1, 'Diploma': 2, 'Bachelor': 3, 'BS': 3,
                     'Master': 4, 'MS': 4, 'MBA': 4, 'PhD': 5, 'MD': 5}
        
        edu_history = user.get('educationHistory', [])
        if edu_history:
            highest = max((edu_levels.get(e.get('degree', ''), 0) for e in edu_history), default=3)
            return highest
        
        edu = user.get('education', '')
        for key, level in edu_levels.items():
            if key.lower() in edu.lower():
                return level
        return 3  # Default Bachelor's
    
    def _get_profession_stress(self, user: Dict) -> int:
        """Get profession stress level"""
        stress_map = {
            'doctor': 9, 'lawyer': 8, 'teacher': 6, 'nurse': 8,
            'engineer': 6, 'software': 7, 'manager': 7, 'finance': 7,
            'business': 6, 'consultant': 7, 'police': 9, 'military': 9
        }
        
        work_exp = user.get('workExperience', [])
        if work_exp:
            title = work_exp[0].get('title', '').lower()
            for key, stress in stress_map.items():
                if key in title:
                    return stress
        return 5  # Default


# Global instance
ml_enhancer = L3V3LMLEnhancer()
