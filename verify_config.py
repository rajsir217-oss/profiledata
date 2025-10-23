"""Verify that config is loading SMTP settings from .env"""
import sys
sys.path.insert(0, '/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend')

from config import settings

print("=" * 60)
print("CONFIGURATION VERIFICATION")
print("=" * 60)

print(f"\n📁 ENV File Path: {settings.Config.env_file}")

print(f"\n📧 SMTP Configuration:")
print(f"   smtp_host: {settings.smtp_host}")
print(f"   smtp_port: {settings.smtp_port}")
print(f"   smtp_user: {settings.smtp_user}")
print(f"   smtp_password: {'SET' if settings.smtp_password else 'NOT SET'}")
print(f"   from_email: {settings.from_email}")
print(f"   from_name: {settings.from_name}")

if settings.smtp_user and settings.smtp_password:
    print(f"\n✅ SMTP configuration is LOADED correctly")
else:
    print(f"\n❌ SMTP configuration is MISSING")
    print(f"\n💡 Check if .env file exists at: {settings.Config.env_file}")
