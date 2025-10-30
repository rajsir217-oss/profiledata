"""
Realistic User Data Generator for L3V3L Match Algorithm
Generates 50 male + 50 female users with complete profiles
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict
import string

# USA Cities with regions
USA_CITIES = [
    {"city": "New York, NY", "region": "Northeast"},
    {"city": "Los Angeles, CA", "region": "West Coast"},
    {"city": "Chicago, IL", "region": "Midwest"},
    {"city": "Houston, TX", "region": "South"},
    {"city": "Phoenix, AZ", "region": "Southwest"},
    {"city": "Philadelphia, PA", "region": "Northeast"},
    {"city": "San Antonio, TX", "region": "South"},
    {"city": "San Diego, CA", "region": "West Coast"},
    {"city": "Dallas, TX", "region": "South"},
    {"city": "San Jose, CA", "region": "West Coast"},
    {"city": "Austin, TX", "region": "South"},
    {"city": "Jacksonville, FL", "region": "Southeast"},
    {"city": "Fort Worth, TX", "region": "South"},
    {"city": "Columbus, OH", "region": "Midwest"},
    {"city": "Charlotte, NC", "region": "Southeast"},
    {"city": "San Francisco, CA", "region": "West Coast"},
    {"city": "Indianapolis, IN", "region": "Midwest"},
    {"city": "Seattle, WA", "region": "Pacific Northwest"},
    {"city": "Denver, CO", "region": "Mountain West"},
    {"city": "Boston, MA", "region": "Northeast"},
    {"city": "Portland, OR", "region": "Pacific Northwest"},
    {"city": "Nashville, TN", "region": "South"},
    {"city": "Atlanta, GA", "region": "Southeast"},
    {"city": "Miami, FL", "region": "Southeast"},
    {"city": "Minneapolis, MN", "region": "Midwest"}
]

# Indian-American Names
MALE_FIRST_NAMES = [
    "Arjun", "Rohan", "Aditya", "Rahul", "Karan", "Vikram", "Nikhil", "Amit",
    "Sanjay", "Ravi", "Prateek", "Ankit", "Varun", "Kunal", "Siddharth", "Akash",
    "Manish", "Vishal", "Gaurav", "Abhishek", "Deepak", "Rajesh", "Sandeep", "Ajay",
    "Dev", "Jay", "Neil", "Aman", "Harsh", "Yash", "Aryan", "Ishaan",
    "Kabir", "Advait", "Vihaan", "Reyansh", "Aarav", "Ayaan", "Krishna", "Shiv"
]

FEMALE_FIRST_NAMES = [
    "Priya", "Anjali", "Neha", "Pooja", "Shreya", "Kavya", "Riya", "Ananya",
    "Sneha", "Divya", "Preeti", "Nisha", "Simran", "Ritu", "Megha", "Sonal",
    "Ritika", "Aditi", "Mansi", "Tanvi", "Isha", "Anika", "Diya", "Maya",
    "Aarohi", "Kiara", "Sara", "Avni", "Ira", "Zara", "Myra", "Saanvi",
    "Pari", "Shanaya", "Navya", "Siya", "Anvi", "Ahana", "Tara", "Naina"
]

LAST_NAMES = [
    "Sharma", "Patel", "Kumar", "Singh", "Reddy", "Gupta", "Jain", "Agarwal",
    "Mehta", "Shah", "Kapoor", "Malhotra", "Khanna", "Iyer", "Nair", "Pillai",
    "Rao", "Menon", "Bhat", "Desai", "Kulkarni", "Joshi", "Thakkar", "Banerjee",
    "Chatterjee", "Mukherjee", "Das", "Roy", "Sen", "Ghosh", "Chopra", "Sethi",
    "Verma", "Sinha", "Tiwari", "Mishra", "Pandey", "Dubey", "Saxena", "Arora"
]

OCCUPATIONS = [
    "Software Engineer", "Data Scientist", "Product Manager", "Business Analyst",
    "Marketing Manager", "Financial Analyst", "Consultant", "Doctor", "Dentist",
    "Pharmacist", "Teacher", "Professor", "Lawyer", "Architect", "Designer",
    "Entrepreneur", "Sales Manager", "HR Manager", "Project Manager", "Engineer",
    "Research Scientist", "UX Designer", "Content Writer", "Journalist", "Accountant"
]

INTERESTS = [
    "Reading", "Traveling", "Cooking", "Photography", "Yoga", "Meditation",
    "Hiking", "Running", "Gym", "Swimming", "Dancing", "Music", "Movies",
    "Art", "Painting", "Writing", "Blogging", "Gaming", "Tech", "Science",
    "Food", "Wine Tasting", "Coffee", "Theater", "Concerts", "Museums",
    "Nature", "Camping", "Biking", "Tennis", "Golf", "Volunteering",
    "Languages", "Culture", "History", "Philosophy", "Psychology", "Spirituality"
]

EDUCATION_LEVELS = [
    "Bachelor's Degree", "Master's Degree", "MBA", "PhD", "Medical Degree",
    "Engineering Degree", "Computer Science Degree", "Business Degree"
]

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other", "Spiritual"]
RELATIONSHIP_STATUS = ["Single", "Never Married"]
LOOKING_FOR = ["Serious Relationship", "Marriage", "Life Partner"]
BODY_TYPES = ["Athletic", "Slim", "Average", "Fit", "Curvy"]
DRINKING = ["Never", "Socially", "Occasionally", "Regularly"]
SMOKING = ["Never", "Occasionally", "Trying to quit"]
CHILDREN = ["No", "Someday", "Want Children"]

def generate_unique_profile_id() -> str:
    """Generate 8-char alphanumeric profileId"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=8))

