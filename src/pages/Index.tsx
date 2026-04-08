import { useEffect, useRef, useState, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const W = 800;
const H = 500;
const TRACK_MARGIN = 80;
const CAR_W = 28;
const CAR_H = 44;
const LAPS_TO_WIN = 3;

// ─── TRACK DEFINITIONS ───────────────────────────────────────────────────────
const TRACKS = [
  {
    name: "НЕОНОВЫЙ ОВАЛ",
    color: "#00ffcc",
    accent: "#ff00aa",
    path: [
      { x: 150, y: 120 }, { x: 400, y: 80 }, { x: 650, y: 120 },
      { x: 700, y: 250 }, { x: 650, y: 380 }, { x: 400, y: 420 },
      { x: 150, y: 380 }, { x: 100, y: 250 },
    ],
    width: 80,
  },
  {
    name: "КРИВОЛИНЕЙНЫЙ ХАОС",
    color: "#ffff00",
    accent: "#ff4400",
    path: [
      { x: 120, y: 100 }, { x: 300, y: 60 }, { x: 500, y: 140 },
      { x: 680, y: 80 }, { x: 720, y: 240 }, { x: 580, y: 360 },
      { x: 700, y: 420 }, { x: 450, y: 460 }, { x: 200, y: 400 },
      { x: 80, y: 300 },
    ],
    width: 75,
  },
  {
    name: "ЗВЁЗДНЫЙ ПУТЬ",
    color: "#aa88ff",
    accent: "#00ffff",
    path: [
      { x: 200, y: 80 }, { x: 600, y: 80 }, { x: 680, y: 180 },
      { x: 500, y: 240 }, { x: 680, y: 340 }, { x: 600, y: 420 },
      { x: 200, y: 420 }, { x: 120, y: 340 }, { x: 300, y: 240 },
      { x: 120, y: 180 },
    ],
    width: 72,
  },
];

// ─── AUDIO ENGINE ────────────────────────────────────────────────────────────
function createAudio(ctx: AudioContext) {
  const engine = (freq: number, vol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return { osc, gain };
  };

  const beep = (freq: number, dur: number, vol = 0.3) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };

  return { engine, beep };
}

// ─── MATH HELPERS ────────────────────────────────────────────────────────────
function getSplinePoint(pts: { x: number; y: number }[], t: number) {
  const n = pts.length;
  const i = Math.floor(t * n);
  const p0 = pts[(i - 1 + n) % n];
  const p1 = pts[i % n];
  const p2 = pts[(i + 1) % n];
  const p3 = pts[(i + 2) % n];
  const u = t * n - i;
  const u2 = u * u, u3 = u2 * u;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
  };
}

function getSplineTangent(pts: { x: number; y: number }[], t: number) {
  const dt = 0.001;
  const a = getSplinePoint(pts, (t + dt) % 1);
  const b = getSplinePoint(pts, (t - dt + 1) % 1);
  const dx = a.x - b.x, dy = a.y - b.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function isOnTrack(x: number, y: number, pts: { x: number; y: number }[], halfW: number) {
  const N = 200;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const a = getSplinePoint(pts, t0);
    const b = getSplinePoint(pts, t1);
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < halfW) return true;
  }
  return false;
}

