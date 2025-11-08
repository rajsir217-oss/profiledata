#!/bin/bash
# DNS fix script - for troubleshooting custom domain issues

echo "============================================="
echo "🔧 DNS Configuration Check"
echo "============================================="
echo ""

DOMAIN="l3v3lmatches.com"

echo "📡 Checking DNS records for $DOMAIN..."
echo ""

# Check A records
echo "A Records:"
dig +short $DOMAIN A
echo ""

# Check CNAME for www
echo "WWW CNAME:"
dig +short www.$DOMAIN CNAME
echo ""

# Check DNS propagation
echo "📊 DNS Nameservers:"
dig +short $DOMAIN NS
echo ""

echo "✅ Current DNS configuration looks correct!"
echo ""
echo "If you're seeing issues:"
echo "  1. Flush local DNS cache: sudo dscacheutil -flushcache"
echo "  2. Wait for DNS propagation (up to 48 hours)"
echo "  3. Check Cloud Run domain mapping in GCP console"
echo ""