def generate_date_of_birth(age: int) -> str:
    """Generate date of birth for given age"""
    today = datetime.now()
    birth_year = today.year - age
    birth_month = random.randint(1, 12)
    birth_day = random.randint(1, 28)  # Safe for all months
    return f"{birth_year}-{birth_month:02d}-{birth_day:02d}"

def generate_bio(name: str, age: int, occupation: str, interests: List[str], gender: str) -> str:
    """Generate realistic bio"""
    templates = [
        f"Hi! I'm {name}, a {age}-year-old {occupation}. I love {interests[0].lower()}, {interests[1].lower()}, and {interests[2].lower()}. Looking for someone genuine and down-to-earth.",
        f"{occupation} by day, {interests[0].lower()} enthusiast by night. I enjoy {interests[1].lower()} and exploring new {interests[2].lower()}. Let's connect!",
        f"Life is about balance - I work hard as a {occupation} and love to unwind with {interests[0].lower()} and {interests[1].lower()}. Seeking a meaningful connection.",
        f"Passionate about {interests[0].lower()}, {interests[1].lower()}, and {interests[2].lower()}. {occupation} who values honesty, humor, and good conversation.",
        f"{age} years young and loving life! {occupation} with a passion for {interests[0].lower()} and {interests[1].lower()}. Looking for someone to share adventures with."
    ]
    return random.choice(templates)

def generate_l3v3l_scores() -> Dict[str, int]:
    """Generate realistic L3V3L dimension scores (0-100)"""
    # Generate somewhat correlated scores (realistic personality)
    base = random.randint(60, 90)
    return {
        "love": max(0, min(100, base + random.randint(-15, 15))),
        "loyalty": max(0, min(100, base + random.randint(-15, 15))),
        "laughter": max(0, min(100, base + random.randint(-20, 20))),
        "vulnerability": max(0, min(100, base + random.randint(-25, 15))),
        "elevation": max(0, min(100, base + random.randint(-15, 20)))
    }

def generate_partner_preferences() -> Dict:
    """Generate partner preference criteria"""
    return {
        "ageMin": random.randint(22, 28),
        "ageMax": random.randint(30, 38),
        "heightMin": random.choice(["5'0\"", "5'2\"", "5'4\"", "5'6\"", "5'8\""]),
        "heightMax": random.choice(["5'8\"", "5'10\"", "6'0\"", "6'2\"", "6'4\""]),
        "educationLevel": random.choice(["Bachelor's", "Master's", "Any"]),
        "religion": random.choice(["Any", "Same as mine", "Open"]),
        "location": random.choice(["Same city", "Within 50 miles", "Same region", "Anywhere in USA"]),
        "wantsChildren": random.choice(["Yes", "Maybe", "Open"]),
        "drinking": random.choice(["Any", "Never", "Socially"]),
        "smoking": random.choice(["Never", "Any"]),
        "l3v3lScores": {
            "loveMin": random.randint(60, 75),
            "loyaltyMin": random.randint(65, 80),
            "laughterMin": random.randint(55, 70),
            "vulnerabilityMin": random.randint(50, 70),
            "elevationMin": random.randint(60, 75)
        }
    }