function closestT(x: number, y: number, pts: { x: number; y: number }[]) {
  let best = 0, bestDist = 1e9;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const p = getSplinePoint(pts, t);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Car {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  speed: number;
  color: string;
  accent: string;
  name: string;
  lap: number;
  lastT: number;
  crossedStart: boolean;
  trail: { x: number; y: number }[];
  drift: number;
  onTrack: boolean;
  finished: boolean;
}

interface Keys {
  [key: string]: boolean;
}

// ─── GAME SCREEN ─────────────────────────────────────────────────────────────
type Screen = "menu" | "select" | "game" | "results";
type Mode = "solo" | "multi";

// ─── DRAW TRACK ──────────────────────────────────────────────────────────────
function drawTrack(ctx: CanvasRenderingContext2D, track: typeof TRACKS[0]) {
  const N = 300;
  const pts = track.path;
  const hw = track.width / 2;

  // Outer glow
  ctx.save();
  ctx.shadowColor = track.color;
  ctx.shadowBlur = 30;
  ctx.strokeStyle = track.color + "44";
  ctx.lineWidth = track.width + 20;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = getSplinePoint(pts, (i / N) % 1);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Road surface
  ctx.strokeStyle = "#1a1a2e";
  ctx.lineWidth = track.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = getSplinePoint(pts, (i / N) % 1);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // Edge lines
  for (const side of [-1, 1]) {
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (i / N) % 1;
      const p = getSplinePoint(pts, t);
      const tang = getSplineTangent(pts, t);
      const nx = -tang.dy * hw * side;
      const ny = tang.dx * hw * side;
      if (i === 0) ctx.moveTo(p.x + nx, p.y + ny); else ctx.lineTo(p.x + nx, p.y + ny);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Dashed center line
  ctx.setLineDash([15, 15]);
  ctx.strokeStyle = track.accent + "66";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = getSplinePoint(pts, (i / N) % 1);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Start line
  const startPt = getSplinePoint(pts, 0);
  const tang = getSplineTangent(pts, 0);
  const nx = -tang.dy * hw;
  const ny = tang.dx * hw;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(startPt.x - nx, startPt.y - ny);
  ctx.lineTo(startPt.x + nx, startPt.y + ny);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Checkered pattern on start
  const segs = 8;
  for (let s = 0; s < segs; s++) {
    const alpha = s / segs;
    const bx = startPt.x - nx + (nx * 2 * alpha);
    const by = startPt.y - ny + (ny * 2 * alpha);
    ctx.fillStyle = s % 2 === 0 ? "#fff" : "#000";
    ctx.fillRect(bx - 3, by - 6, 6, 12);
  }
}

// ─── DRAW CAR ────────────────────────────────────────────────────────────────
function drawCar(ctx: CanvasRenderingContext2D, car: Car) {
  // Trail
  if (car.trail.length > 1) {
    ctx.save();
    for (let i = 1; i < car.trail.length; i++) {
      const alpha = i / car.trail.length;
      ctx.strokeStyle = car.color + Math.floor(alpha * 100).toString(16).padStart(2, "0");
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.moveTo(car.trail[i - 1].x, car.trail[i - 1].y);
      ctx.lineTo(car.trail[i].x, car.trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(3, 6, CAR_W / 2, CAR_H / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body glow
  ctx.shadowColor = car.color;
  ctx.shadowBlur = 20;

  // Body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 6);
  ctx.fill();

  // Cockpit
  ctx.fillStyle = car.accent;
  ctx.shadowBlur = 10;
  ctx.shadowColor = car.accent;
  ctx.beginPath();
  ctx.roundRect(-CAR_W / 2 + 5, -CAR_H / 2 + 8, CAR_W - 10, CAR_H / 2 - 4, 4);
  ctx.fill();

  // Wheels
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111";
  for (const [wx, wy] of [[-CAR_W / 2 - 3, -CAR_H / 2 + 5], [CAR_W / 2 - 1, -CAR_H / 2 + 5], [-CAR_W / 2 - 3, CAR_H / 2 - 12], [CAR_W / 2 - 1, CAR_H / 2 - 12]]) {
    ctx.fillRect(wx, wy, 5, 10);
  }

  ctx.restore();
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Keys>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const engine2Ref = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const animRef = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("solo");
  const [trackIdx, setTrackIdx] = useState(0);
  const [results, setResults] = useState<{ name: string; laps: number; finished: boolean }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [lapInfo, setLapInfo] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });

  const gameRef = useRef<{
    cars: Car[];
    track: typeof TRACKS[0];
    started: boolean;
    finished: boolean;
  } | null>(null);

  // ── Audio init ──
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    audioCtxRef.current = new AudioCtx();
  }, []);

  const playBeep = useCallback((freq: number, dur = 0.15) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const { beep } = createAudio(ctx);
    beep(freq, dur);
  }, []);

  const startEngines = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const { engine } = createAudio(ctx);
    engineRef.current = engine(80, 0.08);
    if (gameRef.current?.cars[1]) {
      engine2Ref.current = engine(95, 0.06);
    }
  }, []);

  const stopEngines = useCallback(() => {
    engineRef.current?.osc.stop();
    engine2Ref.current?.osc.stop();
    engineRef.current = null;
    engine2Ref.current = null;
  }, []);

  // ── Create cars at start positions ──
  const makeCar = (track: typeof TRACKS[0], offsetT: number, color: string, accent: string, name: string): Car => {
    const p = getSplinePoint(track.path, offsetT);
    const tang = getSplineTangent(track.path, offsetT);
    return {
      x: p.x + tang.dy * 18,
      y: p.y - tang.dx * 18,
      vx: 0, vy: 0,
      angle: Math.atan2(tang.dy, tang.dx) + Math.PI / 2,
      speed: 0,
      color, accent, name,
      lap: 0, lastT: offsetT, crossedStart: false,
      trail: [],
      drift: 0,
      onTrack: true,
      finished: false,
    };
  };

  // ── Start game ──
  const startGame = useCallback((m: Mode, tIdx: number) => {
    setMode(m);
    setTrackIdx(tIdx);
    const track = TRACKS[tIdx];

    const cars: Car[] = [
      makeCar(track, 0.02, "#ff4466", "#ff99aa", m === "multi" ? "ИГРОК 1" : "ИГРОК"),
    ];
    if (m === "multi") {
      const p2 = makeCar(track, 0.04, "#44aaff", "#aaddff", "ИГРОК 2");
      const tang = getSplineTangent(track.path, 0.04);
      p2.x -= tang.dy * 36;
      p2.y += tang.dx * 36;
      cars.push(p2);
    }

    gameRef.current = { cars, track, started: false, finished: false };
    setLapInfo({ p1: 0, p2: 0 });
    setScreen("game");

    // Countdown
    let c = 3;
    setCountdown(c);
    const tick = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(tick);
        setCountdown(0);
        gameRef.current!.started = true;
        initAudio();
        setTimeout(() => {
          playBeep(880, 0.3);
          startEngines();
        }, 100);
      } else {
        setCountdown(c);
        setTimeout(() => playBeep(440, 0.1), 0);
      }
    }, 1000);
  }, [initAudio, playBeep, startEngines]);

  // ── Key handlers ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysRef.current[e.key] = true; e.preventDefault(); };
    const up = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Touch controls ──
  const touchZones = useRef<{ [key: string]: boolean }>({});

  // ── Game loop ──
  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const MAX_SPEED = 4.5;
    const ACCEL = 0.12;
    const BRAKE = 0.08;
    const FRICTION = 0.96;
    const STEER = 0.055;
    const OFF_TRACK_PENALTY = 0.85;

    const update = () => {
      const g = gameRef.current;
      if (!g) return;

      const { cars, track, started } = g;

      // ── Update each car ──
      cars.forEach((car, idx) => {
        if (!started || car.finished) return;

        let accel = 0, steerDir = 0;

        if (idx === 0) {
          const tz = touchZones.current;
          if (keysRef.current["ArrowUp"] || keysRef.current["w"] || keysRef.current["W"] || tz["gas0"]) accel = 1;
          if (keysRef.current["ArrowDown"] || keysRef.current["s"] || keysRef.current["S"] || tz["brake0"]) accel = -0.5;
          if (keysRef.current["ArrowLeft"] || keysRef.current["a"] || keysRef.current["A"] || tz["left0"]) steerDir = -1;
          if (keysRef.current["ArrowRight"] || keysRef.current["d"] || keysRef.current["D"] || tz["right0"]) steerDir = 1;
        } else {
          const tz = touchZones.current;
          if (keysRef.current["i"] || keysRef.current["I"] || tz["gas1"]) accel = 1;
          if (keysRef.current["k"] || keysRef.current["K"] || tz["brake1"]) accel = -0.5;
          if (keysRef.current["j"] || keysRef.current["J"] || tz["left1"]) steerDir = -1;
          if (keysRef.current["l"] || keysRef.current["L"] || tz["right1"]) steerDir = 1;
        }

        // Steering
        if (steerDir !== 0 && Math.abs(car.speed) > 0.2) {
          const steerAmount = STEER * Math.sign(car.speed) * steerDir * Math.min(1, Math.abs(car.speed) / 2);
          car.angle += steerAmount;
          car.drift = steerDir * 0.3;
        } else {
          car.drift *= 0.85;
        }

        // Acceleration / brake
        if (accel > 0) {
          car.speed = Math.min(car.speed + ACCEL, MAX_SPEED);
        } else if (accel < 0) {
          car.speed = Math.max(car.speed - BRAKE, -MAX_SPEED * 0.4);
        } else {
          car.speed *= FRICTION;
        }

        // Check on track
        const onTrk = isOnTrack(car.x, car.y, track.path, track.width / 2 - 4);
        car.onTrack = onTrk;
        if (!onTrk) car.speed *= OFF_TRACK_PENALTY;

        // Move
        car.vx = Math.sin(car.angle + car.drift * 0.15) * car.speed;
        car.vy = -Math.cos(car.angle + car.drift * 0.15) * car.speed;
        car.x += car.vx;
        car.y += car.vy;

        // Clamp to canvas
        car.x = Math.max(CAR_H, Math.min(W - CAR_H, car.x));
        car.y = Math.max(CAR_H, Math.min(H - CAR_H, car.y));

        // Trail
        car.trail.push({ x: car.x, y: car.y });
        if (car.trail.length > 25) car.trail.shift();

        // Lap counting
        const t = closestT(car.x, car.y, track.path);
        const prev = car.lastT;
        // Cross finish at t ≈ 0/1
        if (prev > 0.85 && t < 0.15) {
          car.lap++;
          playBeep(660 + car.lap * 40, 0.2);
          if (car.lap >= LAPS_TO_WIN) {
            car.finished = true;
            playBeep(880, 0.4);
            setTimeout(() => playBeep(1100, 0.4), 200);
            // Check if all done
            const allDone = cars.every(c => c.finished || (!g.started));
            if (allDone || cars.length === 1) {
              g.finished = true;
              stopEngines();
              setTimeout(() => {
                setResults(cars.map(c => ({ name: c.name, laps: c.lap, finished: c.finished })));
                setScreen("results");
              }, 1000);
            }
          }
        }
        car.lastT = t;

        // Engine pitch by speed
        if (idx === 0 && engineRef.current) {
          engineRef.current.osc.frequency.value = 80 + Math.abs(car.speed) * 30;
        }
        if (idx === 1 && engine2Ref.current) {
          engine2Ref.current.osc.frequency.value = 95 + Math.abs(car.speed) * 28;
        }
      });

      setLapInfo({ p1: cars[0]?.lap ?? 0, p2: cars[1]?.lap ?? 0 });

      // ── Draw ──
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, W, H);

      // Stars bg
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 20) % H);
        const sr = (i % 3 === 0) ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      drawTrack(ctx, track);

      cars.forEach(car => drawCar(ctx, car));

      // Car names above
      cars.forEach(car => {
        ctx.save();
        ctx.font = "bold 10px 'Orbitron', monospace";
        ctx.fillStyle = car.color;
        ctx.shadowColor = car.color;
        ctx.shadowBlur = 8;
        ctx.textAlign = "center";
        ctx.fillText(car.name, car.x, car.y - 28);
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [screen, playBeep, stopEngines]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      stopEngines();
    };
  }, [stopEngines]);

  // ── Touch event handler factory ──
  const makeTouchHandler = (key: string, val: boolean) => (e: React.TouchEvent) => {
    e.preventDefault();
    touchZones.current[key] = val;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MENU SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="game-title">
            <span className="title-neon">TURBO</span>
            <span className="title-white"> BLAST</span>
          </div>
          <div className="subtitle-text">АРКАДНЫЕ ГОНКИ</div>

          <div className="menu-buttons">
            <button
              className="menu-btn btn-solo"
              onClick={() => { initAudio(); setScreen("select"); setMode("solo"); }}
            >
              🏎️ ОДИНОЧНАЯ ИГРА
            </button>
            <button
              className="menu-btn btn-multi"
              onClick={() => { initAudio(); setScreen("select"); setMode("multi"); }}
            >
              👥 МУЛЬТИПЛЕЕР
            </button>
          </div>

          <div className="controls-hint">
            <div className="hint-block">
              <div className="hint-title">🎮 УПРАВЛЕНИЕ</div>
              <div className="hint-row">
                <span className="hint-key">↑ ↓ ← →</span>
                <span>— ИГРОК 1</span>
              </div>
              <div className="hint-row">
                <span className="hint-key">I J K L</span>
                <span>— ИГРОК 2</span>
              </div>
              <div className="hint-row">или кнопки на экране</div>
            </div>
          </div>

          <div className="laps-info">🏁 {LAPS_TO_WIN} КРУГА ДО ПОБЕДЫ</div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRACK SELECT
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "select") {
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="select-title">ВЫБЕРИ ТРАССУ</div>
          <div className="track-cards">
            {TRACKS.map((t, i) => (
              <button
                key={i}
                className="track-card"
                style={{ "--track-color": t.color, "--track-accent": t.accent } as React.CSSProperties}
                onClick={() => startGame(mode, i)}
              >
                <div className="track-number">0{i + 1}</div>
                <div className="track-name" style={{ color: t.color }}>{t.name}</div>
                <div className="track-preview">
                  <svg width="120" height="70" viewBox="0 0 800 500">
                    <path
                      d={`M ${t.path.map(p => `${p.x},${p.y}`).join(" L ")} Z`}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="20"
                      strokeLinejoin="round"
                      opacity="0.8"
                    />
                  </svg>
                </div>
                <div className="track-info">ширина: {t.width}м</div>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setScreen("menu")}>← НАЗАД</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "results") {
    const winner = results.find(r => r.finished) || results[0];
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="results-title">🏆 ФИНИШ!</div>
          <div className="winner-name" style={{ color: "#ffdd00" }}>
            {winner?.name} ПОБЕДИЛ!
          </div>
          <div className="results-list">
            {results.map((r, i) => (
              <div key={i} className="result-row" style={{ borderColor: i === 0 ? "#ffdd00" : "#444" }}>
                <span className="result-pos">{i + 1}</span>
                <span className="result-name">{r.name}</span>
                <span className="result-laps">{r.laps} кругов</span>
              </div>
            ))}
          </div>
          <div className="result-buttons">
            <button className="menu-btn btn-solo" onClick={() => startGame(mode, trackIdx)}>
              🔄 СНОВА
            </button>
            <button className="menu-btn btn-multi" onClick={() => { stopEngines(); setScreen("menu"); }}>
              🏠 МЕНЮ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GAME SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  const track = TRACKS[trackIdx];

  return (
    <div className="game-container">
      {/* HUD */}
      <div className="hud">
        <div className="hud-car" style={{ color: "#ff4466" }}>
          🏎️ П1: {lapInfo.p1}/{LAPS_TO_WIN} кр.
        </div>
        <div className="hud-track" style={{ color: track.color }}>{track.name}</div>
        {mode === "multi" && (
          <div className="hud-car" style={{ color: "#44aaff" }}>
            П2: {lapInfo.p2}/{LAPS_TO_WIN} кр. 🏎️
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-num" style={{ color: countdown === 1 ? "#ff4444" : "#ffdd00" }}>
              {countdown}
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="touch-controls">
        {/* Player 1 controls */}
        <div className="touch-pad touch-left">
          <div className="dpad">
            <button
              className="dpad-btn dpad-up"
              onTouchStart={makeTouchHandler("gas0", true)}
              onTouchEnd={makeTouchHandler("gas0", false)}
            >▲</button>
            <div className="dpad-row">
              <button
                className="dpad-btn"
                onTouchStart={makeTouchHandler("left0", true)}
                onTouchEnd={makeTouchHandler("left0", false)}
              >◀</button>
              <button
                className="dpad-btn"
                onTouchStart={makeTouchHandler("brake0", true)}
                onTouchEnd={makeTouchHandler("brake0", false)}
              >▼</button>
              <button
                className="dpad-btn"
                onTouchStart={makeTouchHandler("right0", true)}
                onTouchEnd={makeTouchHandler("right0", false)}
              >▶</button>
            </div>
          </div>
          <div className="pad-label" style={{ color: "#ff4466" }}>ИГРОК 1</div>
        </div>

        {mode === "multi" && (
          <div className="touch-pad touch-right">
            <div className="dpad">
              <button
                className="dpad-btn dpad-up"
                onTouchStart={makeTouchHandler("gas1", true)}
                onTouchEnd={makeTouchHandler("gas1", false)}
              >▲</button>
              <div className="dpad-row">
                <button
                  className="dpad-btn"
                  onTouchStart={makeTouchHandler("left1", true)}
                  onTouchEnd={makeTouchHandler("left1", false)}
                >◀</button>
                <button
                  className="dpad-btn"
                  onTouchStart={makeTouchHandler("brake1", true)}
                  onTouchEnd={makeTouchHandler("brake1", false)}
                >▼</button>
                <button
                  className="dpad-btn"
                  onTouchStart={makeTouchHandler("right1", true)}
                  onTouchEnd={makeTouchHandler("right1", false)}
                >▶</button>
              </div>
            </div>
            <div className="pad-label" style={{ color: "#44aaff" }}>ИГРОК 2</div>
          </div>
        )}
      </div>

      {/* Back button */}
      <button className="back-btn-game" onClick={() => { stopEngines(); setScreen("menu"); }}>
        ✕ МЕНЮ
      </button>
    </div>
  );
}