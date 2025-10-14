#!/usr/bin/env python3
"""
Generate 200 high-quality test profiles for matrimonial/dating app
100 Male + 100 Female profiles with realistic, diverse data
Designed for L3V3L matching algorithm testing
"""

import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import bcrypt
import os

# Password hashing
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

# Profile images
PROFILE_IMAGES = [
    "/uploads/profile1.jpg",
    "/uploads/profile2.jpg",
    "/uploads/profile3.jpg",
    "/uploads/profile4.jpg",
    "/uploads/profile5.jpg"
]

# Extended sample data for 200 profiles
FIRST_NAMES_MALE = [
    # Modern names
    "Aarav", "Arjun", "Aditya", "Arnav", "Aryan", "Ayaan", "Dev", "Dhruv", "Harsh", "Ishaan",
    "Kabir", "Karan", "Krishna", "Lakshya", "Manav", "Mihir", "Neil", "Om", "Pranav", "Raghav",
    "Raj", "Rohan", "Rudra", "Rishi", "Sahil", "Shaurya", "Shivansh", "Siddharth", "Tanishq", "Vihaan",
    # Traditional names
    "Abhishek", "Amit", "Ankit", "Ashok", "Bharat", "Chetan", "Deepak", "Dinesh", "Ganesh", "Gopal",
    "Harish", "Jatin", "Kailash", "Kumar", "Mahesh", "Mohan", "Naveen", "Pankaj", "Prakash", "Prateek",
    "Rajesh", "Ramesh", "Ravi", "Sachin", "Sandeep", "Sanjay", "Suresh", "Tarun", "Uday", "Varun",
    "Vijay", "Vikram", "Vinod", "Vishal", "Vivek", "Yash", "Yogesh", "Aakash", "Gaurav", "Himanshu",
    # Professional names
    "Adrian", "Akshay", "Aman", "Anirudh", "Anuj", "Ashish", "Chirag", "Darshan", "Hitesh", "Jaidev",
    "Kartik", "Kushal", "Lokesh", "Madhav", "Nakul", "Nikhil", "Parth", "Piyush", "Rahul", "Ritesh",
    "Rohit", "Sameer", "Shashank", "Sumit", "Tushar", "Utkarsh", "Veer", "Yashas", "Abhay", "Amar"
]

FIRST_NAMES_FEMALE = [
    # Modern names
    "Aadhya", "Aanya", "Aditi", "Ananya", "Anjali", "Anushka", "Avani", "Diya", "Isha", "Ishita",
    "Jiya", "Kavya", "Kiara", "Myra", "Navya", "Nidhi", "Pari", "Pihu", "Prisha", "Riya",
    "Sara", "Saanvi", "Shanaya", "Siya", "Tara", "Vanya", "Zara", "Aarohi", "Anika", "Mehak",
    # Traditional names
    "Aarti", "Anjana", "Anita", "Asha", "Bhavna", "Chitra", "Deepa", "Divya", "Geeta", "Hema",
    "Indira", "Jaya", "Kiran", "Lata", "Leela", "Mala", "Maya", "Meera", "Naina", "Nisha",
    "Poonam", "Pooja", "Priya", "Radha", "Rani", "Rekha", "Ritu", "Savita", "Seema", "Sneha",
    "Sonia", "Sunita", "Tara", "Usha", "Vandana", "Varsha", "Vidya", "Yamini", "Kavita", "Neha",
    # Professional names
    "Bhumi", "Charvi", "Daksha", "Ekta", "Esha", "Falguni", "Garima", "Gunjan", "Heena", "Ishani",
    "Juhi", "Kanika", "Komal", "Lavanya", "Manisha", "Namita", "Pallavi", "Pragya", "Radhika", "Rachna",
    "Reshma", "Ritika", "Sakshi", "Shikha", "Shreya", "Simran", "Swati", "Tanvi", "Trisha", "Vrinda"
]

