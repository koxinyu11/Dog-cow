/** Draw a standalone receipt, independent of window scroll position and theme. */
export function receiptPng(date: string, amount: string, rows: string[][]) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 510 + rows.length * 52;
  const c = canvas.getContext('2d');
  if (!c) throw Error('图片生成失败，请重试。');
  c.fillStyle = '#fffaf0'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#3f453a'; c.textAlign = 'center'; c.font = 'bold 28px sans-serif';
  c.fillText('狗牛 · 收工结算单', 360, 64);
  c.font = '20px sans-serif'; c.fillText(date, 360, 108);
  c.fillText('今日计薪收入', 360, 172);
  c.font = 'bold 48px sans-serif'; c.fillText(amount, 360, 237, 620);
  c.strokeStyle = '#b8bdad'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(50, 270); c.lineTo(670, 270); c.stroke(); c.setLineDash([]);
  c.font = '22px sans-serif';
  rows.forEach(([label, value], i) => {
    c.textAlign = 'left'; c.fillText(label, 50, 320 + i * 52);
    c.textAlign = 'right'; c.fillText(value, 670, 320 + i * 52, 400);
  });
  const bottom = 330 + rows.length * 52;
  c.textAlign = 'center'; c.strokeStyle = '#487a54'; c.fillStyle = '#487a54'; c.lineWidth = 3;
  c.strokeRect(235, bottom, 250, 52); c.font = 'bold 26px sans-serif'; c.fillText('今日已收工', 360, bottom + 35);
  c.font = '20px sans-serif'; c.fillStyle = '#3f453a'; c.fillText('今天的努力已签收，接下来，快乐归你。', 360, bottom + 110);
  c.fillStyle = '#ffffff';
  for (let x = 0; x < 720; x += 24) { c.beginPath(); c.moveTo(x, canvas.height); c.lineTo(x + 12, canvas.height - 10); c.lineTo(x + 24, canvas.height); c.fill(); }
  return canvas.toDataURL('image/png');
}
