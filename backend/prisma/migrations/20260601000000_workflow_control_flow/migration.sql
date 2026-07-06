-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Workflow" ADD COLUMN "definition" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ExecutionRun" ADD COLUMN "executionMode" TEXT NOT NULL DEFAULT 'LINEAR';
ALTER TABLE "ExecutionRun" ADD COLUMN "workflowDefinitionSnapshot" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ExecutionSpan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionRunId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL,
    "iteration" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    CONSTRAINT "ExecutionSpan_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