LAST_NAMES = [
    # North Indian
    "Sharma", "Verma", "Kumar", "Singh", "Gupta", "Agarwal", "Bansal", "Chopra", "Malhotra", "Kapoor",
    "Khanna", "Bhatia", "Sethi", "Arora", "Sinha", "Mishra", "Pandey", "Tiwari", "Dubey", "Saxena",
    "Jain", "Agrawal", "Mittal", "Goel", "Singhal", "Goyal", "Jindal", "Bhandari", "Chawla", "Kohli",
    # South Indian
    "Reddy", "Iyer", "Nair", "Menon", "Rao", "Pillai", "Krishnan", "Naidu", "Varma", "Kumar",
    "Swamy", "Sastry", "Bhat", "Shenoy", "Kamath", "Murthy", "Hegde", "Shetty", "Pai", "Kulkarni",
    # West Indian
    "Shah", "Mehta", "Joshi", "Desai", "Patel", "Parekh", "Trivedi", "Thakkar", "Bhatt", "Vora",
    # East Indian
    "Dutta", "Ghosh", "Mukherjee", "Chatterjee", "Banerjee", "Das", "Roy", "Sen", "Bose", "Ganguly",
    # Business families
    "Khandelwal", "Somani", "Bagaria", "Lunia", "Surana", "Pugalia", "Daga", "Bhansali", "Lodha", "Baheti"
]

CITIES = [
    # Tier 1 cities
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad",
    # Tier 2 cities
    "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Visakhapatnam", "Patna",
    "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot",
    "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad", "Coimbatore",
    "Chandigarh", "Mysore", "Thiruvananthapuram", "Kochi", "Madurai", "Guwahati", "Surat"
]

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"]

CASTES = ["Brahmin", "Kshatriya", "Vaishya", "Any", "No Preference", "Prefer not to say"]

EATING_PREFERENCES = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"]

EDUCATIONS = [
    # Tech
    "B.Tech in Computer Science - IIT Delhi", "M.Tech in AI/ML - IIT Bombay", "B.E. in Electronics - NIT",
    "MCA - Tier 1 College", "B.Sc Computer Science", "M.Sc Data Science",
    # Business
    "MBA from IIM Ahmedabad", "MBA Finance - XLRI", "BBA - Top Business School", "M.Com - Commerce",
    "CA (Chartered Accountant)", "CS (Company Secretary)", "CFA (Chartered Financial Analyst)",
    # Medical
    "MBBS - AIIMS", "MD Medicine", "BDS (Dental)", "B.Pharm", "M.Pharm", "BAMS (Ayurveda)",
    # Arts & Science
    "B.A. Economics - St. Stephen's", "M.A. English Literature", "Ph.D. in Mathematics",
    "B.Sc Physics", "M.Sc Chemistry", "B.A. Psychology",
    # Professional
    "LLB (Law)", "B.Arch (Architecture)", "B.Design (Fashion)", "Diploma Engineering",
    "Hotel Management", "Journalism & Mass Communication"
]

OCCUPATIONS = [
    # Tech
    "Software Engineer", "Senior Software Engineer", "Data Scientist", "ML Engineer",
    "Product Manager", "Tech Lead", "DevOps Engineer", "Full Stack Developer",
    "UI/UX Designer", "Business Analyst", "Consultant", "Cybersecurity Analyst",
    # Medical
    "Doctor (MD)", "Surgeon", "Dentist", "Pharmacist", "Nurse", "Medical Researcher",
    # Finance
    "Chartered Accountant", "Financial Analyst", "Investment Banker", "Banker", "Auditor",
    # Professional
    "Lawyer", "Civil Engineer", "Mechanical Engineer", "Architect", "Interior Designer",
    # Business
    "Entrepreneur", "Business Owner", "Marketing Manager", "Sales Director", "HR Manager",
    # Education
    "Teacher", "Professor", "Research Scholar", "Education Consultant",
    # Creative
    "Content Creator", "Graphic Designer", "Fashion Designer", "Photographer",
    # Government
    "IAS Officer", "Government Officer", "Public Sector Employee", "Defense Services"
]

