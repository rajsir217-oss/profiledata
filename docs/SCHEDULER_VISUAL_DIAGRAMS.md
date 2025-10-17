# Dynamic Scheduler System - Visual Diagrams

**Reference:** SCHEDULER_DYNAMIC_JOBS_ARCHITECTURE.md

---

## 🎨 System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                         ADMIN UI LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Job List  │  │ Create Job  │  │  Execution  │               │
│  │   & Manage  │  │   Wizard    │  │   History   │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
└─────────┼─────────────────┼─────────────────┼─────────────────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │ REST API
┌───────────────────────────┴─────────────────────────────────────┐
│                         API LAYER                                │
│  POST /scheduler-jobs         Create new job                    │
│  GET  /scheduler-jobs         List all jobs                     │
│  PUT  /scheduler-jobs/:id     Update job config                 │
│  POST /scheduler-jobs/:id/run Manual execution                  │
│  GET  /scheduler-jobs/:id/executions  View history              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    JOB REGISTRY SERVICE                          │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Job Definition      │  │  Template Registry   │            │
│  │  Management          │  │  & Validation        │            │
│  └──────────┬───────────┘  └──────────┬───────────┘            │
│             │                          │                        │
│             └──────────┬───────────────┘                        │
│                        ↓                                        │
│                  ┌──────────┐                                   │
│                  │ Database │                                   │
│                  │  dynamic_jobs                               │
│                  │  job_executions                             │
│                  │  job_templates                              │
│                  └──────────┘                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                     JOB EXECUTOR ENGINE                          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  Schedule  │  │  Execute   │  │   Log      │               │
│  │  Manager   │→ │  with      │→ │  Results   │               │
│  │            │  │  Template  │  │            │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                   JOB TEMPLATE LIBRARY                           │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Database   │  │    Email    │  │    Data     │            │
│  │  Cleanup    │  │ Notification│  │   Export    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Report    │  │   Backup    │  │   Webhook   │            │
│  │ Generation  │  │    Job      │  │   Trigger   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Job Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                                │
└─────────────────────────────────────────────────────────────────┘

  Admin clicks "Create Job"
           ↓
  ┌──────────────────────┐
  │  Step 1: Choose      │
  │  Template            │
  │                      │
  │  ○ Database Cleanup  │ ← User selects template
  │  ○ Email Notify      │
  │  ○ Data Export       │
  └──────────┬───────────┘
             ↓
  ┌──────────────────────┐
  │  Step 2: Configure   │
  │  Parameters          │
  │                      │
  │  Collection: [users] │ ← Dynamic form based
  │  Condition: {...}    │   on template schema
  │  Dry Run: [✓]       │
  └──────────┬───────────┘
             ↓
  ┌──────────────────────┐
  │  Step 3: Set         │
  │  Schedule            │
  │                      │
  │  ○ Interval: [3600s] │ ← Cron or interval
  │  ○ Cron: [* * * * *] │
  └──────────┬───────────┘
             ↓
  ┌──────────────────────┐
  │  Step 4: Options     │
  │                      │
  │  Timeout: [1800s]    │
  │  Retries: [3]        │
  │  Notify: [✓ email]   │
  └──────────┬───────────┘
             ↓
  ┌──────────────────────┐
  │  Step 5: Review      │
  │                      │
  │  Job Name: ...       │
  │  Template: ...       │
  │  Schedule: ...       │
  │                      │
  │  [Cancel]  [Create]  │
  └──────────┬───────────┘
             ↓
         ✅ Job Created
         ↓
     Scheduler picks up
         ↓
     Runs on schedule
