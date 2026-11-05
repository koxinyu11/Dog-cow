/** Stable UI-safe failures for the independent activity domain. */
export const TOILET_ERRORS = {
  TOILET_DATA_INVALID: '记录读取失败，请先导出备份。',
  TOILET_NOT_AVAILABLE: '当前不能开始，请核对状态。',
  TOILET_CONFLICT: '记录已变化，请核对后重试。',
  TOILET_TIME_INVALID: '结束时间需在开始时间与现在之间。',
  TOILET_REVIEW_REQUIRED: '请先核对上次记录。',
  TOILET_SAVE_FAILED: '修改尚未保存，请保留窗口并重试。',
  TOILET_INTERNAL: '操作未完成，请重试。',
} as const;