WORKPLACES = [
    # Tech giants
    "Google India", "Microsoft", "Amazon", "Meta (Facebook)", "Apple", "Netflix", "Adobe",
    # Indian IT
    "TCS", "Infosys", "Wipro", "HCL Technologies", "Tech Mahindra", "Cognizant", "Accenture",
    # Startups
    "Flipkart", "Paytm", "Ola", "Swiggy", "Zomato", "PhonePe", "CRED", "Razorpay",
    # Finance
    "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Mahindra", "JP Morgan", "Goldman Sachs",
    # Consulting
    "McKinsey & Company", "BCG", "Bain & Company", "Deloitte", "PwC", "EY", "KPMG",
    # Others
    "Reliance Industries", "Tata Group", "Aditya Birla Group", "IBM", "Oracle", "SAP",
    "Government of India", "Self-Employed", "Family Business"
]

INTERESTS = [
    "Reading, Traveling, Photography", "Music, Dancing, Fitness", "Sports, Yoga, Meditation",
    "Cooking, Baking, Food Blogging", "Movies, Netflix, Gaming", "Art, Painting, Crafts",
    "Trekking, Adventure Sports, Hiking", "Writing, Blogging, Poetry", "Guitar, Singing, Music",
    "Spirituality, Meditation, Yoga", "Cricket, Football, Badminton", "Technology, Coding, AI",
    "Fashion, Styling, Shopping", "Gardening, Nature, Environment", "Volunteering, Social Work",
    "Chess, Board Games, Puzzles", "Swimming, Cycling, Running", "Theater, Drama, Acting",
    "Astronomy, Science, Learning", "Economics, Politics, Current Affairs"
]

LANGUAGES = [
    "Hindi, English", "Hindi, English, Tamil", "Hindi, English, Telugu", "Hindi, English, Marathi",
    "Hindi, English, Bengali", "Hindi, English, Gujarati", "Hindi, English, Kannada",
    "Hindi, English, Malayalam", "Hindi, English, Punjabi", "English, Hindi, Urdu",
    "English, Tamil, Hindi", "English, Telugu, Hindi", "English, Marathi, Hindi"
]

# L3V3L-inspired bios with personality
BIOS_MALE = [
    "Fun-loving, adventurous, and down-to-earth person looking for my partner in crime.",
    "Software engineer by day, foodie by night. Looking for someone who appreciates both good code and good food!",
    "Believe in traditional values with a modern outlook. Family means everything to me.",
    "Passionate about fitness, travel, and personal growth. Seeking someone who shares similar values.",
    "Simple guy with big dreams. Looking for someone genuine to build a beautiful life together.",
    "Love to travel and explore new cultures. Seeking a companion for life's adventures.",
    "Ambitious professional who values work-life balance. Family-oriented and looking for the same.",
    "Honest, loyal, and love to laugh. Looking for someone who brings out the best in me.",
    "Spiritual person who believes in karma and kindness. Seeking a soulmate who shares similar beliefs.",
    "Entrepreneur with a passion for innovation. Looking for a supportive and understanding partner."
]

BIOS_FEMALE = [
    "Fun-loving, caring soul who loves to cook, travel, and create beautiful memories.",
    "Independent woman seeking a partner who respects my ambitions and shares my values.",
    "Believe in love, loyalty, and laughter. Looking for someone who can be my best friend and life partner.",
    "Simple girl with simple dreams. Family is my priority and I'm looking for someone similar.",
    "Foodie, bookworm, and adventure seeker. Looking for someone genuine and emotionally mature.",
    "Passionate about my career and family. Seeking a balanced partner who understands both.",
    "Traditional at heart but modern in outlook. Looking for a caring and supportive life partner.",
    "Love to explore new places and cuisines. Seeking a travel buddy and life companion.",
    "Spiritual, grounded, and family-oriented. Looking for someone who values authenticity.",
    "Creative soul with a love for art and culture. Seeking someone who appreciates the finer things in life."
]

