"""
Test Management API endpoints for the ProfileData application.
Provides functionality to run tests, view results, and monitor test execution.
"""
import asyncio
import json
import subprocess
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

router = APIRouter()

# Test results storage
TEST_RESULTS_DIR = Path("test_results")
TEST_RESULTS_DIR.mkdir(exist_ok=True)

class TestResult(BaseModel):
    """Model for storing test execution results."""
    id: str
    timestamp: str
    test_type: str  # "frontend", "backend", "all"
    status: str  # "running", "passed", "failed"
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    duration: float = 0.0
    output: str = ""
    error: str = ""

class TestSuite(BaseModel):
    """Model for test suite information."""
    name: str
    description: str
    type: str  # "frontend", "backend"
    command: str
    last_run: Optional[str] = None
    last_status: Optional[str] = None

# Global test execution tracking
current_test_process = None
test_results: Dict[str, TestResult] = {}

def load_test_results() -> Dict[str, TestResult]:
    """Load test results from storage."""
    results = {}
    if TEST_RESULTS_DIR.exists():
        for result_file in TEST_RESULTS_DIR.glob("*.json"):
            try:
                with open(result_file, 'r') as f:
                    data = json.load(f)
                    results[data["id"]] = TestResult(**data)
            except Exception:
                continue
    return results

def save_test_result(result: TestResult):
    """Save test result to storage."""
    result_file = TEST_RESULTS_DIR / f"{result.id}.json"
    with open(result_file, 'w') as f:
        json.dump(result.dict(), f, indent=2)

