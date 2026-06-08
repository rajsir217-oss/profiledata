#!/usr/bin/env python3
"""
CSS Class Reference Generator
Scans all CSS files and generates comprehensive documentation
"""

import os
import re
from collections import defaultdict
from datetime import datetime

# Configuration
CSS_DIR = "frontend/src"
OUTPUT_FILE = "CSS_REFERENCE.md"

def find_css_files():
    """Find all CSS files in the project"""
    css_files = []
    for root, dirs, files in os.walk(CSS_DIR):
        for file in files:
            if file.endswith('.css'):
                css_files.append(os.path.join(root, file))
    return css_files

def extract_classes_from_file(filepath):
    """Extract all CSS class names from a file"""
    classes = set()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Match CSS class definitions: .classname { or .classname,
            # Must start with letter or underscore (not number)
            matches = re.findall(r'\.([a-zA-Z_][a-zA-Z0-9_-]*)', content)
            # Filter out pseudo-classes and number-only matches
            valid_classes = [m for m in matches if not m[0].isdigit() and m not in ['5s', '3s', '8s']]
            classes.update(valid_classes)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return classes

def find_class_usage(classname, css_files):
    """Find which files use a specific class"""
    usage = []
    pattern = re.compile(r'\.' + re.escape(classname) + r'[^a-zA-Z0-9_-]')
    
    for filepath in css_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if pattern.search(content):
                    # Get relative path
                    rel_path = filepath.replace('frontend/src/', '')
                    usage.append(rel_path)
        except Exception as e:
            pass
    return usage

def find_jsx_usage(classname):
    """Find JSX/JS files that use this class"""
    jsx_files = []
    pattern = re.compile(r'className[=:]["\'].*?' + re.escape(classname) + r'.*?["\']')
    
    for root, dirs, files in os.walk(CSS_DIR):
        for file in files:
            if file.endswith(('.js', '.jsx', '.tsx')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if pattern.search(content):
                            rel_path = filepath.replace('frontend/src/', '')
                            jsx_files.append(rel_path)
                except Exception as e:
                    pass
    return jsx_files

def generate_reference():
    """Generate the CSS reference markdown"""
    print("🔍 Scanning CSS files...")
    css_files = find_css_files()
    print(f"   Found {len(css_files)} CSS files")
    
    print("📊 Extracting class names...")
    all_classes = set()
    class_to_files = defaultdict(list)
    
    for filepath in css_files:
        classes = extract_classes_from_file(filepath)
        all_classes.update(classes)
        rel_path = filepath.replace('frontend/src/', '')
        for cls in classes:
            class_to_files[cls].append(rel_path)
    
    print(f"   Found {len(all_classes)} unique classes")
    
    # Categorize by risk level
    high_risk = {}  # 5+ files
    moderate_risk = {}  # 2-4 files
    low_risk = {}  # 1 file
    
    print("🔍 Analyzing usage patterns...")
    for cls, files in class_to_files.items():
        file_count = len(set(files))  # Unique files
        if file_count >= 5:
            high_risk[cls] = files
        elif file_count >= 2:
            moderate_risk[cls] = files
        else:
            low_risk[cls] = files
    
    # Generate markdown
    print("📝 Generating reference document...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        # Header
        f.write(f"""# CSS Class Reference Guide

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Total CSS Files:** {len(css_files)}  
**Total Unique Classes:** {len(all_classes)}  
**Purpose:** Prevent breaking changes by documenting all CSS classes and their usage

⚠️ **CRITICAL RULE:** Before modifying any class, check its usage below!

---

## 📊 Summary

| Risk Level | Class Count | Description |
|------------|-------------|-------------|
| 🔴 **High** | {len(high_risk)} | Used in 5+ files - **NEVER modify directly** |
| 🟡 **Moderate** | {len(moderate_risk)} | Used in 2-4 files - Modify with caution |
| 🟢 **Low** | {len(low_risk)} | Component-specific - Safe to modify |

---

## 🔴 HIGH-RISK SHARED CLASSES
**⚠️ WARNING:** These are used in 5+ files. Modifying these will break multiple components!

**SAFE APPROACH:**
1. ❌ DON'T: Modify these classes
2. ✅ DO: Create new specific classes (e.g., `.user-status-badge` instead of modifying `.status-badge`)

""")
        
        # High-risk classes
        for cls in sorted(high_risk.keys(), key=lambda x: len(high_risk[x]), reverse=True)[:50]:
            files = sorted(set(high_risk[cls]))
            f.write(f"### `.{cls}`\n\n")
            f.write(f"**Used in {len(files)} files:**\n")
            for file in files:
                f.write(f"- `{file}`\n")
            f.write("\n")
        
        # Moderate-risk classes
        f.write("""---

## 🟡 MODERATE-RISK SHARED CLASSES
**⚠️ CAUTION:** Used in 2-4 files. Check all usages before modifying.

""")
        
        for cls in sorted(moderate_risk.keys(), key=lambda x: len(moderate_risk[x]), reverse=True)[:30]:
            files = sorted(set(moderate_risk[cls]))
            f.write(f"### `.{cls}`\n")
            f.write(f"**Used in {len(files)} files:** ")
            f.write(", ".join([f"`{f}`" for f in files]))
            f.write("\n\n")
        
        # Global files info
        f.write("""---

## 📁 GLOBAL CSS FILES
**WARNING:** Changes to these files affect the entire application!

""")
        
        global_files = [
            ('styles/components.css', 'Global component styles'),
            ('styles/utilities.css', 'Utility classes'),
            ('styles/animations.css', 'Animation keyframes'),
            ('styles/variables.css', 'CSS variables'),
            ('styles/global.css', 'Global base styles'),
            ('themes/themes.css', 'Theme definitions')
        ]
        
        for file, desc in global_files:
            full_path = f"frontend/src/{file}"
            if os.path.exists(full_path):
                with open(full_path, 'r') as gf:
                    lines = len(gf.readlines())
                f.write(f"### `{file}`\n")
                f.write(f"**Purpose:** {desc}  \n")
                f.write(f"**Lines:** {lines}  \n\n")
        
        # Safe modification guide
        f.write("""---

## ✅ SAFE MODIFICATION GUIDE

### Before Modifying ANY CSS Class:

1. **Search this document** for the class name
2. **Check "Used in" count**:
   - 5+ files = 🔴 High risk - **Create new class instead**
   - 2-4 files = 🟡 Medium risk - Check all usages first
   - 1 file = 🟢 Low risk - Safe to modify

3. **Search codebase**:
   ```bash
   # Find CSS usage
   grep -r ".classname" frontend/src/**/*.css
   
   # Find JSX usage
   grep -r "className.*classname" frontend/src/**/*.{js,jsx}
   ```

4. **Test all affected pages** (see Testing Checklist below)

### Creating New Classes (Safe Approach):

```css
/* ❌ DON'T: Modify shared class */
.status-badge {{
  padding: 0; /* BREAKS 10+ components! */
}}

/* ✅ DO: Create specific class */
.user-online-badge {{
  padding: 0;
  border-radius: 50%;
  /* All your specific styles */
}}
```

---

## 🧪 TESTING CHECKLIST

After ANY CSS change, test these pages:

### Required Pages:
- [ ] Dashboard
- [ ] Search Page (all tabs)
- [ ] Messages
- [ ] Profile Page
- [ ] Scheduler (admin)
- [ ] Notification Management (admin)
- [ ] Test Dashboard (admin)
- [ ] PII Management (admin)
- [ ] Role Management (admin)

### Required Themes:
- [ ] Cozy Light (default)
- [ ] Dark
- [ ] Rose
- [ ] Light Gray
- [ ] Ultra Light Gray

### Required Screen Sizes:
- [ ] Mobile (< 768px)
- [ ] Tablet (768-1024px)
- [ ] Desktop (> 1024px)

---

## 🔧 MAINTENANCE

### Regenerate This Document:

```bash
python3 generate_css_reference.py
```

### When to Regenerate:
- After adding new CSS files
- After major refactoring
- Monthly (to stay current)

---

## 📚 RELATED DOCUMENTATION

- [Pre-Implementation Checklist](./TESTING_CHECKLIST.md) - Safety checks before coding
- [Shared Styles Guide](./SHARED_STYLES.md) - Component-specific CSS patterns
- [Theme Guide](./frontend/src/themes/README.md) - Theme variable documentation

---

**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Generated by:** `generate_css_reference.py`

""")
    
    print(f"\n✅ Reference generated: {OUTPUT_FILE}")
    print(f"📊 Statistics:")
    print(f"   High-risk classes: {len(high_risk)}")
    print(f"   Moderate-risk: {len(moderate_risk)}")
    print(f"   Low-risk: {len(low_risk)}")

if __name__ == "__main__":
    generate_reference()