RELATIONSHIP_STATUS = ["Single", "Divorced", "Widowed", "Never Married"]
LOOKING_FOR = ["Marriage", "Serious Relationship", "Life Partner"]
DRINKING = ["Never", "Socially", "Occasionally", "Prefer not to say"]
SMOKING = ["Never", "Socially", "Prefer not to say"]
BODY_TYPES = ["Slim", "Athletic", "Average", "Fit", "Curvy", "Plus-size"]
INCOME_RANGES = ["$30k - $50k", "$50k - $75k", "$75k - $100k", "$100k - $150k", "Over $150k", "Prefer not to say"]
HAS_CHILDREN = ["No", "Yes (1)", "Yes (2+)", "Prefer not to say"]
WANTS_CHILDREN = ["Yes", "No", "Maybe", "Open to discussion"]
PETS = ["None", "Dog Lover", "Cat Lover", "Have Pets", "Love Animals"]

def generate_height(gender):
    """Generate realistic height based on gender"""
    if gender == "Male":
        feet = random.choice([5, 5, 6, 6, 6])  # Weighted towards 5'8"-6'2"
        inches = random.randint(7, 11) if feet == 5 else random.randint(0, 4)
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
    """Generate a single high-quality profile"""
    
    first_name = random.choice(FIRST_NAMES_MALE if gender == "Male" else FIRST_NAMES_FEMALE)
    last_name = random.choice(LAST_NAMES)
    username = f"{first_name.lower()}{last_name.lower()}{str(index).zfill(3)}"
    
    # Generate timestamps
    days_ago = random.randint(1, 730)  # Up to 2 years old profiles
    created_at = datetime.now() - timedelta(days=days_ago)
    updated_at = created_at + timedelta(days=random.randint(0, min(days_ago, 30)))
    
    # Generate random profile images (1-3 images per profile)
    num_images = random.randint(1, 3)
    profile_images = random.sample(PROFILE_IMAGES, num_images)
    
    city = random.choice(CITIES)
    occupation = random.choice(OCCUPATIONS)
    
    profile = {
        "username": username,
        "password": hash_password("Test@123"),  # Stronger password
        "firstName": first_name,
        "lastName": last_name,
        "contactNumber": generate_phone(),
        "contactEmail": f"{username}@example.com",
        "dob": generate_dob(),
        "gender": gender,
        "height": generate_height(gender),
        "castePreference": random.choice(CASTES),
        "eatingPreference": random.choice(EATING_PREFERENCES),
        "location": f"{city}, India",
        "education": random.choice(EDUCATIONS),
        "workingStatus": "Yes" if random.random() > 0.1 else "Student",
        "workplace": random.choice(WORKPLACES),
        "citizenshipStatus": random.choice(["Citizen", "Greencard", "Work Visa"]),
        
        "familyBackground": f"Loving {'joint' if random.random() > 0.6 else 'nuclear'} family from {city}. Father is {random.choice(['retired', 'businessman', 'government employee'])} and mother is {random.choice(['homemaker', 'teacher', 'working professional'])}. {'Have siblings' if random.random() > 0.3 else 'Only child'}.",
        
        "aboutYou": f"I am a {occupation.lower()} based in {city}. {random.choice(BIOS_MALE if gender == 'Male' else BIOS_FEMALE)}",
        
        "partnerPreference": f"Looking for someone who is {random.choice(['caring and understanding', 'family-oriented and ambitious', 'honest and loyal', 'supportive and emotionally mature', 'fun-loving and genuine'])}. Education and values are important to me.",
        
        # Dating-app specific fields
        "relationshipStatus": random.choice(RELATIONSHIP_STATUS),
        "lookingFor": random.choice(LOOKING_FOR),
        "interests": random.choice(INTERESTS),
        "languages": random.choice(LANGUAGES),
        "drinking": random.choice(DRINKING),
        "smoking": random.choice(SMOKING),
        "religion": random.choice(RELIGIONS),
        "bodyType": random.choice(BODY_TYPES),
        "occupation": occupation,
        "incomeRange": random.choice(INCOME_RANGES),
        "hasChildren": random.choice(HAS_CHILDREN),
        "wantsChildren": random.choice(WANTS_CHILDREN),
        "pets": random.choice(PETS),
        "bio": random.choice(BIOS_MALE if gender == "Male" else BIOS_FEMALE),
        
        "images": profile_images,
        "profileImage": profile_images[0],  # First image as profile picture
        "createdAt": created_at.isoformat(),
        "updatedAt": updated_at.isoformat(),
        
        # User status (for new status system)
        "status": {
            "status": "active",
            "reason": "Test account",
            "updatedAt": datetime.utcnow().isoformat(),
            "updatedBy": "system_test_generation"
        },
        
        # Activity stats
        "messagesSent": random.randint(0, 100),
        "messagesReceived": random.randint(0, 100),
        "pendingReplies": random.randint(0, 15),
        "profileViews": random.randint(0, 200),
        "lastActive": (datetime.now() - timedelta(days=random.randint(0, 7))).isoformat()
    }
    
    return profile

