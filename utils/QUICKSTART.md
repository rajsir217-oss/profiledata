# Quick Start Guide

Get started with the web crawler in 3 simple steps!

## 1. Install Dependencies

```bash
cd utils
pip install -r requirements.txt
```

## 2. Run the Crawler

### Method 1: Using Python directly
```bash
python web_crawler.py https://example.com "Rancho Cordova" 5
```

### Method 2: Using the shell script
```bash
./run_crawler.sh https://example.com "Rancho Cordova" 5
```

## 3. Check Results

```bash
cat found.txt
```

---

## Real-World Example

Search a city website for "Rancho Cordova" mentions:

```bash
python web_crawler.py https://www.cityofranchocordova.org "Rancho Cordova" 3
```

This will:
- Start at the city's homepage
- Extract all links from that page
- Visit each link (up to 3 levels deep)
- Search each page for "Rancho Cordova"
- Save matching URLs to `found.txt`

---

## Adjusting Search Depth

**Shallow search (faster, less comprehensive):**
```bash
python web_crawler.py https://example.com "keyword" 2
```

**Deep search (slower, more comprehensive):**
```bash
python web_crawler.py https://example.com "keyword" 10
```

**Recommended:** Start with depth 2-3 to test, then increase if needed.

---

## Understanding the Output

### Console Output
```
🔍 Fetching: https://example.com/page
✅ FOUND keyword 'Rancho Cordova' (3 times) in: https://example.com/page
🔗 Found 25 links on this page
```

- 🔍 = Currently scanning this URL
- ✅ = Keyword found (with occurrence count)
- 🔗 = Number of links discovered

### found.txt Output (Enhanced with Context!)
```
# KEYWORD SEARCH RESULTS
# Keyword: 'Rancho Cordova'
# Total URLs found: 12
# Start URL: https://example.com
# Max depth: 5
#======================================================================

============================================================================
MATCH #1
============================================================================

URL: https://example.com/locations/rancho-cordova
Occurrences: 3

CONTEXT SNIPPETS:
----------------------------------------------------------------------------

[1] ...Welcome to Rancho Cordova - a vibrant community in the heart of 
Sacramento County...

[2] ...Visit the Rancho Cordova City Hall at 2729 Prospect Park Drive...

[3] ...Contact Rancho Cordova Planning Department for information...
```

**Now you can see:**
- ✅ Which URLs contain the keyword
- ✅ How many times it appears on each page
- ✅ The actual text context where it's found!

---

## Tips for Best Results

### 1. Start Specific
Instead of:
```bash
python web_crawler.py https://example.com "keyword" 5
```

Try:
```bash
python web_crawler.py https://example.com/locations "keyword" 3
```

### 2. Test First
Run with depth=1 to see how many links exist:
```bash
python web_crawler.py https://example.com "keyword" 1
```

### 3. Watch for Patterns
If you see many irrelevant pages, start from a more specific URL.

---

## Common Use Cases

### Find all pages mentioning a city
```bash
python web_crawler.py https://countywebsite.gov "Rancho Cordova" 4
```

### Find documentation pages
```bash
python web_crawler.py https://docs.example.com "API reference" 3
```

### Find contact pages
```bash
python web_crawler.py https://example.com "contact us" 2
```

---

## Need Help?

See the full documentation in `README.md` for:
- Advanced features
- Troubleshooting
- Performance optimization
- Error handling

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `python web_crawler.py <url> "<keyword>"` | Run with default depth (5) |
| `python web_crawler.py <url> "<keyword>" 3` | Run with custom depth (3) |
| `./run_crawler.sh <url> "<keyword>" 3` | Use shell script |
| `cat found.txt` | View results |
| `wc -l found.txt` | Count how many URLs found |

---

Happy crawling! 🚀
