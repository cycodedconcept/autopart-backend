Implement rider suspension with delivery reassignment for logistics companies.

Migration: add status enum('active','suspended') default 'active' to the riders table.
PATCH /api/v1/logistics/riders/:id/suspend and /reactivate under logistics routes, protected by logisticsCompanyAuthMiddleware; a company may only modify its own riders.
On suspend: find the rider's active delivery_jobs that have NOT yet been picked up, unassign them, and reassign via the existing assignmentService. Delivery jobs already picked up / in transit should be flagged for manual handling, not auto-reassigned.
In riderAuthMiddleware, reject suspended riders with 403.
If no rider is available for reassignment, the job returns to the pending/unassigned queue.
Follow the existing service/repository/controller structure and keep SQL and pagination patterns consistent with the repo.