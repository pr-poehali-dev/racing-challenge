import { useEffect, useRef, useState, useCallback } from "react";

const W = 960;
const H = 540;
const LAPS_TO_WIN = 3;
const ROAD_W = 2200;
const SEG_LEN = 200;
const DRAW_DIST = 120;
const FOV = 120;
const CAM_HEIGHT = 1600;
const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);

interface Segment {
  index: number;
  p: { world: { x: number; y: number; z: number; w: number }; screen: { x: number; y: number; w: number }; scale: number };
  q: { world: { x: number; y: number; z: number; w: number }; screen: { x: number; y: number; w: number }; scale: number };
  curve: number;
  hill: number;
  color: { road: string; grass: string; rumble: string; lane: string };
  sprite?: { type: string; offset: number };
}

interface TrackDef {
  name: string;
  color: string;
  accent: string;
  length: number;
  curves: { start: number; end: number; val: number }[];
  hills: { start: number; end: number; val: number }[];
  sprites: { pos: number; type: string; offset: number }[];
}

const TRACKS: TrackDef[] = [
  {
    name: "НЕОНОВЫЙ КАНЬОН",
    color: "#00ffcc",
    accent: "#ff00aa",
    length: 300,
    curves: [
      { start: 20, end: 50, val: 3 }, { start: 60, end: 90, val: -4 },
      { start: 110, end: 140, val: 5 }, { start: 160, end: 190, val: -3 },
      { start: 210, end: 240, val: 2 }, { start: 260, end: 285, val: -4 },
    ],
    hills: [
      { start: 15, end: 40, val: 30 }, { start: 50, end: 80, val: -20 },
      { start: 100, end: 130, val: 40 }, { start: 170, end: 200, val: -30 },
      { start: 230, end: 260, val: 25 },
    ],
    sprites: [
      { pos: 10, type: "tree", offset: -1.2 }, { pos: 10, type: "tree", offset: 1.3 },
      { pos: 30, type: "rock", offset: 1.5 }, { pos: 55, type: "tree", offset: -1.4 },
      { pos: 70, type: "sign", offset: 1.6 }, { pos: 95, type: "tree", offset: -1.3 },
      { pos: 120, type: "rock", offset: 1.4 }, { pos: 145, type: "tree", offset: -1.5 },
      { pos: 170, type: "sign", offset: -1.6 }, { pos: 195, type: "tree", offset: 1.3 },
      { pos: 220, type: "rock", offset: -1.4 }, { pos: 250, type: "tree", offset: 1.5 },
      { pos: 275, type: "sign", offset: -1.3 },
    ],
  },
  {
    name: "КИБЕР-ШОССЕ",
    color: "#ffff00",
    accent: "#ff4400",
    length: 280,
    curves: [
      { start: 15, end: 40, val: -5 }, { start: 50, end: 80, val: 6 },
      { start: 95, end: 120, val: -4 }, { start: 140, end: 175, val: 3 },
      { start: 190, end: 220, val: -6 }, { start: 240, end: 270, val: 4 },
    ],
    hills: [
      { start: 10, end: 35, val: 35 }, { start: 45, end: 75, val: -40 },
      { start: 90, end: 120, val: 50 }, { start: 150, end: 180, val: -25 },
      { start: 200, end: 235, val: 35 }, { start: 250, end: 270, val: -20 },
    ],
    sprites: [
      { pos: 8, type: "lamp", offset: -1.1 }, { pos: 8, type: "lamp", offset: 1.1 },
      { pos: 25, type: "tree", offset: -1.4 }, { pos: 50, type: "rock", offset: 1.5 },
      { pos: 75, type: "lamp", offset: -1.1 }, { pos: 75, type: "lamp", offset: 1.1 },
      { pos: 100, type: "sign", offset: 1.6 }, { pos: 130, type: "tree", offset: -1.5 },
      { pos: 155, type: "lamp", offset: -1.1 }, { pos: 155, type: "lamp", offset: 1.1 },
      { pos: 180, type: "rock", offset: -1.4 }, { pos: 210, type: "tree", offset: 1.3 },
      { pos: 240, type: "lamp", offset: -1.1 }, { pos: 240, type: "lamp", offset: 1.1 },
    ],
  },
  {
    name: "ЗВЁЗДНЫЙ СПРИНТ",
    color: "#aa88ff",
    accent: "#00ffff",
    length: 260,
    curves: [
      { start: 10, end: 35, val: 4 }, { start: 45, end: 70, val: -3 },
      { start: 85, end: 115, val: 6 }, { start: 130, end: 155, val: -5 },
      { start: 170, end: 200, val: 3 }, { start: 215, end: 250, val: -4 },
    ],
    hills: [
      { start: 5, end: 30, val: 45 }, { start: 40, end: 65, val: -35 },
      { start: 80, end: 110, val: 55 }, { start: 125, end: 155, val: -45 },
      { start: 175, end: 205, val: 30 }, { start: 220, end: 250, val: -25 },
    ],
    sprites: [
      { pos: 5, type: "tree", offset: -1.3 }, { pos: 5, type: "tree", offset: 1.3 },
      { pos: 20, type: "sign", offset: 1.5 }, { pos: 40, type: "rock", offset: -1.5 },
      { pos: 60, type: "tree", offset: 1.4 }, { pos: 85, type: "lamp", offset: -1.1 },
      { pos: 85, type: "lamp", offset: 1.1 }, { pos: 110, type: "tree", offset: -1.4 },
      { pos: 135, type: "sign", offset: -1.6 }, { pos: 160, type: "rock", offset: 1.5 },
      { pos: 190, type: "tree", offset: -1.3 }, { pos: 220, type: "lamp", offset: -1.1 },
      { pos: 220, type: "lamp", offset: 1.1 }, { pos: 245, type: "tree", offset: 1.4 },
    ],
  },
];

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
  const beep = (freq: number, dur: number, vol = 0.25) => {
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

function buildSegments(track: TrackDef): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < track.length; i++) {
    let curve = 0;
    for (const c of track.curves) {
      if (i >= c.start && i < c.end) {
        const mid = (c.start + c.end) / 2;
        const halfLen = (c.end - c.start) / 2;
        curve = c.val * Math.cos(((i - mid) / halfLen) * Math.PI * 0.5);
      }
    }
    let hill = 0;
    for (const h of track.hills) {
      if (i >= h.start && i < h.end) {
        const mid = (h.start + h.end) / 2;
        const halfLen = (h.end - h.start) / 2;
        hill = h.val * Math.sin(((i - mid) / halfLen) * Math.PI);
      }
    }
    const clr = i % 2 === 0;
    const seg: Segment = {
      index: i,
      p: { world: { x: 0, y: hill * SEG_LEN, z: i * SEG_LEN, w: ROAD_W }, screen: { x: 0, y: 0, w: 0 }, scale: 0 },
      q: { world: { x: 0, y: hill * SEG_LEN, z: (i + 1) * SEG_LEN, w: ROAD_W }, screen: { x: 0, y: 0, w: 0 }, scale: 0 },
      curve,
      hill,
      color: {
        road: clr ? "#333340" : "#2a2a38",
        grass: clr ? "#0a1a0a" : "#0d220d",
        rumble: clr ? track.color : "#222",
        lane: clr ? "#ffffff22" : "transparent",
      },
    };
    const spr = track.sprites.find(s => s.pos === i);
    if (spr) seg.sprite = { type: spr.type, offset: spr.offset };
    segs.push(seg);
  }
  return segs;
}

