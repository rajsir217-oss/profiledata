#!/usr/bin/env python3
"""
Generate 100 test profiles for dating app
50 Male + 50 Female profiles with realistic data
"""

import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import bcrypt

# Password hashing
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

# Sample data for realistic profiles
FIRST_NAMES_MALE = [
    "Raj", "Amit", "Arjun", "Rohan", "Karan", "Vikram", "Aditya", "Sanjay", "Rahul", "Nikhil",
    "Prateek", "Varun", "Ankit", "Vishal", "Deepak", "Suresh", "Mahesh", "Ramesh", "Ajay", "Vijay",
    "Ravi", "Krishna", "Shyam", "Mohan", "Gopal", "Hari", "Ashok", "Dinesh", "Ganesh", "Prakash",
    "Siddharth", "Abhishek", "Akash", "Aman", "Harsh", "Kunal", "Manish", "Naveen", "Pankaj", "Rajesh",
    "Sachin", "Sandeep", "Tarun", "Uday", "Vivek", "Yash", "Arun", "Bharat", "Chetan", "Dev"
]

FIRST_NAMES_FEMALE = [
    "Priya", "Anjali", "Neha", "Pooja", "Kavita", "Sneha", "Ritu", "Meera", "Sonia", "Divya",
    "Anita", "Geeta", "Sunita", "Rekha", "Nisha", "Asha", "Maya", "Radha", "Savita", "Usha",
    "Deepa", "Lata", "Mala", "Naina", "Poonam", "Rani", "Seema", "Tara", "Vandana", "Zara",
    "Aditi", "Bhavna", "Chitra", "Diya", "Esha", "Falguni", "Garima", "Hema", "Isha", "Jaya",
    "Kiran", "Leela", "Manisha", "Namita", "Pallavi", "Riya", "Shreya", "Tanvi", "Varsha", "Yamini"
]

LAST_NAMES = [
    "Sharma", "Verma", "Kumar", "Singh", "Patel", "Gupta", "Reddy", "Iyer", "Nair", "Menon",
    "Shah", "Mehta", "Joshi", "Desai", "Rao", "Pillai", "Agarwal", "Bansal", "Chopra", "Malhotra",
    "Kapoor", "Khanna", "Bhatia", "Sethi", "Arora", "Sinha", "Mishra", "Pandey", "Tiwari", "Dubey",
    "Saxena", "Jain", "Agrawal", "Mittal", "Goel", "Singhal", "Goyal", "Jindal", "Bhandari", "Chawla",
    "Dutta", "Ghosh", "Mukherjee", "Chatterjee", "Banerjee", "Das", "Roy", "Sen", "Bose", "Ganguly"
]

CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad",
    "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Visakhapatnam", "Patna",
    "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot",
    "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad"
]

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain"]

CASTES = ["Brahmin", "Kshatriya", "Vaishya", "Shudra", "Any", "No Preference"]

EATING_PREFERENCES = ["Vegetarian", "Eggetarian", "Non-Veg"]

EDUCATIONS = [
    "B.Tech in Computer Science", "MBA from IIM", "M.Tech in Engineering", "B.Com", "M.Com",
    "BBA", "MCA", "B.Sc in Physics", "M.Sc in Chemistry", "MBBS", "MD", "CA", "CS",
    "B.A. in Economics", "M.A. in English", "Ph.D. in Mathematics", "B.E. in Mechanical",
    "Diploma in Engineering", "B.Pharm", "M.Pharm"
]

OCCUPATIONS = [
    "Software Engineer", "Data Scientist", "Product Manager", "Business Analyst", "Consultant",
    "Doctor", "Chartered Accountant", "Lawyer", "Teacher", "Professor", "Architect", "Designer",
    "Marketing Manager", "Sales Executive", "HR Manager", "Financial Analyst", "Civil Engineer",
    "Mechanical Engineer", "Pharmacist", "Nurse", "Entrepreneur", "Banker", "Government Officer"
]

WORKPLACES = [
    "Google India", "Microsoft", "Amazon", "TCS", "Infosys", "Wipro", "Accenture", "Cognizant",
    "IBM", "Oracle", "SAP", "Adobe", "Flipkart", "Paytm", "Ola", "Uber", "HDFC Bank", "ICICI Bank",
    "SBI", "Reliance Industries", "Tata Consultancy", "HCL Technologies", "Tech Mahindra", "Capgemini"
]

