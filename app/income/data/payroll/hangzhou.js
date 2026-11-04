// Policy snapshot for ordinary employees, not flexible employment or employer costs.
export const HANGZHOU_PAYROLL_POLICY = {
  city: 'hangzhou',
  cityName: '杭州（市区）',
  checkedAt: '2026-11-04',
  social: { minimumBase: 5122, maximumBase: 25611, year: 2026 },
  fund: {
    minimumBase: 2660,
    maximumBase: 42151,
    minimumRate: 5,
    maximumRate: 12,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2027-06-30',
  },
  items: {
    pension: { name: '养老保险', rate: 8, base: 'social' },
    medical: { name: '医疗保险', rate: 2, base: 'social' },
    unemployment: { name: '失业保险', rate: 0.5, base: 'social' },
    fund: { name: '住房公积金', rate: 12, base: 'fund' },
  },
  sources: [
    {
      title: '浙江人社：2026 年社保基数与个人养老 8%（2026-10-08）',
      url: 'https://rlsbt.zj.gov.cn/col/col1229101513/art/2026/art_e8b496ab59834390884b8d375cff1651.html',
    },
    {
      title: '杭州公积金：2026 年度调整（2026-07-24，基数有效至 2027-06-30）',
      url: 'https://gjj.hangzhou.gov.cn/col/col1229468386/art/2026/art_09cee14331fb44f2967fca0b8ac2ce27.html',
    },
    {
      title: '杭州政府公报：医保 2%、生育个人不缴、大病从医保个账扣缴（2026-01-01 施行）',
      url: 'https://zfgb.hangzhou.gov.cn/upload/default/bigfile/2025/10/15/20251015_ec3d3e35772bc2a066570411d334c03f.pdf',
    },
    {
      title: '浙江税务：失业保险个人 0.5%（浙人社发〔2015〕3号）',
      url: 'https://zhejiang.chinatax.gov.cn/art/2015/1/15/art_8410_12307.html',
    },
    {
      title: '杭州政府公报：长护险个人 45 元/年，可从医保个账扣缴（2025-01-01 施行）',
      url: 'https://zfgb.hangzhou.gov.cn/10/105220253/t117220253054/519016.shtml',
    },
    {
      title: '国家税务总局：工资薪金累计预扣法（2018 年第 61 号公告）',
      url: 'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html',
    },
  ],
};
