import { HANGZHOU_PAYROLL_POLICY } from './hangzhou.js';

// Ordinary employees only. null means unverified, never a zero or another city's default.
const range = (minimumBase, maximumBase, effectiveFrom = '2026-07-01', effectiveTo = '2027-06-30') => ({ minimumBase, maximumBase, effectiveFrom, effectiveTo });
const source = (title, url) => ({ title, url });
function city(city, cityName, social, fund, rates, sources, overrides = {}) {
  const names = { pension: '养老保险', medical: '医疗保险', unemployment: '失业保险', fund: '住房公积金' };
  return {
    city, cityName, checkedAt: '2026-11-04', social, fund,
    items: Object.fromEntries(Object.entries(names).map(([id, name], index) => [id, {
      name, base: id === 'fund' ? 'fund' : 'social', rate: rates[index], ...overrides[id],
    }])), sources,
  };
}
const unknown = range(null, null, '2026-01-01', '2026-12-31');
export const PAYROLL_POLICIES = {
  hangzhou: {
    ...HANGZHOU_PAYROLL_POLICY,
    social: { ...HANGZHOU_PAYROLL_POLICY.social, effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' },
  },
  beijing: city('beijing', '北京', range(7270, 36348), { ...range(2540, 36348), minimumRate: 5, maximumRate: 12 }, [8, 2, 0.5, 12], [
    source('北京人社 · 2026 社保基数', 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202608/t20260821_4831679.html'),
    source('北京公积金 · 2026 年度调整', 'https://gjj.beijing.gov.cn/web/zwgk61/2024zcjd/744103386/index.html'),
    source('北京人社 · 个人缴费比例', 'https://www.bjfsh.gov.cn/zsk/zcwd/202608/t20260818_40116625.shtml'),
    source('北京医保 · 医疗及大额互助', 'https://www.bjft.gov.cn/ftq/zfgg/202402/16dd5bdf45014b0c992253b520080ebb.shtml'),
  ], { medical: { fixedFee: 3 } }),
  shanghai: city('shanghai', '上海', range(7546, 37731), { ...range(2740, 37731), minimumRate: 5, maximumRate: 7 }, [8, 2, 0.5, 7], [
    source('上海人社 · 2026 社保基数', 'https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html'),
    source('上海公积金 · 基数及 5%–7% 比例', 'https://www.shanghai.gov.cn/gwk/affairs/content/0064%40f3d788ec72e9404ebcbf3d27fda98435'),
    source('上海人社 · 个人缴费比例', 'https://rsj.sh.gov.cn/tmsztc_17502/20240416/t0035_1423583.html'),
  ]),
  guangzhou: city('guangzhou', '广州', unknown, { ...unknown, minimumRate: null, maximumRate: null }, [8, null, null, null], [
    source('广东税务 · 2026 企业职工养老', 'https://guangdong.chinatax.gov.cn/gdsw/hzsw_gkwj/2026-11/04/content_6b82716639f348da9fb818c20a633c3e.shtml'),
  ], { pension: { ...range(5521, 27603, '2026-07-01', '2026-12-31') } }),
  shenzhen: city('shenzhen', '深圳（一档医保）', unknown, { ...unknown, minimumRate: null, maximumRate: null }, [8, 2, null, null], [
    source('广东税务 · 2026 企业职工养老', 'https://guangdong.chinatax.gov.cn/gdsw/hzsw_gkwj/2026-11/04/content_6b82716639f348da9fb818c20a633c3e.shtml'),
    source('深圳医保 · 2026 医保缴费基数', 'https://www.sz.gov.cn/hdjlpt/detail?pid=3336522&via=pc'),
    source('深圳市社会医疗保险办法 · 一档个人 2%', 'https://www.sz.gov.cn/attachment/1/1441/1441966/10826936.pdf'),
  ], {
    pension: { ...range(5521, 27603, '2026-07-01', '2026-12-31') },
    medical: { ...range(6727, 33633, '2026-01-01', '2026-12-31') },
  }),
  chengdu: city('chengdu', '成都', unknown, { ...unknown, minimumRate: null, maximumRate: null }, [null, null, null, null], []),
  nanjing: city('nanjing', '南京', range(5025, 25127, '2026-01-01', '2026-12-31'), { ...range(2660, 42400), minimumRate: 5, maximumRate: 12 }, [8, 2, 0.5, 12], [
    source('南京政府 · 2026 社保基数', 'https://www.nanjing.gov.cn/zzb/hdhy/hygq_72666/202610/t20261010_5923162.html'),
    source('南京政府 · 2026 公积金基数', 'https://www.nanjing.gov.cn/msxx/202607/t20260719_5879428.html'),
    source('南京人社 · 养老与失业个人比例', 'https://www.nanjing.gov.cn/hdjl/hygq/202207/t20220726_3654799.html'),
    source('南京医保 · 个人医保比例', 'https://www.nanjing.gov.cn/zdgk/202301/t20230116_3804331.html'),
    source('南京公积金 · 缴存比例', 'https://www.nanjing.gov.cn/hdjl/hygq/202110/t20211018_3160880.html'),
    source('南京医保 · 大病救助 10 元/月', 'https://www.nanjing.gov.cn/hdjl/xwfbh/xwfbhjdgyjdzgjbylbxdwjfldtz/index_20041.html'.replace('\u200b', '')),
  ], { medical: { fixedFee: 10 } }),
  wuhan: city('wuhan', '武汉', range(4552, 22761, '2026-07-01', '2027-06-30'), { ...range(2400, 36072.25), minimumRate: 5, maximumRate: 12 }, [8, 2, null, 12], [
    source('湖北人社 · 2026 社保年度基数', 'https://rst.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202610/t20261008_6027858.shtml'),
    source('武汉公积金 · 2026 缴存基数', 'https://gjj.wuhan.gov.cn/hdjl/zcwd/zwzx_content_2024.html?metadataid=69282'),
    source('武汉公积金 · 缴存比例', 'https://gjj.wuhan.gov.cn/zwgk/zc/zcjd/202412/t20241219_2502854.html'),
    source('武汉医保 · 医疗及大额医保', 'https://www.wuhan.gov.cn/hdjl/rdhy/202112/t20211214_1873213.shtml'),
  ], { medical: { fixedFee: 7 } }),
};

export function getPayrollPolicy(city) { return PAYROLL_POLICIES[city] || null; }
export function payrollItemPolicy(city, id) {
  const policy = getPayrollPolicy(city);
  return policy ? { ...policy[policy.items[id].base], ...policy.items[id] } : null;
}
export function automaticPayrollAvailable(city, id, date = '2026-11-04') {
  const item = payrollItemPolicy(city, id);
  return !!item && Number.isFinite(item.rate) && Number.isFinite(item.minimumBase)
    && Number.isFinite(item.maximumBase) && date >= item.effectiveFrom && date <= item.effectiveTo;
}
// Tool presets, not a claim of one statutory rate for every city.
export const GENERAL_PAYROLL_RATES = { pension: 8, medical: 2, unemployment: 0.5, fund: 5 };
export function payrollEstimateRule(city, id, date = '2026-11-04') {
  const item = payrollItemPolicy(city, id);
  if (!item) return null;
  const current = date >= item.effectiveFrom && date <= item.effectiveTo;
  const hasBounds = Number.isFinite(item.minimumBase) && Number.isFinite(item.maximumBase);
  const complete = hasBounds && Number.isFinite(item.rate);
  return { ...item,
    rate: current && Number.isFinite(item.rate) ? item.rate : GENERAL_PAYROLL_RATES[id],
    minimumRate: Number.isFinite(item.minimumRate) ? item.minimumRate : 5,
    maximumRate: Number.isFinite(item.maximumRate) ? item.maximumRate : 12,
    usePolicyBounds: current && hasBounds,
    generic: !automaticPayrollAvailable(city, id, date),
    expired: complete && !current,
  };
}
export function defaultPayrollItems(city) {
  const policy = getPayrollPolicy(city);
  return Object.fromEntries(Object.keys(policy.items).map((id) => [id, {
    method: 'percent', rate: payrollEstimateRule(city, id).rate, amount: 0,
  }]));
}
// Only unchanged automatic defaults follow a city change. Manual amounts/bases survive it.
export function switchPayrollCity(config, city) {
  if (!getPayrollPolicy(city)) return config;
  const previous = defaultPayrollItems(config.city);
  const defaults = defaultPayrollItems(city);
  const items = Object.fromEntries(Object.entries(defaults).map(([id, item]) => {
    const current = config.items[id];
    const old = previous[id];
    const unchanged = current?.method === old.method && Number(current.rate) === Number(old.rate)
      && String(current.amount) === String(old.amount) && !current.baseMode && current.taxDeductibleAmount === undefined;
    return [id, unchanged ? item : { ...current }];
  }));
  return { ...config, city, items };
}
export function resetPayrollCity(config) {
  return { ...config, socialBaseMode: 'salary', socialBase: 0, fundBaseMode: 'salary', fundBase: 0, items: defaultPayrollItems(config.city) };
}
