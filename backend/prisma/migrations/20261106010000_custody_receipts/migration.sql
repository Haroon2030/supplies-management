-- سند استلام العهدة والأرقام التسلسلية للأجهزة
ALTER TABLE `Item` ADD COLUMN `isCustody` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `CustodyReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `issueId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `custodianId` VARCHAR(191) NOT NULL,
    `issuedById` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `signedAt` DATETIME(3) NULL,
    `signerName` VARCHAR(191) NULL,
    `signerIdNo` VARCHAR(191) NULL,
    `signature` LONGTEXT NULL,

    UNIQUE INDEX `CustodyReceipt_number_key`(`number`),
    UNIQUE INDEX `CustodyReceipt_issueId_key`(`issueId`),
    INDEX `CustodyReceipt_custodianId_idx`(`custodianId`),
    INDEX `CustodyReceipt_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustodyUnit` (
    `id` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `serial` VARCHAR(191) NOT NULL,
    `receiptId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitCost` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'IN_CUSTODY',

    UNIQUE INDEX `CustodyUnit_seq_key`(`seq`),
    UNIQUE INDEX `CustodyUnit_serial_key`(`serial`),
    INDEX `CustodyUnit_receiptId_idx`(`receiptId`),
    INDEX `CustodyUnit_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustodyReceipt` ADD CONSTRAINT `CustodyReceipt_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `StockIssue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustodyReceipt` ADD CONSTRAINT `CustodyReceipt_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `Request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustodyReceipt` ADD CONSTRAINT `CustodyReceipt_custodianId_fkey` FOREIGN KEY (`custodianId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustodyReceipt` ADD CONSTRAINT `CustodyReceipt_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustodyUnit` ADD CONSTRAINT `CustodyUnit_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `CustodyReceipt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CustodyUnit` ADD CONSTRAINT `CustodyUnit_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- أصناف فئة «أجهزة إلكترونية» الحالية تصبح عهدة تلقائياً (يمكن تعديلها من شاشة التهيئة)
UPDATE `Item` i JOIN `Category` c ON c.`id` = i.`categoryId` SET i.`isCustody` = true WHERE c.`name` = 'أجهزة إلكترونية';