INTERESTS = [
    "Reading, Traveling, Cooking", "Music, Dancing, Yoga", "Sports, Fitness, Hiking",
    "Photography, Art, Painting", "Movies, Netflix, Gaming", "Cooking, Baking, Food",
    "Traveling, Adventure, Trekking", "Reading, Writing, Blogging", "Music, Guitar, Singing",
    "Yoga, Meditation, Spirituality", "Cricket, Football, Sports", "Technology, Coding, AI",
    "Fashion, Shopping, Styling", "Gardening, Nature, Plants", "Volunteering, Social Work"
]

LANGUAGES = [
    "Hindi, English", "Hindi, English, Tamil", "Hindi, English, Telugu", "Hindi, English, Marathi",
    "Hindi, English, Bengali", "Hindi, English, Gujarati", "Hindi, English, Kannada",
    "Hindi, English, Malayalam", "Hindi, English, Punjabi", "English, Hindi, Urdu"
]

BIOS = [
    "Looking for a life partner who shares similar values and interests.",
    "Simple person with big dreams. Family-oriented and career-focused.",
    "Love to travel and explore new places. Seeking a companion for life's journey.",
    "Foodie, traveler, and book lover. Looking for someone genuine.",
    "Believe in traditional values with a modern outlook.",
    "Passionate about my career and family. Seeking a balanced partner.",
    "Fun-loving, adventurous, and down-to-earth person.",
    "Looking for someone who values honesty and communication.",
    "Family is everything to me. Seeking a caring life partner.",
    "Ambitious professional looking for a supportive partner."
]

RELATIONSHIP_STATUS = ["Single", "Divorced", "Widowed"]
LOOKING_FOR = ["Marriage", "Serious Relationship"]
DRINKING = ["Never", "Socially", "Prefer not to say"]
SMOKING = ["Never", "Socially", "Prefer not to say"]
BODY_TYPES = ["Slim", "Athletic", "Average", "Curvy"]
INCOME_RANGES = ["$50k - $75k", "$75k - $100k", "$100k - $150k", "Over $150k"]
HAS_CHILDREN = ["No", "Yes", "Prefer not to say"]
WANTS_CHILDREN = ["Yes", "No", "Maybe"]
PETS = ["None", "Dog", "Cat", "Other"]

def generate_height(gender):
    """Generate realistic height based on gender"""
    if gender == "Male":
        feet = random.choice([5, 6])
        inches = random.randint(6, 11) if feet == 5 else random.randint(0, 3)
    else:
        feet = 5
        inches = random.randint(2, 8)
    return f"{feet}'{inches}\""

def generate_dob():
    """Generate DOB for age between 22-45"""
    years_ago = random.randint(22, 45)
    dob = datetime.now() - timedelta(days=years_ago * 365 + random.randint(0, 365))
    return dob.strftime("%Y-%m-%d")

def generate_phone():
    """Generate Indian phone number"""
    return f"+91-{random.randint(70000, 99999)}-{random.randint(10000, 99999)}"

