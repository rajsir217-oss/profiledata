#!/usr/bin/env python3
"""
Script to convert Register.js into tabbed Register2.js
Splits form fields into 3 tabs while keeping legal agreements outside tabs
"""

import re

# Read the original Register.js
with open('frontend/src/components/Register.js.toberemoved', 'r') as f:
    content = f.read()

# Step 1: Replace component name
content = content.replace('const Register = () => {', 'const Register2 = () => {')
content = content.replace('export default Register;', 'export default Register2;')

# Step 2: Add TabContainer import after api import
content = content.replace(
    'import api from "../api";',
    'import api from "../api";\nimport TabContainer from "./TabContainer";'
)

# Step 3: Find the boundaries for tabs
# Tab 1 ends before "Education History Section"
# Tab 2 ends before "Partner Preference with Sample"
# Tab 3 ends before "Legal Agreements Section"

# Find line numbers (approximate)
lines = content.split('\n')
tab1_end = None
tab2_end = None
tab3_end = None
form_start = None

for i, line in enumerate(lines):
    if 'Custom row for firstName and lastName' in line and form_start is None:
        form_start = i
    if 'Education History Section - Using Shared Component' in line and tab1_end is None:
        tab1_end = i
    if 'Partner Preference with Sample Carousel' in line and tab2_end is None:
        tab2_end = i  
    if 'Legal Agreements Section' in line and tab3_end is None:
        tab3_end = i

print(f"Form starts at line: {form_start}")
print(f"Tab 1 ends at line: {tab1_end}")
print(f"Tab 2 ends at line: {tab2_end}")
print(f"Tab 3 ends at line: {tab3_end}")

# Step 4: Insert tab structure
# Before form_start line, insert TabContainer opening
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

# At tab1_end, close tab 1 and open tab 2
tab1_to_tab2 = """
                </div>
              )
            },
            {
              id: 'background',
              label: 'Background & Experience',
              icon: '🎓',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">🎓 Education & Career</h3>
"""

# At tab2_end, close tab 2 and open tab 3
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

# At tab3_end, close tab 3 and TabContainer
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

        {/* Legal Agreements - OUTSIDE TABS */}
"""

# Insert markers
lines.insert(form_start, tab_container_opening)
lines.insert(tab1_end + 1, tab1_to_tab2)
lines.insert(tab2_end + 2, tab2_to_tab3)
lines.insert(tab3_end + 3, tab_container_closing)

# Rejoin
new_content = '\n'.join(lines)

# Write to Register2.js
with open('frontend/src/components/Register2.js', 'w') as f:
    f.write(new_content)

print("✅ Register2.js created successfully!")
print("📍 Tab boundaries:")
print(f"  - Tab 1 (About Me): Lines {form_start}-{tab1_end}")
print(f"  - Tab 2 (Background): Lines {tab1_end}-{tab2_end}")
print(f"  - Tab 3 (Partner Prefs): Lines {tab2_end}-{tab3_end}")
print(f"  - Legal Agreements: Line {tab3_end} onwards")
