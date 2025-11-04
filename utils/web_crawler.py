#!/usr/bin/env python3
"""
Recursive Web Crawler - Scans websites for keywords
Crawls up to specified depth, collects all URLs, and saves matches to found.txt
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import time
import sys
from typing import Set, List
import re


class WebCrawler:
    def __init__(self, start_url: str, keyword: str, max_depth: int = 5):
        """
        Initialize the web crawler
        
        Args:
            start_url: Starting URL to crawl
            keyword: Keyword to search for in pages
            max_depth: Maximum depth to crawl (default: 5)
        """
        self.start_url = start_url
        self.keyword = keyword
        self.max_depth = max_depth
        self.visited_urls: Set[str] = set()
        self.found_urls: List[dict] = []  # Changed to store dicts with details
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
    def is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and should be crawled"""
        try:
            parsed = urlparse(url)
            # Only crawl http/https URLs
            if parsed.scheme not in ['http', 'https']:
                return False
            # Skip common non-HTML resources
            skip_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', 
                             '.exe', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.mp3']
            if any(url.lower().endswith(ext) for ext in skip_extensions):
                return False
            return True
        except:
            return False
    
    def extract_links(self, html_content: str, base_url: str) -> Set[str]:
        """Extract all valid links from HTML content"""
        links = set()
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            for tag in soup.find_all('a', href=True):
                link = tag['href']
                # Convert relative URLs to absolute
                absolute_url = urljoin(base_url, link)
                # Remove fragments
                absolute_url = absolute_url.split('#')[0]
                if self.is_valid_url(absolute_url):
                    links.add(absolute_url)
        except Exception as e:
            print(f"⚠️  Error extracting links: {e}")
        return links
    
    def extract_keyword_context(self, html_content: str, max_snippets: int = 3) -> List[str]:
        """
        Extract text snippets around keyword occurrences
        
        Args:
            html_content: HTML content to search
            max_snippets: Maximum number of snippets to return
            
        Returns:
            List of text snippets showing keyword in context
        """
        snippets = []
        try:
            # Parse HTML and get visible text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "meta", "link"]):
                script.decompose()
            
            # Get text content
            text = soup.get_text()
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            # Find keyword occurrences (case-insensitive)
            keyword_lower = self.keyword.lower()
            text_lower = text.lower()
            
            position = 0
            count = 0
            while position < len(text_lower) and count < max_snippets:
                index = text_lower.find(keyword_lower, position)
                if index == -1:
                    break
                
                # Extract context (150 chars before and after)
                start = max(0, index - 150)
                end = min(len(text), index + len(self.keyword) + 150)
                
                snippet = text[start:end].strip()
                
                # Add ellipsis if not at beginning/end
                if start > 0:
                    snippet = "..." + snippet
                if end < len(text):
                    snippet = snippet + "..."
                
                snippets.append(snippet)
                position = index + len(self.keyword)
                count += 1
                
        except Exception as e:
            print(f"⚠️  Error extracting context: {e}")
        
        return snippets
    
    def fetch_page(self, url: str) -> tuple[str, bool]:
        """
        Fetch page content and check for keyword
        
        Returns:
            tuple: (html_content, keyword_found)
        """
        try:
            print(f"🔍 Fetching: {url}")
            response = self.session.get(url, timeout=10, allow_redirects=True)
            response.raise_for_status()
            
            # Check if keyword is present (case-insensitive)
            content = response.text
            content_lower = content.lower()
            keyword_lower = self.keyword.lower()
            keyword_found = keyword_lower in content_lower
            
            if keyword_found:
                # Count occurrences
                count = content_lower.count(keyword_lower)
                print(f"✅ FOUND keyword '{self.keyword}' ({count} times) in: {url}")
                
                # Extract context snippets
                snippets = self.extract_keyword_context(content, max_snippets=3)
                
                # Store details
                self.found_urls.append({
                    'url': url,
                    'count': count,
                    'snippets': snippets
                })
            
            return content, keyword_found
            
        except requests.exceptions.Timeout:
            print(f"⏱️  Timeout: {url}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching {url}: {str(e)[:100]}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
        
        return "", False
    
    def crawl(self, url: str, depth: int = 0):
        """
        Recursively crawl URLs up to max_depth
        
        Args:
            url: Current URL to crawl
            depth: Current depth level (0 = start URL)
        """
        # Check depth limit
        if depth > self.max_depth:
            return
        
        # Skip if already visited
        if url in self.visited_urls:
            return
        
        # Mark as visited
        self.visited_urls.add(url)
        
        # Show progress
        indent = "  " * depth
        print(f"{indent}📊 Level {depth}/{self.max_depth}: {url}")
        
        # Fetch and scan page
        html_content, keyword_found = self.fetch_page(url)
        
        if not html_content:
            return
        
        # Extract links for next level
        if depth < self.max_depth:
            links = self.extract_links(html_content, url)
            print(f"{indent}🔗 Found {len(links)} links on this page")
            
            # Crawl each link recursively
            for link in links:
                if link not in self.visited_urls:
                    # Small delay to be polite to servers
                    time.sleep(0.5)
                    self.crawl(link, depth + 1)
    
    def save_results(self, output_file: str = "found.txt"):
        """Save found URLs to file with context snippets"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(f"# KEYWORD SEARCH RESULTS\n")
                f.write(f"# Keyword: '{self.keyword}'\n")
                f.write(f"# Total URLs found: {len(self.found_urls)}\n")
                f.write(f"# Start URL: {self.start_url}\n")
                f.write(f"# Max depth: {self.max_depth}\n")
                f.write("#" + "="*70 + "\n\n")
                
                for idx, result in enumerate(self.found_urls, 1):
                    f.write(f"\n{'='*76}\n")
                    f.write(f"MATCH #{idx}\n")
                    f.write(f"{'='*76}\n\n")
                    f.write(f"URL: {result['url']}\n")
                    f.write(f"Occurrences: {result['count']}\n\n")
                    
                    if result['snippets']:
                        f.write(f"CONTEXT SNIPPETS:\n")
                        f.write(f"{'-'*76}\n")
                        for i, snippet in enumerate(result['snippets'], 1):
                            f.write(f"\n[{i}] {snippet}\n")
                    else:
                        f.write(f"(No text context available)\n")
                    
                    f.write(f"\n")
            
            print(f"\n✅ Results saved to: {output_file}")
            print(f"📊 Total URLs crawled: {len(self.visited_urls)}")
            print(f"🎯 URLs with keyword: {len(self.found_urls)}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")
    
    def run(self):
        """Start the crawling process"""
        print("="*80)
        print("🚀 Starting Web Crawler")
        print("="*80)
        print(f"📍 Start URL: {self.start_url}")
        print(f"🔑 Keyword: '{self.keyword}'")
        print(f"📊 Max Depth: {self.max_depth}")
        print("="*80 + "\n")
        
        start_time = time.time()
        
        try:
            self.crawl(self.start_url, depth=0)
        except KeyboardInterrupt:
            print("\n⚠️  Crawling interrupted by user")
        except Exception as e:
            print(f"\n❌ Fatal error: {e}")
        
        elapsed_time = time.time() - start_time
        
        print("\n" + "="*80)
        print("🏁 Crawling Complete")
        print("="*80)
        print(f"⏱️  Time elapsed: {elapsed_time:.2f} seconds")
        
        self.save_results()


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: python web_crawler.py <url> <keyword> [max_depth]")
        print("\nExample:")
        print('  python web_crawler.py https://example.com "Rancho Cordova" 5')
        print("\nArguments:")
        print("  url        - Starting URL to crawl")
        print("  keyword    - Keyword to search for (case-insensitive)")
        print("  max_depth  - Maximum depth to crawl (optional, default: 5)")
        sys.exit(1)
    
    start_url = sys.argv[1]
    keyword = sys.argv[2]
    max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    # Validate URL
    if not start_url.startswith(('http://', 'https://')):
        print("❌ Error: URL must start with http:// or https://")
        sys.exit(1)
    
    # Create crawler and run
    crawler = WebCrawler(start_url, keyword, max_depth)
    crawler.run()


if __name__ == "__main__":
    main()
