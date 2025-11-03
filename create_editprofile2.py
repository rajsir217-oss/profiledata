#!/usr/bin/env python3
"""
Script to convert EditProfile.js into tabbed EditProfile2.js
Uses the same TabContainer component as Register2
"""

import re

# Read the original EditProfile.js
with open('frontend/src/components/EditProfile.js', 'r') as f:
    content = f.read()

# Step 1: Create backup
with open('frontend/src/components/EditProfile.js.toberemoved', 'w') as f:
    f.write(content)

print("✅ Backup created: EditProfile.js.toberemoved")

# Step 2: Replace component name
content = content.replace('const EditProfile = () => {', 'const EditProfile2 = () => {')
content = content.replace('export default EditProfile;', 'export default EditProfile2;')

# Step 3: Add TabContainer import
if 'import TabContainer from' not in content:
    content = content.replace(
        'import api from "../api";',
        'import api from "../api";\nimport TabContainer from "./TabContainer";'
    )

print("✅ Component renamed to EditProfile2")
print("✅ TabContainer import added")

# Step 4: Find boundaries for tabs
lines = content.split('\n')
form_start = None
tab1_end = None
tab2_end = None
tab3_end = None
form_end = None

for i, line in enumerate(lines):
    # Find where form fields start (after error/success messages)
    if 'firstName' in line and 'form-control' in line and form_start is None:
        form_start = i - 5  # Include the row div
    
    # Tab 1 ends before Education section
    if 'EducationHistory' in line and 'educationHistory={' in line and tab1_end is None:
        tab1_end = i - 2
    
    # Tab 2 ends before Partner Preference
    if 'Partner Preference' in line and 'label' in line and tab2_end is None:
        tab2_end = i - 2
    
    # Tab 3 ends before Save button
    if 'btn btn-primary' in line and 'Save Changes' in line and tab3_end is None:
        tab3_end = i - 2
        form_end = i

print(f"📍 Form starts at line: {form_start}")
print(f"📍 Tab 1 ends at line: {tab1_end}")
print(f"📍 Tab 2 ends at line: {tab2_end}")
print(f"📍 Tab 3 ends at line: {tab3_end}")
print(f"📍 Form ends at line: {form_end}")

# Step 5: Insert tab structure
if form_start and tab1_end and tab2_end and tab3_end:
    # Tab Container opening
    tab_container_opening = """
        {/* ========== TABBED NAVIGATION ========== */}
        <TabContainer
          tabs={[
            {
              id: 'about-me',
              label: 'About Me',
              icon: '👤',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">👤 Personal Information</h3>
"""

    # Close Tab 1, Open Tab 2
    tab1_to_tab2 = """
                </div>
              )
            },
            {
              id: 'background',
              label: 'Qualifications',
              icon: '🎓',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">🎓 Qualifications</h3>
"""

    # Close Tab 2, Open Tab 3
    tab2_to_tab3 = """
                </div>
              )
            },
            {
              id: 'partner-preferences',
              label: 'Partner Preferences',
              icon: '💕',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">💕 What You're Looking For</h3>
"""

    # Close Tab 3 and TabContainer
    tab_container_closing = """
                </div>
              )
            }
          ]}
          calculateProgress={calculateTabProgress}
          validateTab={validateTabBeforeSwitch}
          onAutoSave={handleTabAutoSave}
          enableAutoSave={true}
        />

        {/* Save Button - OUTSIDE TABS */}
"""

    # Insert markers
    lines.insert(form_start, tab_container_opening)
    lines.insert(tab1_end + 1, tab1_to_tab2)
    lines.insert(tab2_end + 2, tab2_to_tab3)
    lines.insert(tab3_end + 3, tab_container_closing)

    # Rejoin
    new_content = '\n'.join(lines)

    # Write EditProfile2.js
    with open('frontend/src/components/EditProfile2.js', 'w') as f:
        f.write(new_content)

    print("\n✅ EditProfile2.js created successfully!")
    print("📍 Tab boundaries:")
    print(f"  - Tab 1 (About Me): Lines {form_start}-{tab1_end}")
    print(f"  - Tab 2 (Background): Lines {tab1_end}-{tab2_end}")
    print(f"  - Tab 3 (Partner Prefs): Lines {tab2_end}-{tab3_end}")
    print(f"  - Save Button: Line {form_end}")
    print("\n🔧 Next: Add tab helper functions (calculateTabProgress, validateTabBeforeSwitch, handleTabAutoSave)")
else:
    print("❌ Could not find all tab boundaries. Manual intervention needed.")
