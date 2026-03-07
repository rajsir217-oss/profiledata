"""Normalize city field: split 'Columbus, OH' -> city='Columbus', state='Ohio'. 
Run: MONGODB_URL=... ENCRYPTION_KEY=... python3 migrations/normalize_city_field.py
Or for local: cd fastapi_backend && python3 migrations/normalize_city_field.py
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv()

ST = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
"CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
"HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa",
"KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland",
"MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi",
"MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire",
"NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina",
"ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania",
"RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee",
"TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington",
"WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"DC"}

async def run():
    c = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = c['matrimonialDB']
    # Find all users where city contains a comma (i.e. "Columbus, OH")
    users = await db.users.find(
        {"city": {"$regex": ","}},
        {"username": 1, "city": 1, "state": 1}
    ).to_list(None)
    print(f"Found {len(users)} users with comma in city field")
    n = 0
    for u in users:
        city_raw = u.get("city", "")
        if ',' not in city_raw:
            continue
        parts = [p.strip() for p in city_raw.split(',', 1)]
        new_city = parts[0].title()
        st_part = parts[1].strip().upper()
        new_state = ST.get(st_part, parts[1].strip().title())
        upd = {"city": new_city}
        # Only update state if it's empty or matches what we'd derive
        cur_state = u.get("state", "")
        if not cur_state or cur_state.strip() == "":
            upd["state"] = new_state
        await db.users.update_one({"_id": u["_id"]}, {"$set": upd})
        n += 1
        print(f"  {u.get('username','?')}: '{city_raw}' -> city='{new_city}', state='{new_state}'")
    
    # Also normalize city casing (title case) for all users
    all_users = await db.users.find(
        {"city": {"$exists": True, "$ne": None}},
        {"username": 1, "city": 1}
    ).to_list(None)
    case_fixed = 0
    for u in all_users:
        city = u.get("city", "")
        if city and city != city.strip().title():
            new_city = city.strip().title()
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"city": new_city}})
            case_fixed += 1
            print(f"  Case fix: {u.get('username','?')}: '{city}' -> '{new_city}'")
    
    print(f"\nDone. Normalized {n} comma entries, {case_fixed} case fixes.")
    c.close()

asyncio.run(run())
