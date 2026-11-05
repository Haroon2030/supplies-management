-- الإدارات كيان مستقل: فك الارتباط بالفرع مع إبقاء البيانات القائمة
ALTER TABLE `Department` DROP FOREIGN KEY `Department_branchId_fkey`;
DROP INDEX `Department_branchId_name_key` ON `Department`;
ALTER TABLE `Department` DROP COLUMN `branchId`;
CREATE UNIQUE INDEX `Department_name_key` ON `Department`(`name`);
