-- سند التوريد: إدخال بضاعة بلا فاتورة
CREATE TABLE `SupplyReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `purchaseRequestId` VARCHAR(191) NULL,

    UNIQUE INDEX `SupplyReceipt_number_key`(`number`),
    INDEX `SupplyReceipt_branchId_receivedAt_idx`(`branchId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupplyLine` (
    `id` VARCHAR(191) NOT NULL,
    `supplyId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- دفعة المخزون: المصدر فاتورة أو سند توريد
ALTER TABLE `StockBatch` MODIFY `invoiceLineId` VARCHAR(191) NULL;
ALTER TABLE `StockBatch` ADD COLUMN `supplyLineId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `StockBatch_supplyLineId_key` ON `StockBatch`(`supplyLineId`);

ALTER TABLE `SupplyReceipt` ADD CONSTRAINT `SupplyReceipt_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SupplyReceipt` ADD CONSTRAINT `SupplyReceipt_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SupplyReceipt` ADD CONSTRAINT `SupplyReceipt_purchaseRequestId_fkey` FOREIGN KEY (`purchaseRequestId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SupplyLine` ADD CONSTRAINT `SupplyLine_supplyId_fkey` FOREIGN KEY (`supplyId`) REFERENCES `SupplyReceipt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SupplyLine` ADD CONSTRAINT `SupplyLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_supplyLineId_fkey` FOREIGN KEY (`supplyLineId`) REFERENCES `SupplyLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
