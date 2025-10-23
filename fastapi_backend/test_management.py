"""
Test Management API endpoints for the ProfileData application.
Provides functionality to run tests, view results, and monitor test execution.
"""
import asyncio
import json
import subprocess
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
import os
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
import uuid
# import schedule  # No longer needed - using UnifiedScheduler
import threading

router = APIRouter()

# Test results storage
TEST_RESULTS_DIR = Path("test_results")
TEST_RESULTS_DIR.mkdir(exist_ok=True)

# Test schedules storage
TEST_SCHEDULES_DIR = Path("test_schedules")
TEST_SCHEDULES_DIR.mkdir(exist_ok=True)

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

class TestSchedule(BaseModel):
    """Model for test schedule information."""
    id: Optional[str] = None
    name: str
    testType: str  # "frontend", "backend", "all"
    schedule: str  # "hourly", "daily", "weekly", "custom"
    time: str  # "HH:MM" format
    daysOfWeek: Optional[List[str]] = []
    enabled: bool = True
    description: Optional[str] = ""
    lastRun: Optional[str] = None
    nextRun: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

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

# ============== Test Scheduling Endpoints ==============

def load_test_schedules() -> List[TestSchedule]:
    """Load test schedules from storage."""
    schedules = []
    if TEST_SCHEDULES_DIR.exists():
        for schedule_file in TEST_SCHEDULES_DIR.glob("*.json"):
            try:
                with open(schedule_file, 'r') as f:
                    data = json.load(f)
                    schedules.append(TestSchedule(**data))
            except Exception as e:
                print(f"Error loading schedule {schedule_file}: {e}")
                continue
    return schedules

def save_test_schedule(schedule: TestSchedule):
    """Save test schedule to storage."""
    schedule_file = TEST_SCHEDULES_DIR / f"{schedule.id}.json"
    with open(schedule_file, 'w') as f:
        json.dump(schedule.dict(), f, indent=2)

def delete_test_schedule_file(schedule_id: str):
    """Delete test schedule file from storage."""
    schedule_file = TEST_SCHEDULES_DIR / f"{schedule_id}.json"
    if schedule_file.exists():
        schedule_file.unlink()

@router.get("/scheduled-tests")
async def get_scheduled_tests():
    """Get all scheduled tests."""
    return load_test_schedules()

@router.get("/scheduler-status")
async def get_scheduler_status():
    """Get the status of the test scheduler."""
    global scheduler_thread, scheduler_running
    
    schedules = load_test_schedules()
    enabled_schedules = [s for s in schedules if s.enabled]
    
    return {
        "scheduler_running": scheduler_running,
        "thread_alive": scheduler_thread.is_alive() if scheduler_thread else False,
        "total_schedules": len(schedules),
        "enabled_schedules": len(enabled_schedules),
        "current_time": datetime.now().isoformat(),
        "schedules": [
            {
                "name": s.name,
                "test_type": s.testType,
                "schedule": s.schedule,
                "time": s.time,
                "enabled": s.enabled,
                "last_run": s.lastRun,
                "next_run": s.nextRun
            }
            for s in schedules
        ]
    }

@router.post("/scheduled-tests")
async def create_schedule(schedule: TestSchedule):
    """Create a new test schedule."""
    # Generate unique ID
    schedule.id = str(uuid.uuid4())
    schedule.createdAt = datetime.now().isoformat()
    schedule.updatedAt = datetime.now().isoformat()
    
    # Calculate next run time (simplified - would need proper scheduling logic)
    if schedule.enabled:
        # For now, just set next run to tomorrow at the specified time
        from datetime import timedelta
        next_run_date = datetime.now() + timedelta(days=1)
        schedule.nextRun = f"{next_run_date.strftime('%Y-%m-%d')} {schedule.time}"
    
    # Save to storage
    save_test_schedule(schedule)
    
    return schedule

@router.put("/scheduled-tests/{schedule_id}")
async def update_schedule(schedule_id: str, schedule: TestSchedule):
    """Update an existing test schedule."""
    # Load existing schedules
    schedules = load_test_schedules()
    
    # Find the schedule to update
    existing_schedule = None
    for s in schedules:
        if s.id == schedule_id:
            existing_schedule = s
            break
    
    if not existing_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Update the schedule
    schedule.id = schedule_id
    schedule.updatedAt = datetime.now().isoformat()
    
    # Keep the original creation date
    if existing_schedule.createdAt:
        schedule.createdAt = existing_schedule.createdAt
    
    # Calculate next run time if enabled
    if schedule.enabled:
        from datetime import timedelta
        next_run_date = datetime.now() + timedelta(days=1)
        schedule.nextRun = f"{next_run_date.strftime('%Y-%m-%d')} {schedule.time}"
    else:
        schedule.nextRun = None
    
    # Save to storage
    save_test_schedule(schedule)
    
    return schedule