```

---

## 🔄 Job Execution Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    JOB LIFECYCLE STATES                           │
└──────────────────────────────────────────────────────────────────┘

        CREATED
           │
           ↓
    ┌────────────┐
    │  PENDING   │ ← Waiting for scheduled time
    └─────┬──────┘
          │
          ↓ Time reached
    ┌────────────┐
    │  QUEUED    │ ← In execution queue
    └─────┬──────┘
          │
          ↓ Executor picks up
    ┌────────────┐
    │  RUNNING   │ ← Currently executing
    └─────┬──────┘
          │
          ├───→ Success ───→ [COMPLETED] ──→ Schedule next run
          │
          ├───→ Failure ───→ [FAILED] ──┐
          │                              │
          ├───→ Timeout ───→ [TIMEOUT]  │
          │                              ↓
          │                         Has retries left?
          │                              │
          │                         Yes ─┴→ [RETRY_PENDING]
          │                              │        ↓
          │                              │   Wait delay
          │                              │        ↓
          │                              └────→ [QUEUED]
          │                              │
          │                         No ──┴→ [EXHAUSTED]
          │                                     ↓
          └────────────────────────────→ Send notifications
                                               ↓
                                        Log to database
```

---

## 💾 Database Schema

```
┌──────────────────────────────────────────────────────────────────┐
│                       dynamic_jobs                                │
├──────────────────────────────────────────────────────────────────┤
│ _id                  ObjectId (Primary Key)                      │
│ name                 String (Job name)                           │
│ description          String (Job description)                    │
│ template_type        String (e.g., "database_cleanup")          │
│ parameters           Object (Template-specific params)           │
│ schedule             Object (cron or interval)                   │
│ enabled              Boolean (Is job active?)                    │
│ timeout_seconds      Integer (Max execution time)                │
│ retry_policy         Object (Retry configuration)                │
│ notifications        Object (Email/Slack config)                 │
│ created_by           String (User who created)                   │
│ created_at           DateTime                                    │
│ updated_at           DateTime                                    │
│ last_run_at          DateTime                                    │
│ next_run_at          DateTime                                    │
│ version              Integer (For optimistic locking)            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       job_executions                              │
├──────────────────────────────────────────────────────────────────┤
│ _id                  ObjectId (Primary Key)                      │
│ job_id               ObjectId (Foreign Key → dynamic_jobs)       │
│ job_name             String (Denormalized for queries)           │
│ template_type        String (Denormalized)                       │
│ status               String (success/failed/timeout/running)     │
│ started_at           DateTime                                    │
│ completed_at         DateTime                                    │
│ duration_seconds     Integer                                     │
│ result               Object (Execution results)                  │
│ error                String (Error message if failed)            │
│ logs                 Array (Log entries)                         │
│ triggered_by         String (scheduler/manual/user_id)           │
│ execution_host       String (Server that ran the job)            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       job_templates                               │
├──────────────────────────────────────────────────────────────────┤
│ _id                  String (Template type, e.g., "data_export") │
│ name                 String (Display name)                       │
│ description          String (Template description)               │
│ category             String (maintenance/reports/notifications)  │
│ icon                 String (Emoji icon)                         │
│ parameters_schema    Object (JSON Schema for validation)         │
│ estimated_duration   String (Human-readable estimate)            │
│ resource_usage       String (low/medium/high)                    │
│ risk_level           String (low/medium/high/critical)           │
└──────────────────────────────────────────────────────────────────┘

INDEXES:
  dynamic_jobs:
    - { enabled: 1, next_run_at: 1 }  ← Find jobs ready to run
    - { template_type: 1 }             ← Filter by template
    - { created_by: 1 }                ← User's jobs
    
  job_executions:
    - { job_id: 1, started_at: -1 }    ← Job history
    - { status: 1, started_at: -1 }    ← Failed jobs
    - { started_at: -1 }               ← Recent executions
```

---

## 🧩 Template Class Hierarchy

```
                     JobTemplate (ABC)
                           │
                           │ abstract methods:
                           │  - execute(params, db)
                           │  - validate_params(params)
                           │  - get_schema()
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ↓                ↓                ↓
  DatabaseCleanup   EmailNotification  DataExport
  Template          Template           Template
          │                │                │
          │                │                │
    - execute()      - execute()       - execute()
    - validate()     - validate()      - validate()
    - get_schema()   - get_schema()    - get_schema()
    
    Params:          Params:           Params:
    - collection     - recipients      - collection
    - condition      - subject         - format
    - dryRun         - body            - filters
                     - template        - destination


          ┌────────────────┼────────────────┐
          │                │                │
          ↓                ↓                ↓
  ReportGeneration    BackupJob      WebhookTrigger
  Template            Template       Template
```

