export interface McsAdminPageInfo {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export type McsAdminStableSort =
  | 'createdAt_desc_tmagId_desc'
  | 'createdAt_desc_prospectId_desc'
  | 'createdAt_desc_reservationId_desc'
  | 'updatedAt_desc_resourceVersionId_desc'
  | 'timestamp_desc_entryId_desc';

export interface McsAdminPaginationContract {
  pageInfo: McsAdminPageInfo;
  appliedSort: McsAdminStableSort;
  computedAt: string;
}
