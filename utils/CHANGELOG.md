# Changelog

## v2.0 - Enhanced Context Extraction (Nov 3, 2025)

### 🎉 Major Enhancement: Context Snippets Added!

**Problem Solved:** Previous version only showed URLs that contained the keyword, but didn't show WHERE or HOW the keyword appeared.

**New Features:**

1. **📝 Context Extraction**
   - Shows text snippets (up to 3 per URL) around where keyword appears
   - Each snippet shows ~150 characters before and after the keyword
   - Makes it easy to see the actual context without visiting the page

2. **🔢 Occurrence Counting**
   - Reports exactly how many times keyword appears on each page
   - Shown in both console output and found.txt

3. **📊 Enhanced Output Format**
   - Structured sections for each match
   - Clear formatting with separators
   - Easy to read and parse

### What Changed:

**Before (v1.0):**
```
# URLs containing keyword: 'Rancho Cordova'
# Total found: 2
...

http://www.linkedin.com/
https://www.linkedin.com/
```

**After (v2.0):**
```
# KEYWORD SEARCH RESULTS
# Keyword: 'Rancho Cordova'
# Total URLs found: 2
...

============================================================================
MATCH #1
============================================================================

URL: http://www.linkedin.com/
Occurrences: 5

CONTEXT SNIPPETS:
----------------------------------------------------------------------------

[1] ...Jobs in Rancho Cordova - Search and apply for positions at top 
companies located in the Rancho Cordova area...

[2] ...Senior Software Engineer - Rancho Cordova, CA. Full-time position 
with competitive benefits and salary...

[3] ...Connect with professionals in Rancho Cordova. Join groups and 
expand your network in Sacramento County...
```

### Console Output Enhancement:

**Before:**
```
✅ FOUND keyword 'Rancho Cordova' in: https://example.com
```

**After:**
```
✅ FOUND keyword 'Rancho Cordova' (3 times) in: https://example.com
```

### Technical Details:

- Added `extract_keyword_context()` method to extract text snippets
- Modified `fetch_page()` to count occurrences and extract context
- Enhanced `save_results()` to write detailed match information
- Changed internal data structure from List[str] to List[dict]
- Strips HTML tags and scripts to show only visible text
- Handles edge cases (beginning/end of text, whitespace cleanup)

### Benefits:

✅ **No need to visit URLs manually** - See context right in the results
✅ **Prioritize which URLs to investigate** - Occurrence count helps prioritize
✅ **Understand relevance immediately** - Context shows if match is relevant
✅ **Save time** - Quickly scan results without opening each page
✅ **Better decision making** - More information for analysis

### Backward Compatibility:

- Same command-line interface (no changes needed)
- Same input parameters
- Same dependencies (requests, beautifulsoup4, lxml)
- Output file still named `found.txt` (enhanced format)

### Usage (No Changes):

```bash
python3 web_crawler.py https://example.com "Rancho Cordova" 5
```

Everything works the same way, just with much better output!

---

## v1.0 - Initial Release

- Recursive web crawling (5 levels deep)
- Keyword search (case-insensitive)
- URL collection and filtering
- Basic results output
- Error handling
- Rate limiting
