// Schedule Email Notifier Job
// Run: mongosh matrimonialDB schedule_email_notifier.js

db.scheduled_jobs.insertOne({
  name: "Email Notifier",
  description: "Processes pending email notifications from the queue and sends them via SMTP",
  template: "email_notifier_template",
  frequency: "*/1 * * * *",  // Every 1 minute
  enabled: true,
  params: {
    batchSize: 50
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  lastRun: null,
  nextRun: new Date(Date.now() + 60000),  // 1 minute from now
  runCount: 0,
  lastStatus: "pending"
});

print("✅ Email Notifier job scheduled!");
print("   Frequency: Every 1 minute");
print("   Template: email_notifier_template");
print("");
print("Verify:");
print("  db.scheduled_jobs.findOne({name: 'Email Notifier'})");