def generate_profile(index, gender):
    """Generate a single profile"""
    
    first_name = random.choice(FIRST_NAMES_MALE if gender == "Male" else FIRST_NAMES_FEMALE)
    last_name = random.choice(LAST_NAMES)
    username = f"{first_name.lower()}{last_name.lower()}{index}"
    
    # Generate timestamps
    days_ago = random.randint(1, 365)
    created_at = datetime.now() - timedelta(days=days_ago)
    updated_at = created_at + timedelta(days=random.randint(0, days_ago))
    
    profile = {
        "username": username,
        "password": hash_password("password123"),  # Default password for all test users
        "firstName": first_name,
        "lastName": last_name,
        "contactNumber": generate_phone(),
        "contactEmail": f"{username}@example.com",
        "dob": generate_dob(),
        "gender": gender,
        "height": generate_height(gender),
        "castePreference": random.choice(CASTES),
        "eatingPreference": random.choice(EATING_PREFERENCES),
        "location": f"{random.choice(CITIES)}, India",
        "education": random.choice(EDUCATIONS),
        "workingStatus": "Yes",
        "workplace": random.choice(WORKPLACES),
        "citizenshipStatus": random.choice(["Citizen", "Greencard"]),
        "familyBackground": f"Loving family from {random.choice(CITIES)}. {random.choice(['Nuclear family', 'Joint family'])} with {random.choice(['2', '3', '4'])} members.",
        "aboutYou": f"I am a {random.choice(OCCUPATIONS).lower()} based in {random.choice(CITIES)}. I enjoy {random.choice(INTERESTS).lower()}.",
        "partnerPreference": f"Looking for someone who is {random.choice(['caring', 'understanding', 'family-oriented', 'ambitious', 'honest'])} and {random.choice(['educated', 'well-settled', 'traditional', 'modern', 'balanced'])}.",
        
        # Dating-app specific fields
        "relationshipStatus": random.choice(RELATIONSHIP_STATUS),
        "lookingFor": random.choice(LOOKING_FOR),
        "interests": random.choice(INTERESTS),
        "languages": random.choice(LANGUAGES),
        "drinking": random.choice(DRINKING),
        "smoking": random.choice(SMOKING),
        "religion": random.choice(RELIGIONS),
        "bodyType": random.choice(BODY_TYPES),
        "occupation": random.choice(OCCUPATIONS),
        "incomeRange": random.choice(INCOME_RANGES),
        "hasChildren": random.choice(HAS_CHILDREN),
        "wantsChildren": random.choice(WANTS_CHILDREN),
        "pets": random.choice(PETS),
        "bio": random.choice(BIOS),
        
        "images": [],  # No images for test data
        "createdAt": created_at.isoformat(),
        "updatedAt": updated_at.isoformat(),
        
        # Messaging stats
        "messagesSent": random.randint(0, 50),
        "messagesReceived": random.randint(0, 50),
        "pendingReplies": random.randint(0, 10)
    }
    
    return profile

async def generate_and_insert_profiles():
    """Generate and insert 100 profiles into MongoDB"""
    
    print("🚀 Starting profile generation...")
    print(f"📊 Target: 100 profiles (50 Male + 50 Female)")
    print(f"🔗 Connecting to MongoDB: {MONGO_URL}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Check if collection exists and has data
        count = await db.users.count_documents({})
        print(f"📋 Current profiles in database: {count}")
        
        profiles = []
        
        # Generate 50 male profiles
        print("\n👨 Generating 50 male profiles...")
        for i in range(1, 51):
            profile = generate_profile(i, "Male")
            profiles.append(profile)
            if i % 10 == 0:
                print(f"   ✓ Generated {i} male profiles")
        
        # Generate 50 female profiles
        print("\n👩 Generating 50 female profiles...")
        for i in range(1, 51):
            profile = generate_profile(i, "Female")
            profiles.append(profile)
            if i % 10 == 0:
                print(f"   ✓ Generated {i} female profiles")
        
        # Insert all profiles
        print(f"\n💾 Inserting {len(profiles)} profiles into database...")
        result = await db.users.insert_many(profiles)
        
        print(f"\n✅ SUCCESS! Inserted {len(result.inserted_ids)} profiles")
        
        # Show statistics
        total_count = await db.users.count_documents({})
        male_count = await db.users.count_documents({"gender": "Male"})
        female_count = await db.users.count_documents({"gender": "Female"})
        
        print(f"\n📊 Database Statistics:")
        print(f"   Total profiles: {total_count}")
        print(f"   Male profiles: {male_count}")
        print(f"   Female profiles: {female_count}")
        
        print(f"\n🔑 Test Login Credentials:")
        print(f"   Username: Any username from generated profiles (e.g., {profiles[0]['username']})")
        print(f"   Password: password123 (same for all test users)")
        
        print(f"\n💡 Sample usernames:")
        for i in range(5):
            print(f"   - {profiles[i]['username']}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    finally:
        client.close()
        print(f"\n🔌 Database connection closed")

if __name__ == "__main__":
    print("=" * 60)
    print("  DATING APP - TEST PROFILE GENERATOR")
    print("=" * 60)
    asyncio.run(generate_and_insert_profiles())
    print("=" * 60)
    print("✨ Profile generation complete!")
    print("=" * 60)