def run_tests_background(test_type: str, test_id: str):
    """Run tests in background and update results."""
    global current_test_process

    try:
        # Update status to running
        test_results[test_id].status = "running"
        save_test_result(test_results[test_id])

        start_time = time.time()

        # Get the correct working directories
        script_dir = Path(__file__).parent.parent  # Go up from fastapi_backend to project root

        if test_type == "frontend":
            command = ["npm", "test", "--", "--watchAll=false", "--passWithNoTests"]
            cwd = script_dir / "frontend"
        elif test_type == "backend":
            command = ["python3", "-m", "pytest", "tests/", "-q"]
            cwd = script_dir / "fastapi_backend"
        else:  # all
            # Run both frontend and backend tests
            frontend_result = run_single_test_suite("frontend", script_dir)
            backend_result = run_single_test_suite("backend", script_dir)

            # Combine results
            total_duration = time.time() - start_time
            combined_result = TestResult(
                id=test_id,
                timestamp=datetime.now().isoformat(),
                test_type="all",
                status="completed",
                total_tests=frontend_result.get("total_tests", 0) + backend_result.get("total_tests", 0),
                passed_tests=frontend_result.get("passed_tests", 0) + backend_result.get("passed_tests", 0),
                failed_tests=frontend_result.get("failed_tests", 0) + backend_result.get("failed_tests", 0),
                duration=total_duration,
                output=f"Frontend: {frontend_result.get('output', '')}\nBackend: {backend_result.get('output', '')}",
            )
            test_results[test_id] = combined_result
            save_test_result(combined_result)
            return

        # Initialize variables
        output = ""
        exit_code = 0
        stdout = ""
        stderr = ""

        # Run the test command
        current_test_process = subprocess.Popen(
            command,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Wait for completion and capture output
        stdout, stderr = current_test_process.communicate()

        end_time = time.time()
        duration = end_time - start_time

        # Parse results - improved parsing for better accuracy
        output = stdout + stderr
        exit_code = current_test_process.returncode

        total_tests = 0
        passed_tests = 0
        failed_tests = 0

        if "Test Suites:" in output:
            # Frontend test format - improved parsing
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                if "Test Suites:" in line:
                    # Format: "Test Suites: 4 passed, 4 total"
                    parts = line.split(',')
                    if len(parts) >= 2:
                        # Extract passed suites
                        passed_part = parts[0].strip()
                        passed_suites = passed_part.split()[-1] if len(passed_part.split()) > 0 else "0"

                        # Extract total suites
                        total_part = parts[1].strip()
                        total_suites = total_part.split()[-1] if len(total_part.split()) > 0 else "0"

                        try:
                            passed_tests = int(passed_suites) if passed_suites.isdigit() else 0
                            total_tests = int(total_suites) if total_suites.isdigit() else 0
                            failed_tests = total_tests - passed_tests
                        except ValueError:
                            pass
                    break

        if "Tests:" in output:
            # More detailed parsing for Tests line
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                if "Tests:" in line and ("passed" in line or "failed" in line):
                    # Format: "Tests: 16 passed, 16 total" or similar
                    parts = line.split(',')
                    if len(parts) >= 2:
                        # Extract passed tests
                        passed_part = parts[0].strip()
                        if "passed" in passed_part:
                            passed_value = passed_part.split()[-1] if len(passed_part.split()) > 0 else "0"
                            try:
                                passed_tests = int(passed_value) if passed_value.isdigit() else 0
                            except ValueError:
                                pass

                        # Extract total tests
                        total_part = parts[1].strip()
                        if "total" in total_part:
                            total_value = total_part.split()[-1] if len(total_part.split()) > 0 else "0"
                            try:
                                total_tests = int(total_value) if total_value.isdigit() else 0
                            except ValueError:
                                pass

                        failed_tests = total_tests - passed_tests
                    break
        else:
            # Backend test format
            for line in output.split('\n'):
                if "passed" in line and "failed" in line:
                    parts = line.split(',')
                    for part in parts:
                        if "passed" in part:
                            passed_tests = int(part.strip().split()[0])
                        elif "failed" in part:
                            failed_tests = int(part.strip().split()[0])
                    total_tests = passed_tests + failed_tests
                    break

        status = "passed" if exit_code == 0 else "failed"

        result = TestResult(
            id=test_id,
            timestamp=datetime.now().isoformat(),
            test_type=test_type,
            status=status,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            duration=duration,
            output=output,
            error=stderr if exit_code != 0 else ""
        )

        test_results[test_id] = result
        save_test_result(result)

    except Exception as e:
        # Handle errors
        end_time = time.time()
        duration = end_time - start_time

        error_result = TestResult(
            id=test_id,
            timestamp=datetime.now().isoformat(),
            test_type=test_type,
            status="failed",
            duration=duration,
            error=str(e)
        )

        test_results[test_id] = error_result
        save_test_result(error_result)

    finally:
        current_test_process = None

def run_single_test_suite(test_type: str, script_dir: Path) -> Dict:
    """Run a single test suite and return results."""
    try:
        if test_type == "frontend":
            command = ["npm", "test", "--", "--watchAll=false", "--passWithNoTests"]
            cwd = script_dir / "frontend"
        else:
            command = ["python3", "-m", "pytest", "tests/", "-q"]
            cwd = script_dir / "fastapi_backend"

        process = subprocess.Popen(
            command,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        stdout, stderr = process.communicate()
        output = stdout + stderr
        exit_code = process.returncode

        # Parse results - improved parsing for better accuracy
        total_tests = 0
        passed_tests = 0
        failed_tests = 0

        if "Test Suites:" in output:
            # Frontend test format - improved parsing
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                if "Test Suites:" in line:
                    # Format: "Test Suites: 4 passed, 4 total"
                    parts = line.split(',')
                    if len(parts) >= 2:
                        # Extract passed suites
                        passed_part = parts[0].strip()
                        passed_suites = passed_part.split()[-1] if len(passed_part.split()) > 0 else "0"

                        # Extract total suites
                        total_part = parts[1].strip()
                        total_suites = total_part.split()[-1] if len(total_part.split()) > 0 else "0"

                        try:
                            passed_tests = int(passed_suites) if passed_suites.isdigit() else 0
                            total_tests = int(total_suites) if total_suites.isdigit() else 0
                            failed_tests = total_tests - passed_tests
                        except ValueError:
                            pass
                    break

        if "Tests:" in output:
            # More detailed parsing for Tests line
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                if "Tests:" in line and ("passed" in line or "failed" in line):
                    # Format: "Tests: 16 passed, 16 total" or similar
                    parts = line.split(',')
                    if len(parts) >= 2:
                        # Extract passed tests
                        passed_part = parts[0].strip()
                        if "passed" in passed_part:
                            passed_value = passed_part.split()[-1] if len(passed_part.split()) > 0 else "0"
                            try:
                                passed_tests = int(passed_value) if passed_value.isdigit() else 0
                            except ValueError:
                                pass

                        # Extract total tests
                        total_part = parts[1].strip()
                        if "total" in total_part:
                            total_value = total_part.split()[-1] if len(total_part.split()) > 0 else "0"
                            try:
                                total_tests = int(total_value) if total_value.isdigit() else 0
                            except ValueError:
                                pass

                        failed_tests = total_tests - passed_tests
                    break
        else:
            # Backend test format
            for line in output.split('\n'):
                if "passed" in line and "failed" in line:
                    parts = line.split(',')
                    for part in parts:
                        if "passed" in part:
                            passed_tests = int(part.strip().split()[0])
                        elif "failed" in part:
                            failed_tests = int(part.strip().split()[0])
                    total_tests = passed_tests + failed_tests
                    break

        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "output": output,
            "error": stderr if exit_code != 0 else "",
            "exit_code": exit_code
        }

    except Exception as e:
        return {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "output": "",
            "error": str(e),
            "exit_code": 1
        }

@router.get("/test-suites")
async def get_test_suites():
    """Get available test suites."""
    return [
        TestSuite(
            name="Frontend Tests",
            description="React component and integration tests",
            type="frontend",
            command="npm test -- --watchAll=false --passWithNoTests",
            last_run=None,
            last_status=None
        ),
        TestSuite(
            name="Backend Tests",
            description="FastAPI unit and integration tests",
            type="backend",
            command="python3 -m pytest tests/ -q",
            last_run=None,
            last_status=None
        ),
        TestSuite(
            name="All Tests",
            description="Complete test suite (frontend + backend)",
            type="all",
            command="Run both frontend and backend tests",
            last_run=None,
            last_status=None
        )
    ]

@router.get("/test-results")
async def get_test_results():
    """Get all test execution results."""
    return load_test_results()

@router.get("/test-results/{test_id}")
async def get_test_result(test_id: str):
    """Get specific test result."""
    results = load_test_results()
    if test_id not in results:
        raise HTTPException(status_code=404, detail="Test result not found")
    return results[test_id]

@router.post("/run-tests/{test_type}")
async def run_tests(test_type: str, background_tasks: BackgroundTasks):
    """Run specified test suite."""
    if test_type not in ["frontend", "backend", "all"]:
        raise HTTPException(status_code=400, detail="Invalid test type")

    test_id = f"{test_type}_{int(time.time())}"

    # Create initial test result
    initial_result = TestResult(
        id=test_id,
        timestamp=datetime.now().isoformat(),
        test_type=test_type,
        status="running"
    )

    test_results[test_id] = initial_result

    # Run tests in background
    background_tasks.add_task(run_tests_background, test_type, test_id)

    return {"test_id": test_id, "status": "started"}

@router.get("/test-status")
async def get_test_status():
    """Get current test execution status."""
    global current_test_process

    running_tests = []
    for test_id, result in test_results.items():
        if result.status == "running":
            running_tests.append({
                "test_id": test_id,
                "test_type": result.test_type,
                "start_time": result.timestamp
            })

    return {
        "is_running": current_test_process is not None,
        "running_tests": running_tests,
        "current_process": current_test_process.pid if current_test_process else None
    }

@router.delete("/test-results/{test_id}")
async def delete_test_result(test_id: str):
    """Delete specific test result."""
    results = load_test_results()
    if test_id not in results:
        raise HTTPException(status_code=404, detail="Test result not found")

    # Remove from memory
    if test_id in test_results:
        del test_results[test_id]

    # Remove from storage
    result_file = TEST_RESULTS_DIR / f"{test_id}.json"
    if result_file.exists():
        result_file.unlink()

    return {"message": "Test result deleted"}

@router.delete("/test-results")
async def clear_all_test_results():
    """Clear all test results."""
    # Clear memory
    test_results.clear()

    # Clear storage
    if TEST_RESULTS_DIR.exists():
        for result_file in TEST_RESULTS_DIR.glob("*.json"):
            result_file.unlink()

    return {"message": "All test results cleared"}
