-- AlterTable
ALTER TABLE `Branch` ADD COLUMN `code` VARCHAR(191) NULL;
ALTER TABLE `Item` ADD COLUMN `description` TEXT NULL, ADD COLUMN `barcode` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Branch_code_key` ON `Branch`(`code`);
CREATE UNIQUE INDEX `Item_barcode_key` ON `Item`(`barcode`);