@router.delete("/scheduled-tests/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a test schedule."""
    # Load existing schedules
    schedules = load_test_schedules()
    
    # Check if schedule exists
    schedule_exists = False
    for s in schedules:
        if s.id == schedule_id:
            schedule_exists = True
            break
    
    if not schedule_exists:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Delete from storage
    delete_test_schedule_file(schedule_id)
    
    return {"message": "Schedule deleted successfully"}

@router.post("/scheduled-tests/{schedule_id}/run-now")
async def run_schedule_now(schedule_id: str, background_tasks: BackgroundTasks):
    """Manually trigger a scheduled test to run immediately."""
    # Load existing schedules
    schedules = load_test_schedules()
    
    # Find the schedule
    target_schedule = None
    for s in schedules:
        if s.id == schedule_id:
            target_schedule = s
            break
    
    if not target_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if not target_schedule.enabled:
        raise HTTPException(status_code=400, detail="Schedule is disabled")
    
    # Create test ID
    test_id = f"manual_{target_schedule.testType}_{int(time.time())}"
    
    # Create initial test result
    initial_result = TestResult(
        id=test_id,
        timestamp=datetime.now().isoformat(),
        test_type=target_schedule.testType,
        status="running"
    )
    
    test_results[test_id] = initial_result
    
    # Run tests in background
    background_tasks.add_task(run_tests_background, target_schedule.testType, test_id)
    
    # Update last run time
    target_schedule.lastRun = datetime.now().isoformat()
    save_test_schedule(target_schedule)
    
    return {
        "message": f"Test schedule '{target_schedule.name}' triggered manually",
        "test_id": test_id,
        "status": "started"
    }

# ============== Test Scheduler Background Task ==============

scheduler_thread = None
scheduler_running = False

def check_and_run_scheduled_tests():
    """Check for scheduled tests and run them if it's time."""
    try:
        schedules = load_test_schedules()
        current_time = datetime.now()
        
        for schedule in schedules:
            if not schedule.enabled:
                continue
                
            # Parse the schedule time
            try:
                schedule_hour, schedule_minute = map(int, schedule.time.split(':'))
                
                # Check if we should run based on schedule type
                should_run = False
                
                if schedule.schedule == "hourly":
                    # Run if we're at the right minute
                    if current_time.minute == schedule_minute:
                        should_run = True
                        
                elif schedule.schedule == "daily":
                    # Run if we're at the right time
                    if current_time.hour == schedule_hour and current_time.minute == schedule_minute:
                        should_run = True
                        
                elif schedule.schedule == "weekly":
                    # Run if it's the right day and time
                    current_day = current_time.strftime('%A')
                    if current_day in (schedule.daysOfWeek or []) and \
                       current_time.hour == schedule_hour and \
                       current_time.minute == schedule_minute:
                        should_run = True
                        
                elif schedule.schedule == "custom" and schedule.daysOfWeek:
                    # Run if it's one of the selected days and right time
                    current_day = current_time.strftime('%A')
                    if current_day in schedule.daysOfWeek and \
                       current_time.hour == schedule_hour and \
                       current_time.minute == schedule_minute:
                        should_run = True
                
                if should_run:
                    # Check if we haven't run in the last minute (to avoid duplicates)
                    if schedule.lastRun:
                        try:
                            last_run_time = datetime.fromisoformat(schedule.lastRun)
                            if (current_time - last_run_time).total_seconds() < 60:
                                continue  # Already ran within the last minute
                        except:
                            pass
                    
                    # Run the test
                    print(f"Running scheduled test: {schedule.name} ({schedule.testType})")
                    
                    test_id = f"scheduled_{schedule.testType}_{int(time.time())}"
                    
                    # Create initial test result
                    initial_result = TestResult(
                        id=test_id,
                        timestamp=datetime.now().isoformat(),
                        test_type=schedule.testType,
                        status="running"
                    )
                    
                    test_results[test_id] = initial_result
                    
                    # Run tests in a separate thread
                    test_thread = threading.Thread(
                        target=run_tests_background,
                        args=(schedule.testType, test_id)
                    )
                    test_thread.start()
                    
                    # Update schedule's last run time
                    schedule.lastRun = current_time.isoformat()
                    
                    # Calculate next run time
                    if schedule.schedule == "hourly":
                        schedule.nextRun = (current_time + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M')
                    elif schedule.schedule == "daily":
                        schedule.nextRun = (current_time + timedelta(days=1)).strftime('%Y-%m-%d %H:%M')
                    elif schedule.schedule == "weekly":
                        schedule.nextRun = (current_time + timedelta(weeks=1)).strftime('%Y-%m-%d %H:%M')
                    
                    save_test_schedule(schedule)
                    
            except Exception as e:
                print(f"Error processing schedule {schedule.name}: {e}")
                continue
                
    except Exception as e:
        print(f"Error in scheduler: {e}")

def run_scheduler():
    """
    DEPRECATED: This function is no longer used.
    Test scheduling is now handled by the UnifiedScheduler in unified_scheduler.py
    
    The UnifiedScheduler automatically calls check_and_run_scheduled_tests()
    every minute as a registered job.
    """
    pass

def start_scheduler():
    """
    DEPRECATED: This function is no longer used.
    Test scheduling is now handled by the UnifiedScheduler in unified_scheduler.py
    
    No need to start a separate scheduler thread. The UnifiedScheduler handles
    all background jobs including test scheduling.
    """
    pass

def stop_scheduler():
    """
    DEPRECATED: This function is no longer used.
    Test scheduling is now handled by the UnifiedScheduler in unified_scheduler.py
    """
    pass

# NOTE: Scheduler initialization removed - now handled by UnifiedScheduler
# The UnifiedScheduler in unified_scheduler.py automatically registers and runs
# the check_and_run_scheduled_tests() function every minute.
# This ensures we have only ONE scheduler engine throughout the application.
