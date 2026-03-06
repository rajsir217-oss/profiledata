"""Populate city/state from encrypted location."""
import asyncio,os,sys
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from crypto_utils import get_encryptor
load_dotenv()

ST={"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"DC"}

def parse(loc):
    if not loc: return None,None
    loc=loc.strip()
    if ',' in loc:
        p=[x.strip() for x in loc.split(',',1)]
        return p[0].title(), ST.get(p[1].strip().upper(), p[1].strip().title())
    return loc.title(), None

async def run():
    c=AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db=c['matrimonialDB']
    enc=get_encryptor()
    users=await db.users.find({},{"username":1,"location":1,"city":1,"state":1}).to_list(None)
    n=0
    for u in users:
        loc=u.get("location","")
        if loc and loc.startswith("gAAAAA"):
            try: loc=enc.decrypt(loc)
            except: continue
        if not loc: continue
        city,state=parse(loc)
        upd={}
        if city: upd["city"]=city
        if state: upd["state"]=state
        if upd:
            await db.users.update_one({"_id":u["_id"]},{"$set":upd})
            n+=1
            print(f"  {u.get('username','?')}: {loc} -> city={city}, state={state}")
    print(f"\nDone. Updated {n}/{len(users)} users.")
    c.close()

asyncio.run(run())