---

## 🔐 Security Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    SECURITY VALIDATION                            │
└──────────────────────────────────────────────────────────────────┘

  User submits job
         ↓
  ┌─────────────────┐
  │ Authentication  │ → Is user logged in?
  └────────┬────────┘
           ↓ YES
  ┌─────────────────┐
  │ Authorization   │ → Is user admin?
  └────────┬────────┘
           ↓ YES
  ┌─────────────────┐
  │ Template Valid? │ → Does template exist?
  └────────┬────────┘
           ↓ YES
  ┌─────────────────┐
  │ Schema Valid?   │ → Do params match schema?
  └────────┬────────┘
           ↓ YES
  ┌─────────────────┐
  │ Sanitization    │ → Clean dangerous inputs
  └────────┬────────┘
           ↓
  ┌─────────────────┐
  │ Rate Limit      │ → Check request frequency
  └────────┬────────┘
           ↓ OK
  ┌─────────────────┐
  │ Job Quota       │ → Max jobs per user/system
  └────────┬────────┘
           ↓ OK
  ┌─────────────────┐
  │ Save to DB      │
  └────────┬────────┘
           ↓
  ┌─────────────────┐
  │ Audit Log       │ → Record creation
  └────────┬────────┘
           ↓
      ✅ Success

           
  Any ↓ NO
  ┌─────────────────┐
  │ 401/403/400     │
  │ Error Response  │
  └─────────────────┘
```

---

## 📱 UI Component Tree

```
AdminSettings
    │
    └─── DynamicScheduler
            │
            ├─── JobList
            │      │
            │      ├─── JobTable
            │      │      ├─── JobRow
            │      │      │      ├─── StatusBadge
            │      │      │      ├─── ActionButtons
            │      │      │      └─── ManualRunButton
            │      │      └─── ...
            │      │
            │      └─── JobFilters
            │             ├─── TemplateFilter
            │             ├─── StatusFilter
            │             └─── SearchInput
            │
            ├─── JobCreationModal
            │      │
            │      ├─── TemplateSelector
            │      │
            │      ├─── ParameterForm (Dynamic)
            │      │      ├─── StringInput
            │      │      ├─── NumberInput
            │      │      ├─── SelectDropdown
            │      │      ├─── BooleanToggle
            │      │      └─── ObjectEditor
            │      │
            │      ├─── ScheduleConfig
            │      │      ├─── IntervalInput
            │      │      └─── CronBuilder
            │      │             ├─── MinuteSelector
            │      │             ├─── HourSelector
            │      │             ├─── DaySelector
            │      │             └─── PresetButtons
            │      │
            │      └─── NotificationConfig
            │             ├─── EmailInput
            │             └─── SlackWebhook
            │
            └─── JobExecutionHistory
                   │
                   ├─── ExecutionList
                   │      └─── ExecutionRow
                   │             ├─── StatusIcon
                   │             ├─── Duration
                   │             └─── ViewDetails
                   │
                   └─── ExecutionDetailsModal
                          ├─── ResultSummary
                          ├─── LogViewer
                          └─── ErrorDetails
