"""
Job Registry for Scheduled SMS Jobs
===================================
Central registry for all scheduled jobs that send SMS notifications.
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Import all job templates
from .daily_matches_job import register_daily_matches_job
from .conversation_cold_job import register_conversation_cold_job
from .subscription_monitor_job import register_subscription_monitor_job
from .login_reminder_job import register_login_reminder_job
from .profile_completion_job import register_profile_completion_job


class JobRegistry:
    """Central registry for all scheduled jobs"""
    
    def __init__(self):
        self.jobs = {}
        self._register_all_jobs()
    
    def _register_all_jobs(self):
        """Register all available jobs"""
        
        # Phase 2: Recurring notification jobs
        try:
            self.register_job(register_daily_matches_job())
            logger.info("✅ Registered daily_matches job")
        except Exception as e:
            logger.error(f"❌ Failed to register daily_matches job: {e}")
        
        try:
            self.register_job(register_conversation_cold_job())
            logger.info("✅ Registered conversation_cold job")
        except Exception as e:
            logger.error(f"❌ Failed to register conversation_cold job: {e}")
        
        try:
            self.register_job(register_subscription_monitor_job())
            logger.info("✅ Registered subscription_monitor job")
        except Exception as e:
            logger.error(f"❌ Failed to register_subscription_monitor job: {e}")
        
        try:
            self.register_job(register_login_reminder_job())
            logger.info("✅ Registered login_reminder job")
        except Exception as e:
            logger.error(f"❌ Failed to register login_reminder job: {e}")
        
        try:
            self.register_job(register_profile_completion_job())
            logger.info("✅ Registered profile_completion job")
        except Exception as e:
            logger.error(f"❌ Failed to register profile_completion job: {e}")
    
    def register_job(self, job_config: Dict[str, Any]):
        """Register a job configuration"""
        job_name = job_config["name"]
        self.jobs[job_name] = job_config
    
    def get_job(self, job_name: str) -> Dict[str, Any]:
        """Get job configuration by name"""
        return self.jobs.get(job_name)
    
    def get_all_jobs(self) -> Dict[str, Dict[str, Any]]:
        """Get all registered jobs"""
        return self.jobs.copy()
    
    def get_enabled_jobs(self) -> Dict[str, Dict[str, Any]]:
        """Get only enabled jobs"""
        return {name: config for name, config in self.jobs.items() if config.get("enabled", True)}
    
    def get_jobs_by_category(self, category: str) -> Dict[str, Dict[str, Any]]:
        """Get jobs by category"""
        return {
            name: config 
            for name, config in self.items() 
            if config.get("category") == category
        }
    
    def enable_job(self, job_name: str):
        """Enable a job"""
        if job_name in self.jobs:
            self.jobs[job_name]["enabled"] = True
            logger.info(f"✅ Enabled job: {job_name}")
        else:
            logger.warning(f"⚠️ Job not found: {job_name}")
    
    def disable_job(self, job_name: str):
        """Disable a job"""
        if job_name in self.jobs:
            self.jobs[job_name]["enabled"] = False
            logger.info(f"🚫 Disabled job: {job_name}")
        else:
            logger.warning(f"⚠️ Job not found: {job_name}")
    
    def update_job_schedule(self, job_name: str, schedule: str):
        """Update job schedule"""
        if job_name in self.jobs:
            self.jobs[job_name]["schedule"] = schedule
            logger.info(f"⏰ Updated schedule for {job_name}: {schedule}")
        else:
            logger.warning(f"⚠️ Job not found: {job_name}")
    
    def print_job_summary(self):
        """Print summary of all registered jobs"""
        print("\n" + "=" * 80)
        print("REGISTERED SMS NOTIFICATION JOBS")
        print("=" * 80)
        
        categories = {}
        for name, config in self.get_enabled_jobs().items():
            category = config.get("category", "other")
            if category not in categories:
                categories[category] = []
            categories[category].append((name, config))
        
        for category, jobs in sorted(categories.items()):
            print(f"\n📂 {category.upper()} ({len(jobs)} jobs):")
            print("-" * 40)
            
            for name, config in sorted(jobs):
                status = "✅" if config.get("enabled", True) else "❌"
                schedule = config.get("schedule", "Not scheduled")
                description = config.get("description", "No description")
                
                print(f"   {status} {name}")
                print(f"      📅 Schedule: {schedule}")
                print(f"      📝 {description}")
        
        print(f"\n📊 Total jobs: {len(self.get_enabled_jobs())}")
        print("=" * 80)


# Global job registry instance
job_registry = JobRegistry()


def get_job_registry() -> JobRegistry:
    """Get the global job registry instance"""
    return job_registry


def register_all_sms_jobs():
    """Register all SMS jobs with the job scheduler"""
    registry = get_job_registry()
    
    print("🚀 Registering SMS notification jobs...")
    registry.print_job_summary()
    
    # Return the registry for integration with scheduler
    return registry


if __name__ == "__main__":
    # Test the job registry
    registry = register_all_sms_jobs()
    
    # Test enabling/disabling jobs
    print("\n🧪 Testing job management...")
    registry.disable_job("daily_matches")
    registry.enable_job("daily_matches")
    registry.update_job_schedule("login_reminder", "0 9 * * 1")
