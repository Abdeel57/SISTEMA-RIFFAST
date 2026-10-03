-- CreateTable
CREATE TABLE "StoredAsset" (
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredAsset_pkey" PRIMARY KEY ("key")
);
