/** Renderer Canvas del mateix model que pinta l'SVG de la portada. */

import type { Palette } from '../../styles/palette';
import { withAlpha } from '../../styles/palette';
import type { FingerprintModel } from './model';

export function drawFingerprint(
  ctx: CanvasRenderingContext2D,
  model: FingerprintModel,
  cx: number,
  cy: number,
  size: number,
  palette: Palette,
): void {
  const radius = size * 0.44;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.bgInset, 0.82);
  ctx.fill();
  ctx.strokeStyle = palette.borderSubtle;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  model.horizon.forEach((point, index) => {
    const x = cx + (point.x - 0.5) * size;
    const y = cy + (point.y - 0.5) * size;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = palette.bgInset;
  ctx.fill();
  ctx.strokeStyle = model.terrain === 'measured' ? palette.textSecondary : palette.statusInfo;
  ctx.setLineDash(model.terrain === 'measured' ? [] : [5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(cx, cy, model.sunRadius * size, 0, Math.PI * 2);
  ctx.fillStyle = palette.corona100;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + model.separation * size, cy, model.moonRadius * size, 0, Math.PI * 2);
  ctx.fillStyle = palette.bgPage;
  ctx.fill();

  if (model.metric !== null) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + model.metric * Math.PI * 2);
    ctx.strokeStyle = palette.statusClear;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}