```

---

## 🔄 Migration Strategy Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       MIGRATION PHASES                            │
└──────────────────────────────────────────────────────────────────┘

WEEK 0: Parallel System Setup
┌─────────────────────────────────────────┐
│  Old System (Hardcoded)                 │
│  ├── data_cleanup                       │  ← Still running
│  ├── test_scheduler                     │  ← Still running
│  └── auto_delete_resolved_tickets       │  ← Still running
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  New System (Dynamic)                   │
│  └── (empty, ready to receive jobs)     │
└─────────────────────────────────────────┘

↓

WEEK 1: First Migration (test_scheduler)
┌─────────────────────────────────────────┐
│  Old System                             │
│  ├── data_cleanup                       │  ← Still running
│  ├── test_scheduler (deprecated)        │  ← Disabled
│  └── auto_delete_resolved_tickets       │  ← Still running
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  New System                             │
│  └── test_scheduler (migrated) ✅       │  ← Now running here
└─────────────────────────────────────────┘

↓

WEEK 2: Second Migration (data_cleanup)
┌─────────────────────────────────────────┐
│  Old System                             │
│  ├── data_cleanup (deprecated)          │  ← Disabled
│  ├── test_scheduler (removed)           │
│  └── auto_delete_resolved_tickets       │  ← Still running
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  New System                             │
│  ├── test_scheduler ✅                  │
│  └── data_cleanup (migrated) ✅         │  ← Now running here
└─────────────────────────────────────────┘

↓

WEEK 3: Final Migration (auto_delete_resolved_tickets)
┌─────────────────────────────────────────┐
│  Old System                             │
│  ├── (all jobs removed)                 │
│  └── (can be deprecated)                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  New System                             │
│  ├── test_scheduler ✅                  │
│  ├── data_cleanup ✅                    │
│  └── auto_delete_resolved_tickets ✅    │  ← All migrated!
└─────────────────────────────────────────┘

↓

WEEK 4: Cleanup
✅ Remove hardcoded job definitions
✅ Update UnifiedScheduler to only use dynamic jobs
✅ Archive old code
✅ Update documentation
```

---

## 📈 Performance Monitoring

```
┌──────────────────────────────────────────────────────────────────┐
│                      METRICS DASHBOARD                            │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Job Execution Metrics                                          │
├─────────────────────────────────────────────────────────────────┤
│  Success Rate:   ████████████░░░░  95%                         │
│  Failure Rate:   ██░░░░░░░░░░░░░░   5%                         │
│  Avg Duration:   2.3 minutes                                    │
│  Total Runs:     1,234                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  System Health                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Active Jobs:        42                                         │
│  Running Jobs:       3                                          │
│  Queue Depth:        0                                          │
│  CPU Usage:          25%                                        │
│  Memory Usage:       512 MB                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Top Jobs by Execution Count                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. test_scheduler           ████████████ 1440 runs            │
│  2. data_cleanup             ████████░░░░  720 runs            │
│  3. email_digest             ████░░░░░░░░  168 runs            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Recent Failures                                                │
├─────────────────────────────────────────────────────────────────┤
│  weekly_report        Timeout (exceeded 1800s)                 │
│  data_export          Database connection failed               │
│  backup_job           Insufficient disk space                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Decision Flow: Which Template to Use?

```
                   Need to schedule a task?
                            │
                            ↓
                   What type of task?
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
   Remove old data?    Send messages?      Generate files?
        │                   │                   │
        YES                 YES                 YES
        ↓                   ↓                   ↓
   DATABASE              EMAIL              DATA EXPORT
   CLEANUP              NOTIFICATION        TEMPLATE
   TEMPLATE             TEMPLATE
        │                   │                   │
        │                   │                   │
   Parameters:         Parameters:         Parameters:
   - Collection        - Recipients        - Collection
   - Condition         - Subject           - Format (CSV/JSON)
   - Dry Run           - Body/Template     - Filters
                                           - Destination

        │
        │
        ↓
   More specialized needs?
        │
        ├─→ Create reports? → REPORT GENERATION TEMPLATE
        ├─→ Backup data? → BACKUP TEMPLATE
        ├─→ Call external API? → WEBHOOK TRIGGER TEMPLATE
        └─→ Custom logic? → Create new template class
```

---

**End of Visual Diagrams**

For detailed implementation instructions, see:
- `SCHEDULER_DYNAMIC_JOBS_ARCHITECTURE.md`
- `SCHEDULER_IMPLEMENTATION_CHECKLIST.md`
