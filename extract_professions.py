#!/usr/bin/env python3
"""
Extract all professions from production MongoDB database
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load production environment
load_dotenv('fastapi_backend/.env.production')

async def extract_professions():
    """Connect to production DB and extract all professions"""
    
    # Get MongoDB URL from production env
    mongodb_url = os.getenv('MONGODB_URL')
    database_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    
    if not mongodb_url:
        print("❌ MONGODB_URL not found in .env.production")
        return
    
    print(f"🔗 Connecting to MongoDB: {database_name}")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongodb_url)
        db = client[database_name]
        
        # Test connection
        await client.server_info()
        print("✅ Connected to production MongoDB")
        
        # Aggregation pipeline to extract professions with grouping
        pipeline = [
            {'$match': {'accountStatus': 'active'}},
            {'$addFields': {
                # Extract profession using same logic as admin reports
                'profession': {
                    '$let': {
                        'vars': {
                            'workPosition': {
                                '$arrayElemAt': [
                                    {'$filter': {
                                        'input': {'$ifNull': ['$workExperience', []]},
                                        'as': 'work',
                                        'cond': {'$ne': ['$$work.position', '']}
                                    }},
                                    0
                                ]
                            }
                        },
                        'in': {
                            '$ifNull': [
                                '$$workPosition.position',
                                '$$workPosition.description',
                                '$$workPosition.company',
                                '$occupation',
                                'Unknown'
                            ]
                        }
                    }
                }
            }},
            {'$match': {'profession': {'$ne': None, '$ne': '', '$ne': 'Unknown'}}},
            {'$addFields': {
                # Add profession grouping based on keywords and patterns
                'professionGroup': {
                    '$switch': {
                        'branches': [
                            # Technology & Software
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)software engineer|software|developer|programmer|coder|full stack|backend|frontend|web developer|mobile developer|devops|sre|qa engineer|test engineer'}}, 'then': 'Technology & Software'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)data scientist|data analyst|data engineer|machine learning|ai|artificial intelligence|analytics|business intelligence|bi analyst'}}, 'then': 'Data & Analytics'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)it|information technology|systems engineer|cloud engineer|aws|azure|gcp|infrastructure|network engineer|cybersecurity|security engineer'}}, 'then': 'IT & Infrastructure'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)product manager|product owner|product lead|program manager|project manager|scrum master|agile'}}, 'then': 'Product & Project Management'},
                            
                            # Healthcare & Medical
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)physician|doctor|md|medical doctor|dr\\.|resident|fellow|intern|hospitalist|attending'}}, 'then': 'Physicians & Doctors'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)nurse|rn|lpn|cna|nursing|registered nurse|nurse practitioner'}}, 'then': 'Nursing'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)dentist|dental|orthodontist|periodontist|endodontist|oral surgeon'}}, 'then': 'Dental'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)pharmacist|pharmacy|pharmacology'}}, 'then': 'Pharmacy'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)cardiologist|cardiology|neurologist|neurology|oncologist|oncology|pediatrician|pediatrics|surgeon|surgery|anesthesiologist|anesthesiology|radiologist|radiology|pathology|dermatologist|dermatology'}}, 'then': 'Medical Specialists'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)healthcare|health care|medical|hospital|clinic|patient care|clinical|health administration|public health'}}, 'then': 'Healthcare Administration'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)medical student|med student|medical resident|residency|internship|fellowship'}}, 'then': 'Medical Trainees'},
                            
                            # Finance & Business
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)investment banker|investment banking|equity research|portfolio manager|fund manager|trader|trading|wealth management|financial advisor|financial planner'}}, 'then': 'Investment & Wealth Management'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)financial analyst|finance analyst|business analyst|data analyst|quant|quantitative analyst|risk analyst|credit analyst'}}, 'then': 'Financial Analysis'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)accountant|accounting|cpa|bookkeeper|controller|cfo|chief financial officer'}}, 'then': 'Accounting & Finance'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)consultant|consulting|strategy consultant|management consultant|business consultant|advisor'}}, 'then': 'Consulting'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)manager|management|director|vp|vice president|c-level|ceo|cto|coo|cmo|cio|chief|executive|leadership'}}, 'then': 'Management & Leadership'},
                            
                            # Engineering
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)mechanical engineer|electrical engineer|civil engineer|chemical engineer|aerospace engineer|industrial engineer|environmental engineer|biomedical engineer'}}, 'then': 'Engineering'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)structural engineer|transportation engineer|construction engineer|architect|urban planner'}}, 'then': 'Civil & Structural Engineering'},
                            
                            # Marketing & Sales
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)marketing|brand manager|product marketing|digital marketing|social media|content marketing|growth marketer|cmo'}}, 'then': 'Marketing & Branding'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)sales|business development|account manager|customer success|client relations|revenue|growth'}}, 'then': 'Sales & Business Development'},
                            
                            # Education & Research
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)teacher|professor|educator|academic|researcher|scientist|postdoc|phd|lecturer'}}, 'then': 'Education & Research'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)student|student at|studying|university|college|graduate|undergraduate'}}, 'then': 'Students'},
                            
                            # Legal & Government
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)lawyer|attorney|legal|counsel|juris doctor|jd|esquire|law firm'}}, 'then': 'Legal'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)government|federal|state|city|municipal|public sector|civil service|senate|congress|legislative|policy'}}, 'then': 'Government & Public Sector'},
                            
                            # Creative & Media
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)designer|ux designer|ui designer|graphic designer|product designer|creative director|artist|photographer|videographer|writer|journalist|editor|content creator'}}, 'then': 'Creative & Media'},
                            
                            # Operations & Support
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)operations|operational|logistics|supply chain|procurement|warehouse|distribution|fulfillment'}}, 'then': 'Operations & Logistics'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)hr|human resources|recruiting|talent acquisition|people operations|hr manager|recruiter'}}, 'then': 'Human Resources'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)customer service|support|customer support|technical support|help desk|service desk|customer success'}}, 'then': 'Customer Service & Support'},
                            
                            # Other categories
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)entrepreneur|founder|co-founder|startup|business owner|self employed|freelancer'}}, 'then': 'Entrepreneurship'},
                            {'case': {'$regexMatch': {'input': '$profession', 'regex': '(?i)retired|semi retired|pensioner|not working|unemployed|between jobs'}}, 'then': 'Not Working'},
                        ],
                        'default': 'Other'
                    }
                }
            }},
            {'$group': {'_id': '$profession', 'count': {'$sum': 1}, 'group': {'$first': '$professionGroup'}}},
            {'$sort': {'count': -1}},
            {'$limit': 200}  # Get more professions
        ]
        
        # Execute aggregation
        results = await db.users.aggregate(pipeline).to_list(200)
        
        print(f"\n📊 Found {len(results)} unique professions from production:")
        print("=" * 60)
        
        # Group results by category
        grouped_results = {}
        for result in results:
            group = result.get('group', 'Other')
            if group not in grouped_results:
                grouped_results[group] = []
            grouped_results[group].append(result)
        
        # Sort groups by total users (descending)
        sorted_groups = sorted(grouped_results.items(), 
                             key=lambda x: sum(r['count'] for r in x[1]), 
                             reverse=True)
        
        # Display results by group
        print(f"\n📊 PROFESSIONS GROUPED BY CATEGORY")
        print("=" * 80)
        
        group_counter = 1
        total_users = sum(r['count'] for r in results)
        
        for group_name, professions in sorted_groups:
            group_total = sum(p['count'] for p in professions)
            group_percentage = (group_total / total_users) * 100
            
            print(f"\n{group_counter}. 📁 {group_name}")
            print(f"   Total: {group_total} users ({group_percentage:.1f}%)")
            print(f"   " + "-" * 50)
            
            # Sort professions within group by count (descending)
            sorted_professions = sorted(professions, key=lambda x: x['count'], reverse=True)
            
            for i, result in enumerate(sorted_professions, 1):
                profession = result['_id']
                count = result['count']
                percentage = (count / total_users) * 100
                print(f"     {i:2d}. {profession:<40} ({count:2d} users, {percentage:4.1f}%)")
            
            group_counter += 1
        
        # Summary statistics
        print(f"\n📈 SUMMARY STATISTICS")
        print("=" * 50)
        print(f"   Total unique professions: {len(results)}")
        print(f"   Total profession groups: {len(grouped_results)}")
        print(f"   Total users with professions: {total_users}")
        
        # Top 10 professions overall
        print(f"\n🏆 TOP 10 MOST COMMON PROFESSIONS (OVERALL)")
        print("=" * 50)
        for i, result in enumerate(results[:10], 1):
            profession = result['_id']
            count = result['count']
            group = result.get('group', 'Other')
            percentage = (count / total_users) * 100
            print(f"   {i:2d}. {profession:<30} [{group}] {count:3d} users ({percentage:4.1f}%)")
        
        # Top 10 profession groups
        print(f"\n🎯 TOP 10 PROFESSION GROUPS BY SIZE")
        print("=" * 50)
        for i, (group_name, professions) in enumerate(sorted_groups[:10], 1):
            group_total = sum(p['count'] for p in professions)
            group_percentage = (group_total / total_users) * 100
            print(f"   {i:2d}. {group_name:<35} {group_total:3d} users ({group_percentage:4.1f}%)")
        
        # Export to CSV with groups
        csv_content = "profession,group,count,percentage\n"
        for result in results:
            profession = result['_id'].replace(',', ';')  # Replace commas in profession names
            group = result.get('group', 'Other').replace(',', ';')
            count = result['count']
            percentage = (count / total_users) * 100
            csv_content += f"{profession},{group},{count},{percentage:.2f}%\n"
        
        with open('production_professions_grouped.csv', 'w') as f:
            f.write(csv_content)
        
        # Export group summary CSV
        group_csv_content = "group,total_users,percentage,profession_count\n"
        for group_name, professions in sorted_groups:
            group_total = sum(p['count'] for p in professions)
            group_percentage = (group_total / total_users) * 100
            profession_count = len(professions)
            group_csv_content += f"{group_name},{group_total},{group_percentage:.2f}%,{profession_count}\n"
        
        with open('production_profession_groups.csv', 'w') as f:
            f.write(group_csv_content)
        
        print(f"\n💾 EXPORTED FILES:")
        print(f"   📄 production_professions_grouped.csv (detailed professions with groups)")
        print(f"   📊 production_profession_groups.csv (group summary statistics)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'client' in locals():
            await client.close()
            print("🔌 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(extract_professions())
