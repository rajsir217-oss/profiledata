import os
import sys
import compileall

def check_syntax(directory):
    print(f"Checking syntax in {directory}...")
    success = compileall.compile_dir(directory, quiet=1, force=True)
    if success:
        print("✅ Syntax check passed.")
    else:
        print("❌ Syntax check failed.")
        sys.exit(1)

if __name__ == "__main__":
    check_syntax("fastapi_backend")
