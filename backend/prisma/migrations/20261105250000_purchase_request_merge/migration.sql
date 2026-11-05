-- تجميع طلبات الشراء في طلب واحد
ALTER TABLE `PurchaseRequest` ADD COLUMN `mergedIntoId` VARCHAR(191) NULL;
ALTER TABLE `PurchaseRequest` ADD CONSTRAINT `PurchaseRequest_mergedIntoId_fkey` FOREIGN KEY (`mergedIntoId`) REFERENCES `PurchaseRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
