/** Draw a standalone IOU note, independent of window scroll position and theme. */
export function iouPng({ date, amount, rows, rank, title }: { date: string; amount: string; rows: string[][]; rank: string; title: string }) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 560 + rows.length * 52;
  const c = canvas.getContext('2d');
  if (!c) throw Error('图片生成失败，请重试。');
  c.fillStyle = '#fff6e8'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#c0392b'; c.lineWidth = 4; c.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  c.fillStyle = '#3f2a1e'; c.textAlign = 'center'; c.font = 'bold 40px serif';
  c.fillText('欠  条', 360, 92);
  c.font = '20px sans-serif'; c.fillText(`${title} · ${date}`, 360, 132);
  c.textAlign = 'left'; c.font = '22px sans-serif';
  c.fillText('今欠打工人以下款项，因加班产生，特此为证：', 60, 190, 600);
  c.textAlign = 'center'; c.font = 'bold 52px sans-serif'; c.fillStyle = '#c0392b';
  c.fillText(amount, 360, 262, 600);
  c.fillStyle = '#3f2a1e'; c.strokeStyle = '#b8a48f'; c.lineWidth = 2; c.setLineDash([6, 6]);
  c.beginPath(); c.moveTo(60, 296); c.lineTo(660, 296); c.stroke(); c.setLineDash([]);
  c.font = '22px sans-serif';
  rows.forEach(([label, value], i) => {
    c.textAlign = 'left'; c.fillText(label, 60, 346 + i * 52);
    c.textAlign = 'right'; c.fillText(value, 660, 346 + i * 52, 400);
  });
  const bottom = 360 + rows.length * 52;
  c.textAlign = 'left'; c.font = '20px sans-serif';
  c.fillText('欠款人：老板（拒不签字）', 60, bottom + 40);
  c.fillText('债权人：本牛马', 60, bottom + 80);
  // Red seal with the current rank.
  c.save(); c.translate(560, bottom + 60); c.rotate(-0.2);
  c.strokeStyle = '#c0392b'; c.fillStyle = '#c0392b'; c.lineWidth = 4;
  c.beginPath(); c.arc(0, 0, 70, 0, Math.PI * 2); c.stroke();
  c.textAlign = 'center'; c.font = 'bold 24px sans-serif'; c.fillText(rank, 0, 9, 120);
  c.restore();
  c.textAlign = 'center'; c.fillStyle = '#8a7461'; c.font = '16px sans-serif';
  c.fillText('本欠条仅供娱乐，不具法律效力；但钱确实是你的。', 360, canvas.height - 48);
  return canvas.toDataURL('image/png');
}