def generate_male_user(index: int) -> Dict:
    """Generate complete male user profile"""
    first_name = random.choice(MALE_FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    username = f"{first_name.lower()}{last_name.lower()}{index:03d}"
    age = random.randint(22, 35)
    occupation = random.choice(OCCUPATIONS)
    location_data = random.choice(USA_CITIES)
    user_interests = random.sample(INTERESTS, k=random.randint(5, 10))
    
    height_inches = random.randint(66, 76)  # 5'6" to 6'4"
    height_feet = height_inches // 12
    height_remaining = height_inches % 12
    
    return {
        "username": username,
        "profileId": generate_unique_profile_id(),
        "password": "$2b$12$Fy/3LfGivzFvUwbsacowPe9PpSTD.Scaz8TMtjP8rr7sdxKfNUQ1q",  # "password123"
        "firstName": first_name,
        "lastName": last_name,
        "gender": "Male",
        "sex": "Male",
        "dateOfBirth": generate_date_of_birth(age),
        "age": age,
        "height": f"{height_feet}'{height_remaining}\"",
        "heightInches": height_inches,
        "location": location_data["city"],
        "region": location_data["region"],
        "occupation": occupation,
        "contactEmail": f"{username}@example.com",
        "contactNumber": f"+1{random.randint(2000000000, 9999999999)}",
        "bio": generate_bio(first_name, age, occupation, user_interests, "Male"),
        "aboutYou": f"I'm a {occupation} living in {location_data['city']}. I value honesty, kindness, and good communication.",
        "interests": ", ".join(user_interests),
        "religion": random.choice(RELIGIONS),
        "relationshipStatus": random.choice(RELATIONSHIP_STATUS),
        "lookingFor": random.choice(LOOKING_FOR),
        "bodyType": random.choice(BODY_TYPES),
        "drinking": random.choice(DRINKING),
        "smoking": random.choice(SMOKING),
        "hasChildren": "No",
        "wantsChildren": random.choice(CHILDREN),
        "education": random.choice(EDUCATION_LEVELS),
        "workingStatus": "Yes",
        "citizenshipStatus": random.choice(["US Citizen", "Green Card", "Work Visa"]),
        "images": ["/uploads/default-avatar.svg"],
        "profileImage": "/uploads/default-avatar.svg",
        "l3v3lScores": generate_l3v3l_scores(),
        "partnerPreferences": generate_partner_preferences(),
        "profileCompleteness": random.randint(85, 100),
        "trustScore": random.randint(70, 95),
        "status": {"status": "active"},
        "accountStatus": "active",
        "adminApprovalStatus": "approved",
        "onboardingCompleted": True,
        "emailVerified": True,
        "phoneVerified": random.choice([True, False]),
        "createdAt": datetime.utcnow() - timedelta(days=random.randint(1, 365)),
        "updatedAt": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
        "lastActiveAt": datetime.utcnow() - timedelta(hours=random.randint(0, 48))
    }

def generate_female_user(index: int) -> Dict:
    """Generate complete female user profile"""
    first_name = random.choice(FEMALE_FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    username = f"{first_name.lower()}{last_name.lower()}{index:03d}"
    age = random.randint(22, 35)
    occupation = random.choice(OCCUPATIONS)
    location_data = random.choice(USA_CITIES)
    user_interests = random.sample(INTERESTS, k=random.randint(5, 10))
    
    height_inches = random.randint(60, 70)  # 5'0" to 5'10"
    height_feet = height_inches // 12
    height_remaining = height_inches % 12
    
    return {
        "username": username,
        "profileId": generate_unique_profile_id(),
        "password": "$2b$12$Fy/3LfGivzFvUwbsacowPe9PpSTD.Scaz8TMtjP8rr7sdxKfNUQ1q",  # "password123"
        "firstName": first_name,
        "lastName": last_name,
        "gender": "Female",
        "sex": "Female",
        "dateOfBirth": generate_date_of_birth(age),
        "age": age,
        "height": f"{height_feet}'{height_remaining}\"",
        "heightInches": height_inches,
        "location": location_data["city"],
        "region": location_data["region"],
        "occupation": occupation,
        "contactEmail": f"{username}@example.com",
        "contactNumber": f"+1{random.randint(2000000000, 9999999999)}",
        "bio": generate_bio(first_name, age, occupation, user_interests, "Female"),
        "aboutYou": f"I'm a {occupation} based in {location_data['city']}. Looking for someone who is genuine, kind, and shares similar values.",
        "interests": ", ".join(user_interests),
        "religion": random.choice(RELIGIONS),
        "relationshipStatus": random.choice(RELATIONSHIP_STATUS),
        "lookingFor": random.choice(LOOKING_FOR),
        "bodyType": random.choice(BODY_TYPES),
        "drinking": random.choice(DRINKING),
        "smoking": random.choice(SMOKING),
        "hasChildren": "No",
        "wantsChildren": random.choice(CHILDREN),
        "education": random.choice(EDUCATION_LEVELS),
        "workingStatus": "Yes",
        "citizenshipStatus": random.choice(["US Citizen", "Green Card", "Work Visa"]),
        "images": ["/uploads/default-avatar.svg"],
        "profileImage": "/uploads/default-avatar.svg",
        "l3v3lScores": generate_l3v3l_scores(),
        "partnerPreferences": generate_partner_preferences(),
        "profileCompleteness": random.randint(85, 100),
        "trustScore": random.randint(70, 95),
        "status": {"status": "active"},
        "accountStatus": "active",
        "adminApprovalStatus": "approved",
        "onboardingCompleted": True,
        "emailVerified": True,
        "phoneVerified": random.choice([True, False]),
        "createdAt": datetime.utcnow() - timedelta(days=random.randint(1, 365)),
        "updatedAt": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
        "lastActiveAt": datetime.utcnow() - timedelta(hours=random.randint(0, 48))
    }

def generate_all_users() -> List[Dict]:
    """Generate 50 male + 50 female users"""
    users = []
    
    # Generate 50 male users
    for i in range(1, 51):
        users.append(generate_male_user(i))
    
    # Generate 50 female users
    for i in range(1, 51):
        users.append(generate_female_user(i))
    
    return users
