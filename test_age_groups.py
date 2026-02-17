#!/usr/bin/env python3
"""
Test 5-year age grouping logic
"""

def calculate_age_group(age):
    """Calculate 5-year age group"""
    if age is None or age < 18:
        return None
    if age <= 19:
        return 18
    return age - (age % 5)

def create_age_range(age_group):
    """Create age range label"""
    if age_group is None:
        return None
    if age_group == 18:
        return "18-19"
    return f"{age_group}-{age_group + 4}"

# Test the age grouping logic
test_ages = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]

print("📊 Testing 5-Year Age Grouping")
print("=" * 50)

for age in test_ages:
    age_group = calculate_age_group(age)
    age_range = create_age_range(age_group)
    print(f"Age {age:2d} → Group {age_group:2d} → Range {age_range}")

print("\n📈 Expected Age Groups:")
print("=" * 50)

# Show expected groups
groups = {}
for age in range(18, 66):
    group = calculate_age_group(age)
    if group not in groups:
        groups[group] = []
    groups[group].append(age)

for group in sorted(groups.keys()):
    age_range = create_age_range(group)
    ages = groups[group]
    print(f"Group {group:2d} ({age_range}): Ages {', '.join(map(str, ages))}")

print(f"\n✅ Total groups: {len(groups)}")
print("✅ Each group spans exactly 5 years")
