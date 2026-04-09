-- CreateEnum
CREATE TYPE "PaymentRetryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED_PERMANENT');

-- CreateTable
CREATE TABLE "PaymentRetryLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "txnRef" TEXT NOT NULL,
    "responseCode" TEXT NOT NULL,
    "transactionStatus" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentRetryStatus" NOT NULL DEFAULT 'PENDING',
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRetryLog_eventKey_key" ON "PaymentRetryLog"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentRetryLog_status_nextRetryAt_idx" ON "PaymentRetryLog"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "PaymentRetryLog_paymentId_idx" ON "PaymentRetryLog"("paymentId");

-- AddForeignKey
ALTER TABLE "PaymentRetryLog" ADD CONSTRAINT "PaymentRetryLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
