import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createPerforatedGrilleTexture(
  bgHex = '#2a313d',
  holeHex = '#0a0d12',
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  const step = 16;
  ctx.fillStyle = holeHex;
  for (let y = 0; y < 256; y += step) {
    const offset = (Math.floor(y / step) % 2) * (step / 2);
    for (let x = -step; x < 256 + step; x += step) {
      ctx.beginPath();
      ctx.arc(x + offset, y + step / 2, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export function createBrushedMetalTexture(baseHex = '#1e2633'): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const y = Math.random() * 256;
    const alpha = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function createFloorGridTexture(
  bgHex = '#0f1623',
  lineHex = '#1e2c42',
  accentHex = '#164e63',
  repeatX = 10,
  repeatY = 10
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle tile speckles
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export function createCopperWindingTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 6) {
    const grad = ctx.createLinearGradient(0, y, 0, y + 6);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.45, '#f59e0b');
    grad.addColorStop(0.75, '#d97706');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 256, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = 8;
  return tex;
}

export function createPcbTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#06382b';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.45;
  for (let x = 20; x < 500; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x, 120);
    ctx.lineTo(x + 14, 140);
    ctx.lineTo(x + 14, 240);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fbbf24';
  for (let x = 34; x < 490; x += 56) {
    ctx.beginPath();
    ctx.arc(x, 60, 4, 0, Math.PI * 2);
    ctx.arc(x + 14, 196, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createAcousticFoamTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 2.2;
    ctx.fillStyle = i % 3 === 0 ? '#090c12' : '#1f2735';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}
