import { Prisma } from '@prisma/client';
import type { AuthUser } from './auth';

/**
 * ما يراه رافع الطلب: ما رفعه هو، أو ما يخص فرعه، أو ما يخص إدارته
 * (بحسب ما رُبط به حسابه: فرع، إدارة، أو الاثنان).
 * التعديل والإلغاء يبقيان لصاحب الطلب وحده.
 */
export function requesterScope(user: AuthUser): Prisma.RequestWhereInput {
  const or: Prisma.RequestWhereInput[] = [{ requesterId: user.id }];
  if (user.branchId) or.push({ branchId: user.branchId });
  if (user.departmentId) or.push({ departmentId: user.departmentId });
  return { OR: or };
}
