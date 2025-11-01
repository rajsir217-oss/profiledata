#!/usr/bin/env python3
"""
AWS SNS Test Script
Test AWS SNS SMS functionality before integrating into main app
"""

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import sys


def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_success(text):
    """Print success message"""
    print(f"✅ {text}")


def print_error(text):
    """Print error message"""
    print(f"❌ {text}")


def print_info(text):
    """Print info message"""
    print(f"ℹ️  {text}")


def test_aws_credentials(access_key, secret_key, region):
    """Test if AWS credentials are valid"""
    print_header("Step 1: Testing AWS Credentials")
    
    try:
        # Create SNS client
        sns_client = boto3.client(
            'sns',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        
        # Try to list topics first (minimal permission test)
        try:
            topics_response = sns_client.list_topics()
            print_success("AWS credentials are valid!")
        except ClientError as e:
            if 'subscription' in str(e).lower():
                print_error("SNS SMS not enabled in your account!")
                print_info("\n💡 Quick Fix:")
                print_info("1. Go to: https://console.aws.amazon.com/sns/")
                print_info("2. Click 'Text messaging (SMS)' in left sidebar")
                print_info("3. Click 'Publish text message' or 'Enable SMS'")
                print_info("4. Set up SMS preferences")
                return None
            raise
        
        print_info(f"Region: {region}")
        
        # Try to get SMS attributes
        try:
            response = sns_client.get_sms_attributes()
        except ClientError as e:
            if 'subscription' in str(e).lower() or 'PinpointSmsVoiceV2' in str(e):
                print_error("⚠️  SNS SMS not fully configured!")
                print_info("\n💡 To enable SNS SMS:")
                print_info("1. Go to: https://console.aws.amazon.com/sns/v3/home#/mobile/text-messaging")
                print_info("2. Click 'Text messaging preferences'")
                print_info("3. Set 'Default message type' to 'Transactional'")
                print_info("4. Click 'Save changes'")
                print_info("\n✅ You can still continue - we'll try to send SMS anyway")
                response = {'attributes': {}}
            else:
                raise
        
        print_success("AWS credentials are valid!")
        
        # Show SMS attributes if available
        attributes = response.get('attributes', {})
        if attributes:
            print_info("SMS Settings:")
            for key, value in attributes.items():
                print(f"   - {key}: {value}")
        
        return sns_client
        
    except NoCredentialsError:
        print_error("AWS credentials not found!")
        print_info("Make sure to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        return None
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print_error(f"AWS Error: {error_code}")
        print_error(f"Message: {error_message}")
        return None
        
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        return None


def check_sms_spending_limit(sns_client):
    """Check SMS spending limit"""
    print_header("Step 2: Checking SMS Spending Limit")
    
    try:
        response = sns_client.get_sms_attributes()
        attributes = response.get('attributes', {})
        
        monthly_spend = attributes.get('MonthlySpendLimit', 'Not set')
        print_info(f"Monthly spending limit: ${monthly_spend}")
        
        if monthly_spend == '1.00' or monthly_spend == 'Not set':
            print_info("⚠️  Default limit is $1/month (sandbox mode)")
            print_info("To increase limit:")
            print_info("1. Go to AWS SNS Console")
            print_info("2. Click 'Text messaging (SMS)' → 'Account spend limit'")
            print_info("3. Request limit increase")
            
        return True
        
    except Exception as e:
        print_error(f"Could not check spending limit: {str(e)}")
        return False


def send_test_sms(sns_client, phone_number, message):
    """Send a test SMS"""
    print_header("Step 3: Sending Test SMS")
    
    print_info(f"Sending to: {phone_number}")
    print_info(f"Message: {message}")
    
    try:
        # Try with message attributes first
        response = sns_client.publish(
            PhoneNumber=phone_number,
            Message=message,
            MessageAttributes={
                'AWS.SNS.SMS.SMSType': {
                    'DataType': 'String',
                    'StringValue': 'Transactional'  # Or 'Promotional'
                }
            }
        )
        
        message_id = response.get('MessageId')
        print_success(f"SMS sent successfully!")
        print_info(f"Message ID: {message_id}")
        print_info("Check your phone for the message")
        
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        
        print_error(f"Failed to send SMS: {error_code}")
        print_error(f"Message: {error_message}")
        
        # Common error messages
        if error_code == 'InvalidParameter':
            print_info("💡 Common causes:")
            print_info("   - Phone number format must be E.164 (+1234567890)")
            print_info("   - Number might not be verified (sandbox mode)")
            
        elif error_code == 'OptedOut':
            print_error("This phone number has opted out of SMS messages")
            
        elif error_code == 'Throttling':
            print_error("Rate limit exceeded. Try again in a moment")
            
        return False
        
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        return False


def verify_phone_number(sns_client, phone_number):
    """Verify a phone number (for sandbox mode)"""
    print_header("Optional: Verify Phone Number")
    
    print_info("In sandbox mode, you need to verify phone numbers before sending")
    print_info(f"Attempting to create verification request for: {phone_number}")
    
    try:
        # Try to verify the phone number
        response = sns_client.create_sms_sandbox_phone_number(
            PhoneNumber=phone_number,
            LanguageCode='en-US'
        )
        
        print_success("Verification request created!")
        print_info("Check your phone for a verification code")
        print_info("You'll need to enter it in AWS Console or via API")
        
        verification_code = input("\n📱 Enter the verification code from SMS (or press Enter to skip): ").strip()
        
        if verification_code:
            verify_response = sns_client.verify_sms_sandbox_phone_number(
                PhoneNumber=phone_number,
                OneTimePassword=verification_code
            )
            print_success("Phone number verified!")
            return True
        else:
            print_info("Skipped verification. Verify manually in AWS Console.")
            return False
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        
        if error_code == 'InvalidParameter':
            print_info("Phone might already be verified or verification not needed")
            return True
        else:
            print_error(f"Verification error: {e.response['Error']['Message']}")
            return False
            
    except Exception as e:
        print_info(f"Could not verify: {str(e)}")
        print_info("You may need to verify manually in AWS Console")
        return False


def check_sandbox_status(sns_client):
    """Check if account is in sandbox mode"""
    print_header("Checking Sandbox Status")
    
    try:
        # Try to list sandbox phone numbers
        response = sns_client.list_sms_sandbox_phone_numbers()
        
        phone_numbers = response.get('PhoneNumbers', [])
        
        if phone_numbers:
            print_info("⚠️  Account is in SANDBOX mode")
            print_info("You can only send SMS to verified phone numbers:")
            for phone in phone_numbers:
                status = phone.get('Status', 'Unknown')
                number = phone.get('PhoneNumber', 'Unknown')
                print(f"   - {number}: {status}")
            
            print_info("\n💡 To exit sandbox mode:")
            print_info("1. Go to AWS SNS Console")
            print_info("2. Navigate to 'Text messaging (SMS)'")
            print_info("3. Click 'Move to production'")
            print_info("4. Submit request (usually approved quickly)")
            
            return True  # In sandbox
        else:
            print_success("Account is in PRODUCTION mode!")
            print_info("You can send SMS to any number")
            return False  # Not in sandbox
            
    except Exception as e:
        # If we can't check, assume not in sandbox
        print_info("Could not determine sandbox status")
        print_info("Assuming production mode")
        return False


def main():
    """Main test function"""
    print_header("AWS SNS SMS Test Script")
    print_info("This script will test AWS SNS SMS functionality")
    print_info("Make sure you have:")
    print_info("  1. AWS Account created")
    print_info("  2. AWS Access Key ID and Secret Access Key")
    print_info("  3. Phone number to test with")
    
    # Get credentials from user
    print("\n" + "-" * 60)
    access_key = input("Enter AWS Access Key ID: ").strip()
    secret_key = input("Enter AWS Secret Access Key: ").strip()
    region = input("Enter AWS Region (default: us-east-1): ").strip() or "us-east-1"
    phone_number = input("Enter phone number to test (+1234567890): ").strip()
    
    if not access_key or not secret_key or not phone_number:
        print_error("Missing required information!")
        sys.exit(1)
    
    # Validate phone format
    if not phone_number.startswith('+'):
        print_error("Phone number must start with + (E.164 format)")
        print_info("Example: +12345678901")
        sys.exit(1)
    
    # Test credentials
    sns_client = test_aws_credentials(access_key, secret_key, region)
    if not sns_client:
        print_error("\nTest failed: Invalid credentials")
        sys.exit(1)
    
    # Check sandbox status
    is_sandbox = check_sandbox_status(sns_client)
    
    # Check spending limit
    check_sms_spending_limit(sns_client)
    
    # If in sandbox, try to verify phone
    if is_sandbox:
        verify_choice = input("\n📱 Verify this phone number now? (y/n): ").strip().lower()
        if verify_choice == 'y':
            verify_phone_number(sns_client, phone_number)
    
    # Ask to send test SMS
    print("\n" + "-" * 60)
    send_choice = input("📤 Send test SMS now? (y/n): ").strip().lower()
    
    if send_choice != 'y':
        print_info("Test cancelled. No SMS sent.")
        return
    
    # Custom message or default
    use_custom = input("Use custom message? (y/n, default: n): ").strip().lower()
    if use_custom == 'y':
        message = input("Enter message: ").strip()
    else:
        message = "Test SMS from AWS SNS! Your OTP code is: 123456"
    
    # Send test SMS
    success = send_test_sms(sns_client, phone_number, message)
    
    # Summary
    print_header("Test Summary")
    if success:
        print_success("All tests passed! AWS SNS is working correctly")
        print_info("\n✅ Next steps:")
        print_info("1. Add credentials to .env.local:")
        print_info("   AWS_ACCESS_KEY_ID=your_access_key")
        print_info("   AWS_SECRET_ACCESS_KEY=your_secret_key")
        print_info("   AWS_REGION=us-east-1")
        print_info("   SMS_PROVIDER=aws_sns")
        print_info("\n2. I'll update the SMS service to use AWS SNS")
        print_info("3. Test with your application")
    else:
        print_error("Test failed. Check errors above")
        print_info("\n💡 Common issues:")
        print_info("1. Phone number not verified (sandbox mode)")
        print_info("2. Spending limit too low ($1 default)")
        print_info("3. Wrong phone format (must be +1234567890)")
        print_info("4. Account still in sandbox mode")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Test cancelled by user")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        sys.exit(1)
