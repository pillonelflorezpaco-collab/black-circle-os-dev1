-- Rename enum values to match the Client -> Model rename (pure rename, no data loss).
ALTER TYPE "ActivityEventType" RENAME VALUE 'CLIENT_CREATED' TO 'MODEL_CREATED';
ALTER TYPE "ActivityEventType" RENAME VALUE 'CLIENT_CONTENT_LOW' TO 'MODEL_CONTENT_LOW';
