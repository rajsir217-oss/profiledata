# Dynamic Scheduler Job Registry - Architecture Document

**Version:** 1.0  
**Date:** October 16, 2025  
**Status:** Design Phase  
**Author:** System Architecture Team

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Data Models](#data-models)
5. [API Design](#api-design)
6. [Security & Access Control](#security--access-control)
7. [Implementation Phases](#implementation-phases)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Logging](#monitoring--logging)
11. [Future Enhancements](#future-enhancements)

---

## 📖 Executive Summary

### Problem Statement
Currently, scheduler jobs are **hardcoded** in `unified_scheduler.py`. Adding new jobs requires:
- Modifying backend code
- Writing Python functions
- Redeploying the application
- Restarting the server

This makes it **inflexible** for admins to create custom scheduled tasks.

### Proposed Solution
Build a **Dynamic Job Registry System** that allows admins to:
- Define jobs through UI/API
- Choose from pre-built job templates
- Schedule jobs with cron-like expressions
- Monitor job execution history
- Manage job lifecycles without code deployment

### Key Benefits
- ✅ **No Code Deployment** - Add jobs via admin panel
- ✅ **Flexibility** - Schedule any pre-defined task type
- ✅ **Auditability** - Full history of job executions
- ✅ **Scalability** - Easy to add new job types
- ✅ **Safety** - Sandboxed execution with validation

---

## 🔍 Current System Analysis

### Current Architecture

```
unified_scheduler.py (Startup)
    ↓
initialize_unified_scheduler()
    ↓
Hardcoded Jobs:
    - data_cleanup (3600s)
    - test_scheduler (60s)
    - auto_delete_resolved_tickets (86400s)
    ↓
UnifiedScheduler.start() → Runs jobs in loop
```

### Limitations

1. **Static Configuration**: All jobs defined in code
2. **No Runtime Changes**: Can't add/modify jobs without restart
3. **Limited Job Types**: Only 3 predefined jobs
4. **No Templates**: Each job requires custom Python code
5. **Poor Visibility**: No execution history stored
6. **Maintenance Burden**: Every new job = code change

---

## 🏗️ Proposed Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Admin UI Layer                          │
│  (Job Definition Forms, Template Selection, Monitoring)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    REST API Layer                            │
│  POST /scheduler-jobs  GET /scheduler-jobs                  │
│  PUT /scheduler-jobs/:id  DELETE /scheduler-jobs/:id        │
│  POST /scheduler-jobs/:id/run                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Job Registry Service                         │
│  - Validates job definitions                                 │
│  - Manages job lifecycle                                     │
│  - Stores in database                                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Job Executor Engine                          │
│  - Loads job templates                                       │
│  - Executes with parameters                                  │
│  - Logs results to database                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Job Template Library                          │
│  DatabaseCleanup, DataExport, EmailNotification,            │
│  ReportGeneration, BackupJob, WebhookTrigger               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Job Template Library
Pre-built, tested job types that can be instantiated with parameters.

```python
class JobTemplate(ABC):
    @abstractmethod
    async def execute(self, params: Dict[str, Any], db: Database) -> JobResult:
        """Execute the job with given parameters"""
        pass
    
    @abstractmethod
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters before execution"""
        pass
    
    @abstractmethod
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        pass
```

#### 2. Job Registry Service
Manages the lifecycle of dynamic jobs.

```python
class JobRegistryService:
    async def create_job(self, job_definition: JobDefinition) -> Job:
        """Create and register a new job"""
        
    async def update_job(self, job_id: str, updates: Dict) -> Job:
        """Update job configuration"""
        
    async def delete_job(self, job_id: str) -> bool:
        """Remove job from registry"""
        
    async def get_job(self, job_id: str) -> Job:
        """Retrieve job details"""
        
    async def list_jobs(self, filters: Dict) -> List[Job]:
        """List all jobs with filters"""
```

#### 3. Job Executor Engine
Executes jobs using templates and parameters.

```python
class JobExecutor:
    def __init__(self, template_registry: TemplateRegistry):
        self.templates = template_registry
        
    async def execute_job(self, job: Job) -> JobExecutionResult:
        """Execute a job and return result"""
        template = self.templates.get(job.template_type)
        
        # Validate parameters
        valid, error = template.validate_params(job.parameters)
        if not valid:
            return JobExecutionResult(status="failed", error=error)
        
        # Execute with timeout and error handling
        try:
            result = await asyncio.wait_for(
                template.execute(job.parameters, self.db),
                timeout=job.timeout_seconds
            )
            return result
        except Exception as e:
            return JobExecutionResult(status="failed", error=str(e))
```

---

## 📊 Data Models

### Database Collections

#### 1. `dynamic_jobs` Collection

```json
{
  "_id": "job_123",
  "name": "Weekly User Data Cleanup",
  "description": "Remove inactive users older than 6 months",
  "template_type": "database_cleanup",
  "parameters": {
    "collection": "users",
    "condition": {"lastActive": {"$lt": "6 months ago"}},
    "dryRun": false
  },
  "schedule": {
    "type": "cron",
    "expression": "0 2 * * 0",
    "timezone": "UTC"
  },
  "enabled": true,
  "timeout_seconds": 3600,
  "retry_policy": {
    "max_retries": 3,
    "retry_delay_seconds": 300
  },
  "notifications": {
    "on_success": ["admin@example.com"],
    "on_failure": ["admin@example.com", "ops@example.com"]
  },
  "created_by": "admin_user",
  "created_at": "2025-10-16T10:00:00Z",
  "updated_at": "2025-10-16T10:00:00Z",
  "last_run_at": "2025-10-16T09:00:00Z",
  "next_run_at": "2025-10-23T02:00:00Z",
  "version": 1
}
```

#### 2. `job_executions` Collection

```json
{
  "_id": "exec_456",
  "job_id": "job_123",
  "job_name": "Weekly User Data Cleanup",
  "template_type": "database_cleanup",
  "status": "success",
  "started_at": "2025-10-16T02:00:00Z",
  "completed_at": "2025-10-16T02:05:30Z",
  "duration_seconds": 330,
  "result": {
    "records_processed": 1523,
    "records_deleted": 42,
    "errors": 0
  },
  "error": null,
  "logs": [
    {"timestamp": "2025-10-16T02:00:01Z", "level": "INFO", "message": "Starting cleanup"},
    {"timestamp": "2025-10-16T02:05:30Z", "level": "INFO", "message": "Cleanup completed"}
  ],
  "triggered_by": "scheduler",
  "execution_host": "server-01"
}
```

#### 3. `job_templates` Collection (Metadata)

```json
{
  "_id": "database_cleanup",
  "name": "Database Cleanup",
  "description": "Remove old records from a database collection",
  "category": "maintenance",
  "icon": "🧹",
  "parameters_schema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "Collection name",
        "enum": ["users", "logs", "sessions", "messages"]
      },
      "condition": {
        "type": "object",
        "description": "MongoDB query condition"
      },
      "dryRun": {
        "type": "boolean",
        "description": "Preview changes without deleting",
        "default": true
      }
    },
    "required": ["collection", "condition"]
  },
  "estimated_duration": "5-30 minutes",
  "resource_usage": "low",
  "risk_level": "medium"
}
```

---

## 🔌 API Design

### REST Endpoints

#### Job Management

```
GET    /api/admin/scheduler-jobs
  Query: ?template_type=database_cleanup&enabled=true&page=1&limit=20
  Response: { jobs: [...], total: 42, page: 1, pages: 3 }

POST   /api/admin/scheduler-jobs
  Body: { name, description, template_type, parameters, schedule, ... }
  Response: { job: {...}, message: "Job created successfully" }

GET    /api/admin/scheduler-jobs/:id
  Response: { job: {...} }

PUT    /api/admin/scheduler-jobs/:id
  Body: { enabled: true, schedule: {...} }
  Response: { job: {...}, message: "Job updated" }

DELETE /api/admin/scheduler-jobs/:id
  Response: { message: "Job deleted" }

POST   /api/admin/scheduler-jobs/:id/run
  Response: { execution_id: "exec_789", message: "Job started" }
```

#### Job Templates

```
GET    /api/admin/job-templates
  Response: { templates: [...] }

GET    /api/admin/job-templates/:type
  Response: { template: {...}, schema: {...} }
```

#### Job Executions

```
GET    /api/admin/scheduler-jobs/:id/executions
  Query: ?status=failed&limit=50
  Response: { executions: [...], total: 123 }

GET    /api/admin/job-executions/:execution_id
  Response: { execution: {...}, logs: [...] }
```

---

## 🔒 Security & Access Control

### Access Levels

1. **Super Admin**
   - Create/edit/delete any job
   - Execute jobs manually
   - View all execution logs
   - Manage job templates

2. **Admin**
   - View all jobs
   - Execute non-destructive jobs
   - View execution logs

3. **User**
   - No access to scheduler management

### Security Measures

1. **Parameter Validation**
   ```python
   # Validate against JSON schema
   # Sanitize database queries
   # Prevent code injection
   ```

2. **Rate Limiting**
   ```python
   # Max 10 manual executions per hour per user
   # Max 100 jobs total per system
   ```

3. **Audit Logging**
   ```python
   # Log all job CRUD operations
   # Track who triggered manual executions
   # Record parameter changes
   ```

4. **Sandboxing**
   ```python
   # Execute jobs in isolated context
   # Timeout enforcement
   # Resource limits (CPU, memory)
   ```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic dynamic job infrastructure

- [ ] Create `JobTemplate` base class
- [ ] Build `JobRegistryService`
- [ ] Design database schema
- [ ] Implement 2-3 basic templates:
  - `DatabaseCleanupTemplate`
  - `EmailNotificationTemplate`
  - `DataExportTemplate`
- [ ] Add API endpoints for job CRUD
- [ ] Write unit tests

**Deliverables:**
- Working job registry service
- API endpoints for job management
- 3 working job templates

### Phase 2: Execution Engine (Week 3-4)
**Goal:** Execute dynamic jobs reliably

- [ ] Build `JobExecutor` engine
- [ ] Integrate with `UnifiedScheduler`
- [ ] Implement job execution logging
- [ ] Add retry mechanism
- [ ] Add timeout handling
- [ ] Create job execution history API
- [ ] Write integration tests

**Deliverables:**
- Jobs execute on schedule
- Execution history stored
- Error handling and retries

### Phase 3: UI/UX (Week 5-6)
**Goal:** User-friendly admin interface

- [ ] Job creation form with template selection
- [ ] Dynamic parameter forms (based on schema)
- [ ] Job list with filtering/search
- [ ] Job execution history viewer
- [ ] Manual execution button
- [ ] Job enable/disable toggle
- [ ] Validation and error messages

**Deliverables:**
- Complete admin UI for job management
- Intuitive job creation workflow
- Execution monitoring dashboard

### Phase 4: Advanced Features (Week 7-8)
**Goal:** Production-ready features

- [ ] Cron expression builder UI
- [ ] Job dependencies (Job A → Job B)
- [ ] Notification system (email on failure)
- [ ] Job cloning/duplication
- [ ] Export/import job definitions
- [ ] Performance monitoring
- [ ] Advanced templates:
  - `ReportGenerationTemplate`
  - `BackupTemplate`
  - `WebhookTriggerTemplate`

**Deliverables:**
- Production-ready scheduler system
- 6+ job templates
- Comprehensive documentation

### Phase 5: Migration & Deployment (Week 9)
**Goal:** Migrate existing jobs to new system

- [ ] Migration script for existing 3 jobs
- [ ] Backward compatibility layer
- [ ] Database migration
- [ ] Deployment plan
- [ ] Rollback procedure
- [ ] User training documentation

**Deliverables:**
- Zero-downtime migration
- All existing jobs migrated
- Production deployment complete

---

## 🔄 Migration Strategy

### Step 1: Parallel Operation
- New system runs alongside old system
- Existing hardcoded jobs remain active
- New jobs use dynamic system

### Step 2: Gradual Migration
```python
# Week 1: Migrate test_scheduler
template = TestSchedulerTemplate()
job = JobRegistry.create_job(
    name="test_scheduler",
    template_type="test_scheduler",
    schedule={"interval_seconds": 60}
)

# Week 2: Migrate data_cleanup
template = DatabaseCleanupTemplate()
job = JobRegistry.create_job(
    name="data_cleanup",
    template_type="database_cleanup",
    schedule={"interval_seconds": 3600}
)

# Week 3: Migrate auto_delete_resolved_tickets
template = TicketCleanupTemplate()
job = JobRegistry.create_job(
    name="auto_delete_resolved_tickets",
    template_type="ticket_cleanup",
    schedule={"cron": "0 19 * * *"}
)
```

### Step 3: Deprecation
- Remove hardcoded jobs from `unified_scheduler.py`
- Keep `UnifiedScheduler` class but load jobs from database
- Update documentation

---

## 🧪 Testing Strategy

### Unit Tests
```python
# Test job templates
def test_database_cleanup_template_validation():
    template = DatabaseCleanupTemplate()
    params = {"collection": "users", "condition": {...}}
    valid, error = template.validate_params(params)
    assert valid is True

# Test job registry
async def test_create_job():
    service = JobRegistryService(db)
    job = await service.create_job(job_definition)
    assert job.name == "Test Job"
```

### Integration Tests
```python
# Test end-to-end job execution
async def test_job_execution():
    # Create job
    job = await create_test_job()
    
    # Execute
    result = await executor.execute_job(job)
    
    # Verify
    assert result.status == "success"
    assert result.records_processed > 0
```

### Load Tests
```python
# Test with 100 concurrent jobs
# Verify no performance degradation
# Check memory/CPU usage
```

---

## 📊 Monitoring & Logging

### Metrics to Track

1. **Job Execution Metrics**
   - Success rate
   - Average execution time
   - Failure rate
   - Timeout rate

2. **System Health**
   - Active jobs count
   - Queue depth
   - Execution backlog
   - Resource usage

3. **Business Metrics**
   - Most used job templates
   - Jobs created per day
   - Failed executions per job

### Logging Strategy

```python
logger.info(f"Job '{job.name}' started", extra={
    "job_id": job.id,
    "template": job.template_type,
    "triggered_by": "scheduler"
})

logger.error(f"Job '{job.name}' failed", extra={
    "job_id": job.id,
    "error": str(e),
    "duration": elapsed_time
})
```

### Alerts

- Email notification on job failure
- Slack/Discord webhook for critical jobs
- Daily summary report to admins

---

## 🔮 Future Enhancements

### Phase 6+: Advanced Features

1. **Job Chaining**
   - Job A completes → automatically trigger Job B
   - Conditional execution based on results

2. **Custom Scripts**
   - Allow admins to write Python/Lua scripts
   - Sandboxed execution environment
   - Code review workflow

3. **Job Marketplace**
   - Share job templates across teams
   - Community-contributed templates
   - Template versioning

4. **AI-Powered Optimization**
   - Suggest optimal scheduling times
   - Predict job duration
   - Auto-tune parameters

5. **Multi-Tenant Support**
   - Jobs per organization
   - Resource quotas
   - Isolated execution

6. **Distributed Execution**
   - Run jobs across multiple servers
   - Load balancing
   - Failover support

---

## 📚 Documentation Deliverables

1. **Admin Guide**
   - How to create jobs
   - Template reference
   - Best practices

2. **Developer Guide**
   - How to add new templates
   - API reference
   - Architecture overview

3. **Operations Guide**
   - Deployment procedures
   - Monitoring setup
   - Troubleshooting

4. **Migration Guide**
   - Step-by-step migration
   - Rollback procedures
   - Compatibility notes

---

## 💡 Design Decisions & Rationale

### Why Job Templates Instead of Custom Code?

**Decision:** Use predefined templates with parameters instead of allowing arbitrary code execution.

**Rationale:**
- **Security**: Prevents code injection attacks
- **Reliability**: Pre-tested, proven templates
- **Maintainability**: Easier to debug and update
- **User-Friendly**: Non-developers can create jobs

**Trade-off:** Less flexibility, but much safer.

### Why MongoDB Over SQL?

**Decision:** Store jobs in MongoDB collections.

**Rationale:**
- **Schema Flexibility**: Job parameters vary widely
- **Existing Stack**: Already using MongoDB
- **Querying**: Good support for complex filters
- **Performance**: Fast reads for job scheduling

### Why Not Celery/Airflow?

**Decision:** Build custom solution instead of using existing frameworks.

**Rationale:**
- **Simplicity**: Our needs are simpler than these tools
- **Integration**: Better integration with existing codebase
- **Learning Curve**: Team already knows our stack
- **Overhead**: Don't need distributed task queue yet

**Future:** Can migrate to Celery/Airflow if complexity grows.

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] 99.9% job execution success rate
- [ ] < 1 second API response time
- [ ] Zero security vulnerabilities
- [ ] 90%+ code coverage

### Business Metrics
- [ ] Admins can create jobs in < 2 minutes
- [ ] 50% reduction in code deployments for job changes
- [ ] 100% of existing jobs migrated
- [ ] Zero downtime during migration

### User Experience
- [ ] 95%+ admin satisfaction score
- [ ] < 5 support tickets per month related to scheduler
- [ ] Intuitive UI (no training needed)

---

## 📝 Appendix

### A. Example Job Templates

#### Database Cleanup Template
```python
class DatabaseCleanupTemplate(JobTemplate):
    """Remove old records from database collections"""
    
    async def execute(self, params: Dict, db) -> JobResult:
        collection = params["collection"]
        condition = params["condition"]
        dry_run = params.get("dryRun", True)
        
        # Count matching records
        count = await db[collection].count_documents(condition)
        
        if dry_run:
            return JobResult(
                status="success",
                message=f"Would delete {count} records (dry run)",
                details={"count": count}
            )
        
        # Actual deletion
        result = await db[collection].delete_many(condition)
        
        return JobResult(
            status="success",
            message=f"Deleted {result.deleted_count} records",
            details={"deleted": result.deleted_count}
        )
```

#### Email Notification Template
```python
class EmailNotificationTemplate(JobTemplate):
    """Send scheduled email notifications"""
    
    async def execute(self, params: Dict, db) -> JobResult:
        recipients = params["recipients"]
        subject = params["subject"]
        body = params["body"]
        template = params.get("template")
        
        # Send emails
        sent_count = await send_emails(recipients, subject, body, template)
        
        return JobResult(
            status="success",
            message=f"Sent {sent_count} emails",
            details={"sent": sent_count, "recipients": recipients}
        )
```

### B. Cron Expression Reference

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)

Examples:
0 2 * * *      Daily at 2 AM
0 */6 * * *    Every 6 hours
0 0 * * 0      Weekly on Sunday at midnight
0 0 1 * *      Monthly on the 1st at midnight
*/15 * * * *   Every 15 minutes
```

### C. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Job execution failure | High | Medium | Retry mechanism, alerting |
| Database overload | High | Low | Rate limiting, resource quotas |
| Parameter injection | Critical | Medium | Strict validation, sanitization |
| Scheduling conflicts | Medium | Low | Proper job queueing |
| Migration issues | High | Medium | Parallel operation, rollback plan |

---

## 📞 Contact & Support

**Architecture Questions:** Architecture Team  
**Implementation Support:** Development Team  
**Security Review:** Security Team

---

**Document Status:** ✅ Ready for Review  
**Next Steps:** Review with team → Approve → Begin Phase 1 Implementation

---

*This document is a living document and will be updated as the implementation progresses.*
