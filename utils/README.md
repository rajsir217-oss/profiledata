# Web Crawler - Keyword Search Tool

A recursive web crawler that scans websites for specific keywords and saves matching URLs.

## Features

- 🔍 **Recursive Crawling**: Crawls up to 5 levels deep (configurable)
- 🎯 **Keyword Search**: Case-insensitive keyword matching
- 📝 **Context Extraction**: Shows actual text snippets where keyword appears
- 🔢 **Occurrence Counting**: Reports how many times keyword appears on each page
- 📊 **Progress Tracking**: Real-time crawling status
- 💾 **Enhanced Results**: Saves URLs with context snippets to `found.txt`
- 🛡️ **Error Handling**: Robust handling of timeouts and errors
- 🚫 **Smart Filtering**: Skips non-HTML files (PDFs, images, etc.)
- ⏱️ **Rate Limiting**: Polite crawling with delays between requests

## Installation

1. **Install dependencies**:
   ```bash
   cd utils
   pip install -r requirements.txt
   ```

## Usage

### Basic Usage
```bash
python web_crawler.py <URL> "<KEYWORD>" [MAX_DEPTH]
```

### Examples

**Example 1: Search for "Rancho Cordova" with default depth (5 levels)**
```bash
python web_crawler.py https://example.com "Rancho Cordova"
```

**Example 2: Search with custom depth (3 levels)**
```bash
python web_crawler.py https://example.com "Rancho Cordova" 3
```

**Example 3: Different keyword**
```bash
python web_crawler.py https://citywebsite.com "Sacramento County"
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| URL | ✅ Yes | - | Starting URL (must include http:// or https://) |
| KEYWORD | ✅ Yes | - | Keyword to search (case-insensitive) |
| MAX_DEPTH | ❌ No | 5 | Maximum depth levels to crawl |

## Output

### Console Output
```
================================================================================
🚀 Starting Web Crawler
================================================================================
📍 Start URL: https://example.com
🔑 Keyword: 'Rancho Cordova'
📊 Max Depth: 5
================================================================================

📊 Level 0/5: https://example.com
🔍 Fetching: https://example.com
✅ FOUND keyword 'Rancho Cordova' (3 times) in: https://example.com
🔗 Found 25 links on this page
  📊 Level 1/5: https://example.com/about
  🔍 Fetching: https://example.com/about
  ✅ FOUND keyword 'Rancho Cordova' (1 time) in: https://example.com/about
  ...

================================================================================
🏁 Crawling Complete
================================================================================
⏱️  Time elapsed: 45.23 seconds

✅ Results saved to: found.txt
📊 Total URLs crawled: 150
🎯 URLs with keyword: 8
```

### found.txt Format
```
# KEYWORD SEARCH RESULTS
# Keyword: 'Rancho Cordova'
# Total URLs found: 8
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
Sacramento County. Our city offers excellent schools and amenities...

[2] ...Visit the Rancho Cordova City Hall at 2729 Prospect Park Drive. 
Open Monday through Friday, 8am to 5pm...

[3] ...Contact Rancho Cordova Planning Department for building permits 
and zoning information...

============================================================================
MATCH #2
============================================================================

URL: https://example.com/about
Occurrences: 1

CONTEXT SNIPPETS:
----------------------------------------------------------------------------

[1] ...serving communities including Rancho Cordova, Folsom, and 
surrounding areas in Sacramento County...
```

## How It Works

1. **Start**: Begins at the provided URL
2. **Scan**: Checks page content for keyword
3. **Extract**: Collects all links from the page
4. **Recurse**: Visits each link and repeats (up to max depth)
5. **Save**: Records all matching URLs to `found.txt`

### Crawling Strategy
- **Breadth-First**: Explores all links at current level before going deeper
- **Duplicate Prevention**: Tracks visited URLs to avoid loops
- **Depth Limit**: Stops at configured maximum depth
- **Polite Crawling**: 0.5 second delay between requests

## Features & Filters

### ✅ Crawled
- HTML pages (text/html)
- HTTP and HTTPS URLs
- Relative and absolute links

### ❌ Skipped
- Non-HTML files (.pdf, .jpg, .png, .zip, .exe, etc.)
- JavaScript/CSS files
- Media files (videos, audio)
- Already visited URLs
- Invalid URLs

## Error Handling

- **Timeouts**: 10-second timeout per request
- **Connection Errors**: Gracefully skipped with logging
- **Invalid URLs**: Filtered out automatically
- **HTTP Errors**: Logged and continued
- **Keyboard Interrupt**: Saves partial results before exit

## Performance Tips

1. **Limit Depth**: Start with depth 2-3 for large sites
2. **Specific URLs**: Use specific starting URLs to reduce scope
3. **Test First**: Try with depth=1 to see how many links exist
4. **Monitor**: Watch console output to gauge progress

## Example Session

```bash
$ cd utils
$ python web_crawler.py https://citysite.com "Rancho Cordova" 3

================================================================================
🚀 Starting Web Crawler
================================================================================
📍 Start URL: https://citysite.com
🔑 Keyword: 'Rancho Cordova'
📊 Max Depth: 3
================================================================================

📊 Level 0/3: https://citysite.com
🔍 Fetching: https://citysite.com
✅ FOUND keyword 'Rancho Cordova' in: https://citysite.com
🔗 Found 42 links on this page
  📊 Level 1/3: https://citysite.com/locations
  🔍 Fetching: https://citysite.com/locations
  ✅ FOUND keyword 'Rancho Cordova' in: https://citysite.com/locations
  🔗 Found 15 links on this page
    📊 Level 2/3: https://citysite.com/locations/rancho-cordova
    🔍 Fetching: https://citysite.com/locations/rancho-cordova
    ✅ FOUND keyword 'Rancho Cordova' in: https://citysite.com/locations/rancho-cordova
    ...

================================================================================
🏁 Crawling Complete
================================================================================
⏱️  Time elapsed: 68.45 seconds

✅ Results saved to: found.txt
📊 Total URLs crawled: 87
🎯 URLs with keyword: 12
```

## Troubleshooting

### No URLs Found
- Check if keyword spelling is correct
- Verify website allows crawling (robots.txt)
- Try with case variations if needed

### Slow Performance
- Reduce max_depth parameter
- Start with a more specific URL
- Check network connection

### Too Many URLs
- Use more specific keyword
- Reduce depth level
- Start from a subdirectory URL

## Notes

- **Case-Insensitive**: Keyword search ignores case
- **Polite Crawling**: Includes User-Agent header and delays
- **Resumable**: Re-run anytime; results are overwritten
- **Safe**: Read-only operation, doesn't modify any websites

## Dependencies

- `requests` - HTTP library
- `beautifulsoup4` - HTML parsing
- `lxml` - Fast XML/HTML parser

## License

Free to use and modify.