function project(point: { world: { x: number; y: number; z: number; w: number }; screen: { x: number; y: number; w: number }; scale: number }, camX: number, camY: number, camZ: number) {
  const rx = point.world.x - camX;
  const ry = point.world.y - camY;
  const rz = point.world.z - camZ;
  if (rz <= 0) { point.scale = 0; return; }
  point.scale = CAM_DEPTH / rz;
  point.screen.x = Math.round(W / 2 + point.scale * rx * W / 2);
  point.screen.y = Math.round(H / 2 - point.scale * ry * W / 2);
  point.screen.w = Math.round(point.scale * point.world.w * W / 2);
}

function drawPoly(ctx: CanvasRenderingContext2D, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

function drawSprite(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, scale: number, trackColor: string) {
  const s = scale * 5000;
  if (s < 2) return;
  ctx.save();
  ctx.translate(x, y);
  if (type === "tree") {
    ctx.fillStyle = "#001a00";
    ctx.fillRect(-s * 0.1, -s * 1.8, s * 0.2, s * 1.2);
    ctx.fillStyle = "#005500";
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = s * 0.4;
    ctx.beginPath();
    ctx.arc(0, -s * 2, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 2.5, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (type === "rock") {
    ctx.fillStyle = "#333";
    ctx.shadowColor = "#666";
    ctx.shadowBlur = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.3, -s * 0.6);
    ctx.lineTo(s * 0.1, -s * 0.8);
    ctx.lineTo(s * 0.4, -s * 0.5);
    ctx.lineTo(s * 0.35, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (type === "sign") {
    ctx.fillStyle = "#555";
    ctx.fillRect(-s * 0.05, -s * 1.6, s * 0.1, s * 1.6);
    ctx.fillStyle = trackColor;
    ctx.shadowColor = trackColor;
    ctx.shadowBlur = s * 0.5;
    ctx.beginPath();
    ctx.roundRect(-s * 0.35, -s * 2.0, s * 0.7, s * 0.5, s * 0.05);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `bold ${Math.max(6, s * 0.18)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.shadowBlur = 0;
    ctx.fillText("⚡", 0, -s * 1.65);
  } else if (type === "lamp") {
    ctx.fillStyle = "#444";
    ctx.fillRect(-s * 0.03, -s * 2.5, s * 0.06, s * 2.5);
    ctx.fillStyle = "#ffdd00";
    ctx.shadowColor = "#ffdd00";
    ctx.shadowBlur = s * 1;
    ctx.beginPath();
    ctx.arc(0, -s * 2.5, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffdd0022";
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.lineTo(-s * 0.08, -s * 2.3);
    ctx.lineTo(s * 0.08, -s * 2.3);
    ctx.lineTo(s * 0.5, 0);
    ctx.fill();
  }
  ctx.restore();
}

function drawCar3D(ctx: CanvasRenderingContext2D, x: number, y: number, steer: number, speed: number, color: string, accent: string) {
  const bw = 60, bh = 30;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(5, 8, bw * 0.55, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = color;
  ctx.shadowBlur = 25;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(-bw / 2 + 8, -bh);
  ctx.lineTo(bw / 2 - 8, -bh);
  ctx.lineTo(bw / 2, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + 14, -bh + 3);
  ctx.lineTo(-bw / 2 + 18, -bh - 12);
  ctx.lineTo(bw / 2 - 18, -bh - 12);
  ctx.lineTo(bw / 2 - 14, -bh + 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#111";
  const wheelY = -3;
  const wheelSkew = steer * 4;
  ctx.fillRect(-bw / 2 - 6 + wheelSkew, wheelY - 6, 8, 12);
  ctx.fillRect(bw / 2 - 2 + wheelSkew, wheelY - 6, 8, 12);
  ctx.fillRect(-bw / 2 - 4, wheelY + 2, 8, 10);
  ctx.fillRect(bw / 2, wheelY + 2, 8, 10);

  if (speed > 2) {
    ctx.fillStyle = "#ff440066";
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-6, 10 + speed * 3);
    ctx.lineTo(0, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(6, 10 + speed * 3);
    ctx.lineTo(12, 4);
    ctx.fill();
  }

  ctx.restore();
}

type Screen = "menu" | "select" | "game" | "results";
type Mode = "solo" | "multi";

interface GameState {
  segments: Segment[];
  trackDef: TrackDef;
  position: number;
  speed: number;
  playerX: number;
  steer: number;
  lap: number;
  lastSegIdx: number;
  started: boolean;
  finished: boolean;
  p2position: number;
  p2speed: number;
  p2playerX: number;
  p2steer: number;
  p2lap: number;
  p2lastSegIdx: number;
  p2finished: boolean;
}

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const animRef = useRef<number>(0);
  const gameRef = useRef<GameState | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("solo");
  const [trackIdx, setTrackIdx] = useState(0);
  const [results, setResults] = useState<{ name: string; laps: number; finished: boolean }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [lapInfo, setLapInfo] = useState({ p1: 0, p2: 0 });

  const touchZones = useRef<Record<string, boolean>>({});

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    audioCtxRef.current = new AudioCtx();
  }, []);

  const playBeep = useCallback((freq: number, dur = 0.15) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    createAudio(ctx).beep(freq, dur);
  }, []);

  const startEngines = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    engineRef.current = createAudio(ctx).engine(80, 0.06);
  }, []);

  const stopEngines = useCallback(() => {
    try { engineRef.current?.osc.stop(); } catch (_) { /* ok */ }
    engineRef.current = null;
  }, []);

  const startGame = useCallback((m: Mode, tIdx: number) => {
    setMode(m);
    setTrackIdx(tIdx);
    const trackDef = TRACKS[tIdx];
    const segments = buildSegments(trackDef);

    const gs: GameState = {
      segments, trackDef,
      position: 0, speed: 0, playerX: 0, steer: 0,
      lap: 0, lastSegIdx: 0, started: false, finished: false,
      p2position: 2 * SEG_LEN, p2speed: 0, p2playerX: 0.3, p2steer: 0,
      p2lap: 0, p2lastSegIdx: 2, p2finished: false,
    };

    gameRef.current = gs;
    setLapInfo({ p1: 0, p2: 0 });
    setScreen("game");

    let c = 3;
    setCountdown(c);
    const tick = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(tick);
        setCountdown(0);
        if (gameRef.current) gameRef.current.started = true;
        initAudio();
        setTimeout(() => { playBeep(880, 0.3); startEngines(); }, 100);
      } else {
        setCountdown(c);
        setTimeout(() => playBeep(440, 0.1), 0);
      }
    }, 1000);
  }, [initAudio, playBeep, startEngines]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysRef.current[e.key] = true; if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault(); };
    const up = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const MAX_SPEED = 22;
    const ACCEL = 0.35;
    const BRAKE = 0.6;
    const DECEL = 0.15;
    const STEER_SPEED = 0.035;
    const OFF_ROAD_LIMIT = 0.8;
    const CENTRIFUGAL = 0.0025;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.667, 2);
      lastTime = now;
      const g = gameRef.current;
      if (!g) return;
      const { segments: segs, trackDef } = g;
      const trackLen = segs.length * SEG_LEN;

      if (g.started && !g.finished) {
        const tz = touchZones.current;
        const k = keysRef.current;
        let accel = 0, steerDir = 0;
        if (k["ArrowUp"] || k["w"] || k["W"] || tz["gas0"]) accel = 1;
        if (k["ArrowDown"] || k["s"] || k["S"] || tz["brake0"]) accel = -1;
        if (k["ArrowLeft"] || k["a"] || k["A"] || tz["left0"]) steerDir = -1;
        if (k["ArrowRight"] || k["d"] || k["D"] || tz["right0"]) steerDir = 1;

        if (accel > 0) g.speed = Math.min(g.speed + ACCEL * dt, MAX_SPEED);
        else if (accel < 0) g.speed = Math.max(g.speed - BRAKE * dt, -3);
        else g.speed = g.speed > 0 ? Math.max(0, g.speed - DECEL * dt) : Math.min(0, g.speed + DECEL * dt);

        if (steerDir !== 0) g.steer = steerDir;
        else g.steer = 0;
        g.playerX += steerDir * STEER_SPEED * dt * (g.speed / MAX_SPEED + 0.3);

        const offRoad = Math.abs(g.playerX) > OFF_ROAD_LIMIT;
        if (offRoad && g.speed > 3) g.speed -= 0.5 * dt;
        if (g.playerX > 2) g.playerX = 2;
        if (g.playerX < -2) g.playerX = -2;

        const segIdx = Math.floor(g.position / SEG_LEN) % segs.length;
        const curCurve = segs[segIdx]?.curve || 0;
        g.playerX -= curCurve * CENTRIFUGAL * g.speed * dt;

        g.position += g.speed * SEG_LEN * 0.003 * dt;
        if (g.position < 0) g.position += trackLen;

        const newSegIdx = Math.floor(g.position / SEG_LEN) % segs.length;
        if (newSegIdx < g.lastSegIdx && g.lastSegIdx > segs.length * 0.8 && newSegIdx < segs.length * 0.2) {
          g.lap++;
          playBeep(660 + g.lap * 50, 0.2);
          if (g.lap >= LAPS_TO_WIN) {
            g.finished = true;
            playBeep(880, 0.4);
            setTimeout(() => playBeep(1100, 0.4), 200);
            stopEngines();
            setTimeout(() => {
              const res = [{ name: mode === "multi" ? "ИГРОК 1" : "ИГРОК", laps: g.lap, finished: true }];
              if (mode === "multi") res.push({ name: "ИГРОК 2", laps: g.p2lap, finished: g.p2finished });
              setResults(res);
              setScreen("results");
            }, 1500);
          }
        }
        g.lastSegIdx = newSegIdx;

        if (engineRef.current) {
          engineRef.current.osc.frequency.value = 80 + Math.abs(g.speed) * 8;
          engineRef.current.gain.gain.value = 0.03 + Math.abs(g.speed) / MAX_SPEED * 0.06;
        }

        if (mode === "multi" && !g.p2finished) {
          let a2 = 0, s2 = 0;
          if (k["i"] || k["I"] || tz["gas1"]) a2 = 1;
          if (k["k"] || k["K"] || tz["brake1"]) a2 = -1;
          if (k["j"] || k["J"] || tz["left1"]) s2 = -1;
          if (k["l"] || k["L"] || tz["right1"]) s2 = 1;
          if (a2 > 0) g.p2speed = Math.min(g.p2speed + ACCEL * dt, MAX_SPEED);
          else if (a2 < 0) g.p2speed = Math.max(g.p2speed - BRAKE * dt, -3);
          else g.p2speed = g.p2speed > 0 ? Math.max(0, g.p2speed - DECEL * dt) : Math.min(0, g.p2speed + DECEL * dt);
          g.p2steer = s2;
          g.p2playerX += s2 * STEER_SPEED * dt * (g.p2speed / MAX_SPEED + 0.3);
          if (Math.abs(g.p2playerX) > OFF_ROAD_LIMIT && g.p2speed > 3) g.p2speed -= 0.5 * dt;
          g.p2playerX = Math.max(-2, Math.min(2, g.p2playerX));
          const s2Idx = Math.floor(g.p2position / SEG_LEN) % segs.length;
          const c2 = segs[s2Idx]?.curve || 0;
          g.p2playerX -= c2 * CENTRIFUGAL * g.p2speed * dt;
          g.p2position += g.p2speed * SEG_LEN * 0.003 * dt;
          if (g.p2position < 0) g.p2position += trackLen;
          const ns2 = Math.floor(g.p2position / SEG_LEN) % segs.length;
          if (ns2 < g.p2lastSegIdx && g.p2lastSegIdx > segs.length * 0.8 && ns2 < segs.length * 0.2) {
            g.p2lap++;
            playBeep(550 + g.p2lap * 50, 0.15);
            if (g.p2lap >= LAPS_TO_WIN && !g.finished) {
              g.p2finished = true;
              g.finished = true;
              stopEngines();
              setTimeout(() => {
                setResults([
                  { name: "ИГРОК 1", laps: g.lap, finished: false },
                  { name: "ИГРОК 2", laps: g.p2lap, finished: true },
                ]);
                setScreen("results");
              }, 1500);
            }
          }
          g.p2lastSegIdx = ns2;
        }
      }

      setLapInfo({ p1: g.lap, p2: g.p2lap });

      ctx.fillStyle = "#000010";
      ctx.fillRect(0, 0, W, H);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, H / 2);
      skyGrad.addColorStop(0, "#020015");
      skyGrad.addColorStop(0.5, "#0a0030");
      skyGrad.addColorStop(1, "#150040");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H / 2);

      for (let i = 0; i < 80; i++) {
        const sx = (i * 173 + 47) % W;
        const sy = (i * 89 + 13) % (H / 2);
        const bright = 0.3 + (i % 5) * 0.15;
        ctx.fillStyle = `rgba(255,255,255,${bright})`;
        ctx.beginPath();
        ctx.arc(sx, sy, i % 4 === 0 ? 1.5 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      const baseSeg = Math.floor(g.position / SEG_LEN);
      let camY = CAM_HEIGHT;
      const bsi = baseSeg % segs.length;
      if (segs[bsi]) {
        const segPct = (g.position % SEG_LEN) / SEG_LEN;
        const curH = segs[bsi].p.world.y;
        const nextH = segs[(bsi + 1) % segs.length]?.p.world.y || curH;
        camY += curH + (nextH - curH) * segPct;
      }

      let cumCurve = 0;
      let x = 0;
      let maxY = H;

      for (let n = 0; n < DRAW_DIST; n++) {
        const idx = (baseSeg + n) % segs.length;
        const seg = segs[idx];
        if (!seg) continue;

        const pz = (baseSeg + n) * SEG_LEN;
        const qz = (baseSeg + n + 1) * SEG_LEN;

        seg.p.world.z = pz;
        seg.q.world.z = qz;
        seg.p.world.x = cumCurve;
        cumCurve += seg.curve;
        seg.q.world.x = cumCurve;

        project(seg.p, g.playerX * ROAD_W, camY, g.position);
        project(seg.q, g.playerX * ROAD_W, camY, g.position);

        seg.p.screen.x += x;
        seg.q.screen.x += x;

        x += seg.p.screen.w > 0 ? (seg.curve * seg.p.scale * W * 0.8) : 0;

        if (seg.p.scale <= 0 || seg.q.screen.y >= maxY) continue;

        const p = seg.p.screen;
        const q = seg.q.screen;

        drawPoly(ctx, p.x, p.y, W * 10, q.x, q.y, W * 10, seg.color.grass);
        drawPoly(ctx, p.x, p.y, p.w * 1.15, q.x, q.y, q.w * 1.15, seg.color.rumble);
        drawPoly(ctx, p.x, p.y, p.w, q.x, q.y, q.w, seg.color.road);

        if (seg.color.lane !== "transparent") {
          const lw1 = p.w / 6, lw2 = q.w / 6;
          for (let l = -2; l <= 2; l++) {
            if (l === 0) continue;
            const lx1 = p.x + (l / 3) * p.w;
            const lx2 = q.x + (l / 3) * q.w;
            drawPoly(ctx, lx1, p.y, lw1 * 0.08, lx2, q.y, lw2 * 0.08, seg.color.lane);
          }
        }

        if (idx === 0) {
          const checkW1 = p.w * 0.95, checkW2 = q.w * 0.95;
          const numChecks = 12;
          for (let c = 0; c < numChecks; c++) {
            const frac = c / numChecks;
            const cx1 = p.x - checkW1 + frac * checkW1 * 2;
            const cx2 = q.x - checkW2 + frac * checkW2 * 2;
            const cw1 = checkW1 * 2 / numChecks;
            const cw2 = checkW2 * 2 / numChecks;
            drawPoly(ctx, cx1, p.y, cw1 / 2, cx2, q.y, cw2 / 2, c % 2 === 0 ? "#fff" : "#111");
          }
        }

        if (seg.q.screen.y < maxY) maxY = seg.q.screen.y;
      }

      const spriteSegs: { seg: Segment; dist: number }[] = [];
      for (let n = DRAW_DIST - 1; n > 0; n--) {
        const idx = (baseSeg + n) % segs.length;
        const seg = segs[idx];
        if (seg?.sprite && seg.p.scale > 0) {
          spriteSegs.push({ seg, dist: n });
        }
      }

      for (const { seg } of spriteSegs) {
        if (!seg.sprite) continue;
        const sprX = seg.p.screen.x + seg.p.screen.w * seg.sprite.offset;
        const sprY = seg.p.screen.y;
        drawSprite(ctx, seg.sprite.type, sprX, sprY, seg.p.scale, trackDef.color);
      }

      if (mode === "multi") {
        const p2RelZ = g.p2position - g.position;
        const trackLen = segs.length * SEG_LEN;
        let dz = p2RelZ;
        if (dz > trackLen / 2) dz -= trackLen;
        if (dz < -trackLen / 2) dz += trackLen;

        if (dz > 0 && dz < DRAW_DIST * SEG_LEN) {
          const fakePt = {
            world: { x: g.p2playerX * ROAD_W + cumCurve * (dz / (DRAW_DIST * SEG_LEN)), y: camY - CAM_HEIGHT, z: g.position + dz, w: 120 },
            screen: { x: 0, y: 0, w: 0 },
            scale: 0,
          };
          project(fakePt, g.playerX * ROAD_W, camY, g.position);
          if (fakePt.scale > 0) {
            const sz = fakePt.scale * 30000;
            if (sz > 5) {
              drawCar3D(ctx, fakePt.screen.x, fakePt.screen.y, g.p2steer, g.p2speed, "#44aaff", "#aaddff");
            }
          }
        }
      }

      drawCar3D(ctx, W / 2, H - 100, g.steer, g.speed, "#ff4466", "#ff99aa");

      if (g.speed > 8) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.15, (g.speed - 8) * 0.015);
        const linesGrad = ctx.createLinearGradient(0, 0, 0, H);
        linesGrad.addColorStop(0, "transparent");
        linesGrad.addColorStop(0.7, "transparent");
        linesGrad.addColorStop(1, "#ffffff");
        ctx.fillStyle = linesGrad;
        for (let l = 0; l < 8; l++) {
          const lx = W * 0.1 + (l * W * 0.1) + (g.playerX * -30);
          ctx.fillRect(lx, H * 0.5, 2, H * 0.5);
        }
        ctx.restore();
      }

      const spdKmh = Math.floor(Math.abs(g.speed) * 15);
      ctx.save();
      ctx.font = "bold 28px 'Orbitron', monospace";
      ctx.fillStyle = spdKmh > 250 ? "#ff4444" : "#00ffcc";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 15;
      ctx.textAlign = "right";
      ctx.fillText(`${spdKmh} KM/H`, W - 20, H - 20);
      ctx.restore();

      ctx.save();
      ctx.font = "bold 14px 'Orbitron', monospace";
      ctx.fillStyle = "#ffdd00";
      ctx.shadowColor = "#ffdd00";
      ctx.shadowBlur = 8;
      ctx.textAlign = "left";
      ctx.fillText(`КРУГ ${Math.min(g.lap + 1, LAPS_TO_WIN)}/${LAPS_TO_WIN}`, 20, H - 20);
      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [screen, mode, playBeep, stopEngines]);

  useEffect(() => { return () => { stopEngines(); }; }, [stopEngines]);

  const makeTouchHandler = (key: string, val: boolean) => (e: React.TouchEvent) => {
    e.preventDefault();
    touchZones.current[key] = val;
  };

  if (screen === "menu") {
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="game-title">
            <span className="title-neon">TURBO</span>
            <span className="title-white"> BLAST</span>
          </div>
          <div className="subtitle-text">3D АРКАДНЫЕ ГОНКИ</div>
          <div className="menu-buttons">
            <button className="menu-btn btn-solo" onClick={() => { initAudio(); setScreen("select"); setMode("solo"); }}>
              🏎️ ОДИНОЧНАЯ ИГРА
            </button>
            <button className="menu-btn btn-multi" onClick={() => { initAudio(); setScreen("select"); setMode("multi"); }}>
              👥 МУЛЬТИПЛЕЕР
            </button>
          </div>
          <div className="controls-hint">
            <div className="hint-block">
              <div className="hint-title">🎮 УПРАВЛЕНИЕ</div>
              <div className="hint-row"><span className="hint-key">↑ ↓ ← →</span><span>— ИГРОК 1</span></div>
              <div className="hint-row"><span className="hint-key">I J K L</span><span>— ИГРОК 2</span></div>
              <div className="hint-row">или кнопки на экране</div>
            </div>
          </div>
          <div className="laps-info">🏁 {LAPS_TO_WIN} КРУГА ДО ПОБЕДЫ</div>
        </div>
      </div>
    );
  }

  if (screen === "select") {
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="select-title">ВЫБЕРИ ТРАССУ</div>
          <div className="track-cards">
            {TRACKS.map((t, i) => (
              <button key={i} className="track-card" style={{ "--track-color": t.color, "--track-accent": t.accent } as React.CSSProperties} onClick={() => startGame(mode, i)}>
                <div className="track-number">0{i + 1}</div>
                <div className="track-name" style={{ color: t.color }}>{t.name}</div>
                <div className="track-info-3d">
                  <span style={{ color: t.color }}>⬤</span> {t.length} сегментов
                </div>
                <div className="track-info-3d">
                  <span style={{ color: t.accent }}>↗</span> {t.hills.length} холмов / {t.curves.length} поворотов
                </div>
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={() => setScreen("menu")}>← НАЗАД</button>
        </div>
      </div>
    );
  }

  if (screen === "results") {
    const winner = results.find(r => r.finished) || results[0];
    return (
      <div className="menu-bg">
        <div className="stars-layer" />
        <div className="menu-content">
          <div className="results-title">🏆 ФИНИШ!</div>
          <div className="winner-name" style={{ color: "#ffdd00" }}>{winner?.name} ПОБЕДИЛ!</div>
          <div className="results-list">
            {results.map((r, i) => (
              <div key={i} className="result-row" style={{ borderColor: r.finished ? "#ffdd00" : "#444" }}>
                <span className="result-pos">{i + 1}</span>
                <span className="result-name">{r.name}</span>
                <span className="result-laps">{r.laps}/{LAPS_TO_WIN} кругов</span>
              </div>
            ))}
          </div>
          <div className="result-buttons">
            <button className="menu-btn btn-solo" onClick={() => startGame(mode, trackIdx)}>🔄 СНОВА</button>
            <button className="menu-btn btn-multi" onClick={() => { stopEngines(); setScreen("menu"); }}>🏠 МЕНЮ</button>
          </div>
        </div>
      </div>
    );
  }

  const track = TRACKS[trackIdx];

  return (
    <div className="game-container">
      <div className="hud">
        <div className="hud-car" style={{ color: "#ff4466" }}>🏎️ П1: {lapInfo.p1}/{LAPS_TO_WIN}</div>
        <div className="hud-track" style={{ color: track.color }}>{track.name}</div>
        {mode === "multi" && <div className="hud-car" style={{ color: "#44aaff" }}>П2: {lapInfo.p2}/{LAPS_TO_WIN} 🏎️</div>}
      </div>
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />
        {countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-num" style={{ color: countdown === 1 ? "#ff4444" : "#ffdd00" }}>{countdown}</div>
          </div>
        )}
      </div>
      <div className="touch-controls">
        <div className="touch-pad touch-left">
          <div className="dpad">
            <button className="dpad-btn dpad-up" onTouchStart={makeTouchHandler("gas0", true)} onTouchEnd={makeTouchHandler("gas0", false)}>▲</button>
            <div className="dpad-row">
              <button className="dpad-btn" onTouchStart={makeTouchHandler("left0", true)} onTouchEnd={makeTouchHandler("left0", false)}>◀</button>
              <button className="dpad-btn" onTouchStart={makeTouchHandler("brake0", true)} onTouchEnd={makeTouchHandler("brake0", false)}>▼</button>
              <button className="dpad-btn" onTouchStart={makeTouchHandler("right0", true)} onTouchEnd={makeTouchHandler("right0", false)}>▶</button>
            </div>
          </div>
          <div className="pad-label" style={{ color: "#ff4466" }}>ИГРОК 1</div>
        </div>
        {mode === "multi" && (
          <div className="touch-pad touch-right">
            <div className="dpad">
              <button className="dpad-btn dpad-up" onTouchStart={makeTouchHandler("gas1", true)} onTouchEnd={makeTouchHandler("gas1", false)}>▲</button>
              <div className="dpad-row">
                <button className="dpad-btn" onTouchStart={makeTouchHandler("left1", true)} onTouchEnd={makeTouchHandler("left1", false)}>◀</button>
                <button className="dpad-btn" onTouchStart={makeTouchHandler("brake1", true)} onTouchEnd={makeTouchHandler("brake1", false)}>▼</button>
                <button className="dpad-btn" onTouchStart={makeTouchHandler("right1", true)} onTouchEnd={makeTouchHandler("right1", false)}>▶</button>
              </div>
            </div>
            <div className="pad-label" style={{ color: "#44aaff" }}>ИГРОК 2</div>
          </div>
        )}
      </div>
      <button className="back-btn-game" onClick={() => { stopEngines(); setScreen("menu"); }}>✕ МЕНЮ</button>
    </div>
  );
}