async def generate_and_insert_profiles():
    """Generate and insert 200 high-quality profiles into MongoDB"""
    
    print("🚀 Starting profile generation...")
    print("📊 Target: 200 profiles (100 Male + 100 Female)")
    print(f"🔗 Connecting to MongoDB: {MONGO_URL}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Check current state
        count = await db.users.count_documents({})
        print(f"📋 Current profiles in database: {count}")
        
        profiles = []
        
        # Generate 100 male profiles
        print("\n👨 Generating 100 male profiles...")
        for i in range(1, 101):
            profile = generate_profile(i, "Male")
            profiles.append(profile)
            if i % 20 == 0:
                print(f"   ✓ Generated {i} male profiles")
        
        # Generate 100 female profiles
        print("\n👩 Generating 100 female profiles...")
        for i in range(1, 101):
            profile = generate_profile(i, "Female")
            profiles.append(profile)
            if i % 20 == 0:
                print(f"   ✓ Generated {i} female profiles")
        
        # Insert all profiles
        print(f"\n💾 Inserting {len(profiles)} profiles into database...")
        result = await db.users.insert_many(profiles)
        
        print(f"\n✅ SUCCESS! Inserted {len(result.inserted_ids)} new profiles")
        
        # Show statistics
        total_count = await db.users.count_documents({})
        male_count = await db.users.count_documents({"gender": "Male"})
        female_count = await db.users.count_documents({"gender": "Female"})
        profiles_with_images = await db.users.count_documents({"images": {"$exists": True, "$ne": []}})
        active_profiles = await db.users.count_documents({"status.status": "active"})
        
        print(f"\n📊 Database Statistics:")
        print(f"   Total profiles: {total_count}")
        print(f"   Male profiles: {male_count}")
        print(f"   Female profiles: {female_count}")
        print(f"   Profiles with images: {profiles_with_images}")
        print(f"   Active profiles: {active_profiles}")
        
        print(f"\n🔑 Test Login Credentials:")
        print(f"   Password for ALL test accounts: Test@123")
        
        print(f"\n💡 Sample usernames:")
        sample_males = [p['username'] for p in profiles if p['gender'] == 'Male'][:5]
        sample_females = [p['username'] for p in profiles if p['gender'] == 'Female'][:5]
        print(f"\n   Male:")
        for u in sample_males:
            print(f"   - {u}")
        print(f"\n   Female:")
        for u in sample_females:
            print(f"   - {u}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        client.close()
        print(f"\n🔌 Database connection closed")

if __name__ == "__main__":
    print("=" * 70)
    print("  MATRIMONIAL APP - ENHANCED TEST PROFILE GENERATOR")
    print("  200 High-Quality Profiles (100 Male + 100 Female)")
    print("=" * 70)
    asyncio.run(generate_and_insert_profiles())
    print("=" * 70)
    print("✨ Profile generation complete!")
    print("🎯 Ready for L3V3L matching algorithm testing")
    print("=" * 70)
