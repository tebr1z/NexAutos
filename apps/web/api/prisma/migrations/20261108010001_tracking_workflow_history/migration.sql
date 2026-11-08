-- Run after the enum migration commits (PostgreSQL enum values cannot be used
-- in the transaction that first adds them). Previously this status meant ready,
-- whereas the new workflow uses it for documents being prepared.
UPDATE "Order" SET "currentStatus" = 'EXPORT_READY' WHERE "currentStatus" = 'EXPORT_DOCUMENTS';
UPDATE "TrackingEvent" SET "status" = 'EXPORT_READY' WHERE "status" = 'EXPORT_DOCUMENTS';
