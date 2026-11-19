export interface Point {
  x: number;
  y: number;
}
export const door: Point = { x: 482, y: 589 };
export const pickup: Point = { x: 635, y: 232 };
export function tablePosition(index: number) {
  return { x: 190 + (index % 3) * 147, y: 208 + Math.floor(index / 3) * 117 };
}
export function seatPosition(seat: number): Point {
  const table = tablePosition(Math.floor(seat / 2));
  return { x: table.x + (seat % 2 ? 34 : -34), y: table.y + 5 };
}
export function queuePosition(index: number): Point {
  return { x: 593 + (index >= 8 ? 31 : 0), y: 303 + Math.min(index, 8) * 25 };
}
export function along(points: Point[], amount: number): Point {
  const value = Math.max(0, Math.min(1, amount)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(value));
  const t = value - index;
  return {
    x: points[index].x + (points[index + 1].x - points[index].x) * t,
    y: points[index].y + (points[index + 1].y - points[index].y) * t,
  };
}
