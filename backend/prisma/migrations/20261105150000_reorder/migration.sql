-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'قطعة',
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "reorderQty" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("active", "categoryId", "id", "minStock", "name", "sku", "unit") SELECT "active", "categoryId", "id", "minStock", "name", "sku", "unit" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");
CREATE TABLE "new_PurchaseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "requestId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SHORTAGE',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseRequest" ("createdAt", "id", "number", "requestId", "status") SELECT "createdAt", "id", "number", "requestId", "status" FROM "PurchaseRequest";
DROP TABLE "PurchaseRequest";
ALTER TABLE "new_PurchaseRequest" RENAME TO "PurchaseRequest";
CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

