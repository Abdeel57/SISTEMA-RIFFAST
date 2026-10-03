-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VISITOR', 'RIFERO', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "RiferoStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaffleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'PENDING_PAYMENT', 'PAID', 'RIFERO_RESERVED', 'CANCELLED', 'WINNER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'RESERVED', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('AUTH', 'RAFFLE', 'ORDER', 'TICKET', 'PAYMENT', 'SUBSCRIPTION', 'ADMIN', 'DRAW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RIFERO',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiferoProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "description" TEXT,
    "whatsapp" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "templateKey" TEXT NOT NULL DEFAULT 'classic',
    "payHolderName" TEXT,
    "payBank" TEXT,
    "payClabe" TEXT,
    "payCardNumber" TEXT,
    "payConcept" TEXT,
    "payInstructions" TEXT,
    "payWhatsapp" TEXT,
    "defaultReserveMinutes" INTEGER NOT NULL DEFAULT 120,
    "allowProofUpload" BOOLEAN NOT NULL DEFAULT false,
    "showWinners" BOOLEAN NOT NULL DEFAULT true,
    "useDigitalDraw" BOOLEAN NOT NULL DEFAULT false,
    "status" "RiferoStatus" NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiferoProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "maxActiveRaffles" INTEGER NOT NULL,
    "maxTicketsPerRaffle" INTEGER NOT NULL,
    "allowProofUpload" BOOLEAN NOT NULL DEFAULT false,
    "allowMultipleWinners" BOOLEAN NOT NULL DEFAULT false,
    "allowReportsExcel" BOOLEAN NOT NULL DEFAULT false,
    "allowReportsPdf" BOOLEAN NOT NULL DEFAULT false,
    "allowVerificationBadge" BOOLEAN NOT NULL DEFAULT false,
    "allowDigitalDraw" BOOLEAN NOT NULL DEFAULT false,
    "allowCustomDomainFuture" BOOLEAN NOT NULL DEFAULT false,
    "features" JSONB NOT NULL DEFAULT '[]',
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "riferoId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "riferoId" TEXT NOT NULL,
    "eventNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "prize" TEXT,
    "ticketPrice" INTEGER NOT NULL,
    "totalTickets" INTEGER NOT NULL,
    "ticketFormat" INTEGER NOT NULL DEFAULT 3,
    "ticketStart" INTEGER NOT NULL DEFAULT 1,
    "ticketEnd" INTEGER NOT NULL,
    "maxTicketsPerOrder" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "drawDate" TIMESTAMP(3),
    "status" "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "terms" TEXT,
    "paymentInstructions" TEXT,
    "reserveMinutes" INTEGER NOT NULL DEFAULT 120,
    "allowWinnerPublication" BOOLEAN NOT NULL DEFAULT true,
    "useDigitalDraw" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleImage" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketNumber" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'AVAILABLE',
    "buyerId" TEXT,
    "orderId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTicket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "fileUrl" TEXT NOT NULL,
    "note" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "buyerId" TEXT,
    "position" INTEGER NOT NULL,
    "prizeDescription" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "evidenceUrl" TEXT,
    "drawnById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalTicket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ActivityType" NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RiferoProfile_userId_key" ON "RiferoProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiferoProfile_slug_key" ON "RiferoProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RiferoProfile_subdomain_key" ON "RiferoProfile"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "RiferoProfile_customDomain_key" ON "RiferoProfile"("customDomain");

-- CreateIndex
CREATE INDEX "RiferoProfile_status_idx" ON "RiferoProfile"("status");

-- CreateIndex
CREATE INDEX "RiferoProfile_slug_idx" ON "RiferoProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

-- CreateIndex
CREATE INDEX "Subscription_riferoId_idx" ON "Subscription"("riferoId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Raffle_riferoId_idx" ON "Raffle"("riferoId");

-- CreateIndex
CREATE INDEX "Raffle_status_idx" ON "Raffle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Raffle_riferoId_eventNumber_key" ON "Raffle"("riferoId", "eventNumber");

-- CreateIndex
CREATE INDEX "RaffleImage_raffleId_idx" ON "RaffleImage"("raffleId");

-- CreateIndex
CREATE INDEX "TicketNumber_raffleId_status_idx" ON "TicketNumber"("raffleId", "status");

-- CreateIndex
CREATE INDEX "TicketNumber_orderId_idx" ON "TicketNumber"("orderId");

-- CreateIndex
CREATE INDEX "TicketNumber_buyerId_idx" ON "TicketNumber"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketNumber_raffleId_number_key" ON "TicketNumber"("raffleId", "number");

-- CreateIndex
CREATE INDEX "Buyer_phone_idx" ON "Buyer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_raffleId_status_idx" ON "Order"("raffleId", "status");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "OrderTicket_ticketId_idx" ON "OrderTicket"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTicket_orderId_ticketId_key" ON "OrderTicket"("orderId", "ticketId");

-- CreateIndex
CREATE INDEX "PaymentProof_orderId_idx" ON "PaymentProof"("orderId");

-- CreateIndex
CREATE INDEX "Winner_raffleId_idx" ON "Winner"("raffleId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalTicket_orderId_key" ON "DigitalTicket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalTicket_code_key" ON "DigitalTicket"("code");

-- CreateIndex
CREATE INDEX "DigitalTicket_code_idx" ON "DigitalTicket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSettings_key_key" ON "PlatformSettings"("key");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "ActivityLog"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RiferoProfile" ADD CONSTRAINT "RiferoProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_riferoId_fkey" FOREIGN KEY ("riferoId") REFERENCES "RiferoProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_riferoId_fkey" FOREIGN KEY ("riferoId") REFERENCES "RiferoProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleImage" ADD CONSTRAINT "RaffleImage_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketNumber" ADD CONSTRAINT "TicketNumber_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketNumber" ADD CONSTRAINT "TicketNumber_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketNumber" ADD CONSTRAINT "TicketNumber_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTicket" ADD CONSTRAINT "OrderTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTicket" ADD CONSTRAINT "OrderTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "TicketNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_drawnById_fkey" FOREIGN KEY ("drawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalTicket" ADD CONSTRAINT "DigitalTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
