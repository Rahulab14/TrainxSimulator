"use client"
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  AlertOctagon,
  Sun,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
  Video,
  Train,
  DoorOpen,
  DoorClosed,
  Lightbulb,
  GitFork,
  Compass,
  ChevronUp,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  MapPin,
  Users,
  ShieldAlert,
  Star,
  Radio,
  Armchair,
  Award,
  UserCheck,
  TrafficCone,
  Gauge
} from 'lucide-react';

type TrainModelType = 'express' | 'freight' | 'commuter';
type CameraMode = 'follow' | 'cab' | 'cabin' | 'orbit' | 'station' | 'side';
type ReverserState = 'F' | 'N' | 'R';
type SignalState = 'GREEN' | 'YELLOW' | 'RED';
type FlagmanState = 'RED_STOP' | 'RED_BOARDING' | 'GREEN_CLEAR';

interface StationData {
  id: string;
  index: number;
  name: string;
  distance: number; // 0 to TOTAL_TRACK_LENGTH
  recommendedTrack: 'A' | 'B';
  color: string;
  zoneType: string;
}

interface SpeedZone {
  start: number;
  end: number;
  limit: number; // km/h
  label: string;
}

interface TrainSpec {
  id: TrainModelType;
  name: string;
  subtitle: string;
  maxSpeed: number; // km/h
  accelRate: number; // m/s^2
  brakeRate: number; // m/s^2
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  carCount: number;
}

interface EmojiFeedbackItem {
  id: number;
  emoji: string;
  passengerName: string;
  routeTag: string;
  message: string;
  delta: number;
  points?: number;
}

const TOTAL_TRACK_LENGTH = 4000; // 4.0 km continuous loop
const LEVEL_CROSSING_DIST = 620; // City level crossing with gates & pedestrians

const TRAIN_SPECS: Record<TrainModelType, TrainSpec> = {
  express: {
    id: 'express',
    name: 'AeroStar Velaro-X',
    subtitle: 'Ultra-Modern High-Speed Express',
    maxSpeed: 220,
    accelRate: 2.9,
    brakeRate: 4.4,
    primaryColor: 0xf8fafc,
    secondaryColor: 0x2563eb,
    accentColor: 0x38bdf8,
    carCount: 3,
  },
  commuter: {
    id: 'commuter',
    name: 'MetroLink Neo-M9',
    subtitle: 'City & Underground Transit',
    maxSpeed: 165,
    accelRate: 2.5,
    brakeRate: 4.1,
    primaryColor: 0x10b981,
    secondaryColor: 0x0f172a,
    accentColor: 0x34d399,
    carCount: 3,
  },
  freight: {
    id: 'freight',
    name: 'Titan Vectron-HD',
    subtitle: 'Heavy Dual-Mode Corridor',
    maxSpeed: 130,
    accelRate: 1.7,
    brakeRate: 3.1,
    primaryColor: 0xea580c,
    secondaryColor: 0x1e293b,
    accentColor: 0xfacc15,
    carCount: 4,
  },
};

const STATIONS: StationData[] = [
  {
    id: 'st-0',
    index: 0,
    name: 'Central Grand Terminal',
    distance: 140,
    recommendedTrack: 'A',
    color: '#3b82f6',
    zoneType: 'Metropolis Hub (Track A/B)',
  },
  {
    id: 'st-1',
    index: 1,
    name: 'Bayview Skybridge Hub',
    distance: 1140,
    recommendedTrack: 'B',
    color: '#06b6d4',
    zoneType: 'Waterfront Viaduct (Track B)',
  },
  {
    id: 'st-2',
    index: 2,
    name: 'Alpine Underground Metro',
    distance: 2160,
    recommendedTrack: 'A',
    color: '#8b5cf6',
    zoneType: 'Subterranean Cavern (Track A)',
  },
  {
    id: 'st-3',
    index: 3,
    name: 'Redwood Forest Depot',
    distance: 3200,
    recommendedTrack: 'B',
    color: '#10b981',
    zoneType: 'Pine Valley Station (Track B)',
  },
];

const SPEED_ZONES: SpeedZone[] = [
  { start: 0, end: 850, limit: 130, label: 'Downtown City & Level Crossing' },
  { start: 850, end: 1650, limit: 180, label: 'Bayview Suspension Viaduct' },
  { start: 1650, end: 2700, limit: 120, label: 'Underground Subway & Tunnel' },
  { start: 2700, end: 4000, limit: 200, label: 'Redwood Pine Forest Corridor' },
];

const PASSENGER_NAMES = [
  'Aarav M.', 'Elena R.', 'Liam K.', 'Sofia T.', 'Noah C.', 'Maya P.', 'Lucas V.', 'Chloe S.'
];

class TrainAudioSynthesizer {
  ctx: AudioContext | null = null;
  engineOsc: OscillatorNode | null = null;
  engineSubOsc: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  noiseNode: AudioNode | null = null;
  noiseFilter: BiquadFilterNode | null = null;
  noiseGain: GainNode | null = null;
  isMuted: boolean = false;
  isInitialized: boolean = false;

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineSubOsc.type = 'triangle';
      this.engineOsc.frequency.value = 38;
      this.engineSubOsc.frequency.value = 19;

      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 175;

      this.engineGain.gain.value = 0.0;

      this.engineOsc.connect(engineFilter);
      this.engineSubOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.value = 300;
      this.noiseFilter.Q.value = 1.4;

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0;

      whiteNoise.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.ctx.destination);

      whiteNoise.start();
      this.noiseNode = whiteNoise;
      this.isInitialized = true;
    } catch {
      // Audio blocked until user gesture
    }
  }

  update(speedKmh: number, throttle: number, brake: number, inTunnel: boolean) {
    if (!this.isInitialized || !this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain || !this.noiseGain || !this.noiseFilter) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }

    const absSpeed = Math.abs(speedKmh);
    const baseFreq = 36 + throttle * 0.58 + absSpeed * 0.38;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.08);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.08);

    const tunnelBoost = inTunnel ? 1.35 : 1.0;
    const targetEngineGain = (0.04 + (throttle / 100) * 0.065 + Math.min(absSpeed / 200, 1) * 0.04) * tunnelBoost;
    this.engineGain.gain.setTargetAtTime(targetEngineGain, this.ctx.currentTime, 0.1);

    const speedRatio = Math.min(absSpeed / 180, 1);
    this.noiseFilter.frequency.setTargetAtTime(
      (190 + speedRatio * 920 + (brake > 20 ? 550 : 0)) * (inTunnel ? 1.25 : 1.0),
      this.ctx.currentTime,
      0.1
    );
    this.noiseGain.gain.setTargetAtTime(
      (speedRatio * 0.065 + (brake > 10 && absSpeed > 5 ? 0.03 : 0)) * tunnelBoost,
      this.ctx.currentTime,
      0.1
    );
  }

  playHorn(trainType: TrainModelType = 'express') {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const chords =
      trainType === 'freight'
        ? [277.18, 349.23, 415.3, 554.37]
        : trainType === 'express'
        ? [392.0, 493.88, 587.33]
        : [329.63, 440.0, 523.25];

    chords.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1450, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
      gain.gain.setValueAtTime(0.06, now + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  playBell() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc2.frequency.setValueAtTime(1380, now);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.58);
    osc2.stop(now + 0.58);
  }

  playDoorChime() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [659.25, 523.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.22);
      gain.gain.setValueAtTime(0.06, now + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 0.34);
    });
  }

  playWhistleApproval() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [1174.66, 1567.98].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.055, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
  }

  playAlarm() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [784, 587.33, 784, 587.33].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.05, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.14);
    });
  }
}

function createRailwaySpline(): THREE.CatmullRomCurve3 {
  const points = [
    new THREE.Vector3(0, 0.5, -520),      // 0: Central Grand Terminal (City Straight)
    new THREE.Vector3(260, 0.5, -520),    // 1: City Corridor
    new THREE.Vector3(540, 0.5, -390),    // 2: City Level Crossing Zone (~620m)
    new THREE.Vector3(680, 12.0, -140),   // 3: Bayview Suspension Bridge Approach
    new THREE.Vector3(680, 12.0, 190),    // 4: Bayview Bridge Span & Station 1
    new THREE.Vector3(510, 4.0, 450),     // 5: Descent into Subterranean Portal
    new THREE.Vector3(210, -4.5, 560),    // 6: Underground Metro Station 2 (Sunken/Subway)
    new THREE.Vector3(-140, -4.5, 560),   // 7: Deep Underground Tunnel
    new THREE.Vector3(-450, 2.0, 420),    // 8: Tunnel Exit into Redwood Forest
    new THREE.Vector3(-650, 4.0, 160),    // 9: Redwood Pine Forest Curve
    new THREE.Vector3(-650, 1.5, -180),   // 10: Redwood Forest Depot Station 3
    new THREE.Vector3(-450, 0.5, -440),   // 11: Return to Metropolis
    new THREE.Vector3(-210, 0.5, -520),   // 12: West Throat Switch Junction
  ];
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
}

interface HumanRig {
  root: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torchBulbMat?: THREE.MeshBasicMaterial;
  torchLight?: THREE.PointLight;
  flagMat?: THREE.MeshStandardMaterial;
}

function createArticulatedHuman(
  shirtHex: number,
  pantsHex: number,
  skinHex: number,
  options?: { hasSignalTorch?: boolean; isUniformed?: boolean }
): HumanRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.55 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.45 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.8 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.24), shirtMat);
  torso.position.y = 0.98;
  torso.castShadow = true;
  root.add(torso);

  // High-Vis Safety Vest Stripes for Flagman / Copilot
  if (options?.isUniformed) {
    const vestStripeH = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.08, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    vestStripeH.position.y = 0.92;
    root.add(vestStripeH);
  }

  // Head + Hair or Officer Cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
  head.position.y = 1.44;
  head.castShadow = true;

  if (options?.isUniformed) {
    const capCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.16, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
    );
    capCrown.position.y = 0.12;
    const capBrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.03, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    capBrim.position.set(0, 0.08, 0.08);
    head.add(capCrown, capBrim);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hair.rotation.x = -0.2;
    head.add(hair);
  }
  root.add(head);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.28, 1.22, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), shirtMat);
  leftArmMesh.position.y = -0.22;
  leftArm.add(leftArmMesh);
  root.add(leftArm);

  // Right Arm (holds Signal Torch & Flag if Station Light Man or Copilot)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.28, 1.22, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), shirtMat);
  rightArmMesh.position.y = -0.22;
  rightArm.add(rightArmMesh);

  let torchBulbMat: THREE.MeshBasicMaterial | undefined;
  let torchLight: THREE.PointLight | undefined;
  let flagMat: THREE.MeshStandardMaterial | undefined;

  if (options?.hasSignalTorch) {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    handle.position.set(0, -0.45, 0.22);
    handle.rotation.x = Math.PI / 3;
    rightArm.add(handle);

    torchBulbMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const wandGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10), torchBulbMat);
    wandGlow.position.set(0, 0.18, 0);
    handle.add(wandGlow);

    flagMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff2222,
      emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
    });
    const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), flagMat);
    flagCloth.position.set(0.2, 0.18, 0);
    handle.add(flagCloth);

    torchLight = new THREE.PointLight(0xff2222, 2.2, 14);
    torchLight.position.set(0, 0.25, 0);
    handle.add(torchLight);
  }

  root.add(rightArm);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.68, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.66, 0.15), pantsMat);
  leftLegMesh.position.y = -0.33;
  leftLeg.add(leftLegMesh);
  root.add(leftLeg);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.68, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.66, 0.15), pantsMat);
  rightLegMesh.position.y = -0.33;
  rightLeg.add(rightLegMesh);
  root.add(rightLeg);

  return { root, head, torso, leftArm, rightArm, leftLeg, rightLeg, torchBulbMat, torchLight, flagMat };
}

function animateHumanPose(
  rig: HumanRig,
  mode: 'IDLE' | 'WALK' | 'SIT' | 'WAVE_TORCH' | 'HOLD_STOP_TORCH',
  phase: number
) {
  if (mode === 'IDLE') {
    rig.torso.position.y = 0.98 + Math.sin(phase * 2) * 0.01;
    rig.head.position.y = 1.44 + Math.sin(phase * 2) * 0.01;
    rig.leftArm.position.set(-0.28, 1.22, 0);
    rig.rightArm.position.set(0.28, 1.22, 0);
    rig.leftArm.rotation.set(Math.sin(phase * 1.5) * 0.08, 0, 0);
    rig.rightArm.rotation.set(-Math.sin(phase * 1.5) * 0.08, 0, 0);
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftLeg.position.set(-0.11, 0.68, 0);
    rig.rightLeg.position.set(0.11, 0.68, 0);
  } else if (mode === 'WALK') {
    const swing = Math.sin(phase * 9) * 0.65;
    rig.torso.position.y = 0.98 + Math.abs(Math.cos(phase * 9)) * 0.035;
    rig.head.position.y = 1.44 + Math.abs(Math.cos(phase * 9)) * 0.035;
    rig.leftArm.position.set(-0.28, 1.22, 0);
    rig.rightArm.position.set(0.28, 1.22, 0);
    rig.leftArm.rotation.set(swing, 0, 0);
    rig.rightArm.rotation.set(-swing, 0, 0);
    rig.leftLeg.rotation.x = -swing;
    rig.rightLeg.rotation.x = swing;
    rig.leftLeg.position.set(-0.11, 0.68, 0);
    rig.rightLeg.position.set(0.11, 0.68, 0);
  } else if (mode === 'SIT') {
    rig.torso.position.y = 0.76;
    rig.head.position.y = 1.22;
    rig.leftArm.position.set(-0.28, 0.98, 0);
    rig.rightArm.position.set(0.28, 0.98, 0);
    rig.leftArm.rotation.set(-0.45, 0, 0);
    rig.rightArm.rotation.set(-0.45, 0, 0);
    rig.leftLeg.position.set(-0.11, 0.52, 0.12);
    rig.rightLeg.position.set(0.11, 0.52, 0.12);
    rig.leftLeg.rotation.x = -1.25;
    rig.rightLeg.rotation.x = -1.25;
  } else if (mode === 'HOLD_STOP_TORCH') {
    // Raise right arm straight out holding Red Torch/Flag to command STOP
    rig.torso.position.y = 0.98;
    rig.head.position.y = 1.44;
    rig.rightArm.position.set(0.28, 1.22, 0);
    rig.rightArm.rotation.set(-2.2, 0, -0.25 + Math.sin(phase * 3) * 0.12);
    rig.leftArm.rotation.set(0.15, 0, 0.1);
  } else if (mode === 'WAVE_TORCH') {
    // Wave Green Torch/Flag overhead in an arc for ALL-CLEAR
    rig.torso.position.y = 0.98 + Math.abs(Math.sin(phase * 5)) * 0.02;
    rig.head.position.y = 1.44;
    rig.rightArm.position.set(0.28, 1.22, 0);
    rig.rightArm.rotation.set(-2.6, 0, Math.sin(phase * 6) * 0.55);
    rig.leftArm.rotation.set(-0.3, 0, 0.15);
  }
}

export default function App() {
  // Driving Controls State
  const [throttle, setThrottle] = useState<number>(0);
  const [brake, setBrake] = useState<number>(35);
  const [reverser, setReverser] = useState<ReverserState>('F');
  const [trainModel, setTrainModel] = useState<TrainModelType>('express');
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [headlights, setHeadlights] = useState<boolean>(true);
  const [interiorLights, setInteriorLights] = useState<boolean>(true);
  const [doorsOpen, setDoorsOpen] = useState<boolean>(false);
  // Dual-Track Selector: false = Track A (Left/Main), true = Track B (Right/Branch)
  const [trackSwitchBranch, setTrackSwitchBranch] = useState<boolean>(false);
  const [emergencyStop, setEmergencyStop] = useState<boolean>(false);
  const [bellActive, setBellActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autopilot, setAutopilot] = useState<boolean>(false);

  // Environment / Time of Day State (0 to 24 hours)
  const [timeOfDay, setTimeOfDay] = useState<number>(18.25);
  const [autoTimeCycle, setAutoTimeCycle] = useState<boolean>(false);

  // Live Telemetry & Scoring State
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [distanceTraveled, setDistanceTraveled] = useState<number>(140);
  const [currentSpeedLimit, setCurrentSpeedLimit] = useState<number>(130);
  const [currentZoneLabel, setCurrentZoneLabel] = useState<string>('Downtown City & Level Crossing');
  const [nearestStation, setNearestStation] = useState<StationData>(STATIONS[0]);
  const [nextUpcomingStation, setNextUpcomingStation] = useState<StationData>(STATIONS[1]);
  const [distanceToNextStation, setDistanceToNextStation] = useState<number>(0);
  const [stopPrecisionOffset, setStopPrecisionOffset] = useState<number>(0);
  const [atStationPlatform, setAtStationPlatform] = useState<boolean>(true);
  const [driverScore, setDriverScore] = useState<number>(1250);
  const [lastStopBanner, setLastStopBanner] = useState<string | null>(
    'PRECISION TARGET: 0.0m — Open Doors (D) to board passengers!'
  );

  // Station Flagman (Light Man) & 3D Train Copilot State
  const [flagmanSignal, setFlagmanSignal] = useState<FlagmanState>('RED_STOP');
  const [copilotApproved, setCopilotApproved] = useState<boolean>(false);
  const [crossingGateClosed, setCrossingGateClosed] = useState<boolean>(false);

  // Detailed Passenger Manifest & Reviews State
  const [onboardPassengers, setOnboardPassengers] = useState<number>(12);
  const [droppingNextStationCount, setDroppingNextStationCount] = useState<number>(5);
  const [destinationBreakdown, setDestinationBreakdown] = useState<number[]>([0, 5, 4, 3]);
  const [stationWaitingCounts, setStationWaitingCounts] = useState<number[]>([10, 10, 10, 10]);
  const [totalDeliveredPassengers, setTotalDeliveredPassengers] = useState<number>(0);
  const [boardingStatus, setBoardingStatus] = useState<string>(
    'Stopped at Central Grand Terminal (Track A) — Open Doors (D) to board!'
  );
  const [passengerRating, setPassengerRating] = useState<number>(4.9);
  const [emojiFeed, setEmojiFeed] = useState<EmojiFeedbackItem[]>([
    {
      id: 1,
      emoji: '😍',
      passengerName: 'Elena R.',
      routeTag: 'Central → Bayview',
      message: 'Ultra-modern cabin & panoramic windows look incredible!',
      delta: 0.1,
      points: 100,
    },
    {
      id: 2,
      emoji: '👋',
      passengerName: 'Aarav M.',
      routeTag: 'Platform Track A',
      message: 'Station Light Man is holding RED torch — ready to board!',
      delta: 0,
    },
  ]);

  // Signals & Traffic Rules State
  const [nextSignalState, setNextSignalState] = useState<SignalState>('GREEN');
  const [distanceToNextSignal, setDistanceToNextSignal] = useState<number>(180);
  const [signalViolationAlert, setSignalViolationAlert] = useState<string | null>(null);
  const [gForce, setGForce] = useState<number>(0);
  const [gradePercent, setGradePercent] = useState<number>(0);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<TrainAudioSynthesizer>(new TrainAudioSynthesizer());

  const addPassengerReview = useCallback(
    (emoji: string, passengerName: string, routeTag: string, message: string, delta: number, points: number = 0) => {
      setPassengerRating((prev) => Math.max(1.0, Math.min(5.0, Number((prev + delta).toFixed(2)))));
      if (points !== 0) {
        setDriverScore((s) => Math.max(0, s + points));
      }
      setEmojiFeed((prev) => [
        {
          id: Date.now() + Math.random(),
          emoji,
          passengerName,
          routeTag,
          message,
          delta,
          points: points !== 0 ? points : undefined,
        },
        ...prev.slice(0, 5),
      ]);
    },
    []
  );

  const physicsRef = useRef({
    speedMs: 0,
    distance: 140, // Starts right on Central Grand Terminal stop target
    aiDistance: 2350,
    // Dual Track Offset: -2.2m = Track A (Left Main), +2.2m = Track B (Right Branch)
    lateralOffset: -2.2,
    targetLateralOffset: -2.2,
    doorProgress: 0,
    wheelRotation: 0,
    bodyPitch: 0,
    crossingGateAngle: 0, // 0 = open vertical, 1 = closed horizontal
    orbitYaw: 0.65,
    orbitPitch: 0.28,
    orbitZoom: 26,
    isPointerDown: false,
    lastPointerX: 0,
    lastPointerY: 0,
    overspeedPenaltyTimer: 0,
    redSignalOverrideTimer: 0,
    lastPassedSignalIndex: -1,
    hasScoredCurrentStationStop: true,
    stationBoardingComplete: false,
    crossingBellTimer: 0,
  });

  const controlsRef = useRef({
    throttle,
    brake,
    reverser,
    trainModel,
    cameraMode,
    headlights,
    interiorLights,
    doorsOpen,
    trackSwitchBranch,
    emergencyStop,
    bellActive,
    isMuted,
    autopilot,
    timeOfDay,
    autoTimeCycle,
  });

  useEffect(() => {
    controlsRef.current = {
      throttle,
      brake,
      reverser,
      trainModel,
      cameraMode,
      headlights,
      interiorLights,
      doorsOpen,
      trackSwitchBranch,
      emergencyStop,
      bellActive,
      isMuted,
      autopilot,
      timeOfDay,
      autoTimeCycle,
    };
    audioRef.current.isMuted = isMuted;
    physicsRef.current.targetLateralOffset = trackSwitchBranch ? 2.2 : -2.2;
  }, [
    throttle,
    brake,
    reverser,
    trainModel,
    cameraMode,
    headlights,
    interiorLights,
    doorsOpen,
    trackSwitchBranch,
    emergencyStop,
    bellActive,
    isMuted,
    autopilot,
    timeOfDay,
    autoTimeCycle,
  ]);

  useEffect(() => {
    if (!bellActive) return;
    audioRef.current.playBell();
    const timer = setInterval(() => {
      audioRef.current.playBell();
    }, 700);
    return () => clearInterval(timer);
  }, [bellActive]);

  const triggerHorn = useCallback(() => {
    audioRef.current.playHorn(controlsRef.current.trainModel);
  }, []);

  const handleRequestSignalClearance = useCallback(() => {
    audioRef.current.init();
    audioRef.current.playDoorChime();
    physicsRef.current.redSignalOverrideTimer = 38;
    setBoardingStatus('Dispatch & Copilot cleared block signal to GREEN!');
    addPassengerReview('😊', 'Copilot Arjun', 'Cab Dispatch', 'Signal cleared to GREEN — safe to proceed.', 0.05, 50);
  }, [addPassengerReview]);

  const handleToggleDoors = useCallback(() => {
    const currentSpeed = Math.abs(physicsRef.current.speedMs * 3.6);
    if (currentSpeed > 1.8) {
      audioRef.current.playAlarm();
      setBoardingStatus('SAFETY INTERLOCK: Stop train (< 1.5 km/h) before opening doors!');
      addPassengerReview('😠', 'Noah C.', 'Safety Alert', 'Driver tried opening doors while train was moving!', -0.25, -100);
      return;
    }
    audioRef.current.playDoorChime();
    setDoorsOpen((prev) => {
      const next = !prev;
      if (next) {
        setBrake((b) => Math.max(b, 55));
        setThrottle(0);
        setCopilotApproved(false);
        setFlagmanSignal('RED_BOARDING');
        setBoardingStatus('Doors Open — Station Light Man holding RED Torch while passengers board & alight!');
      } else {
        // Doors closed -> Station Flagman switches torch to GREEN & Copilot waves approval!
        physicsRef.current.stationBoardingComplete = true;
        setFlagmanSignal('GREEN_CLEAR');
        setCopilotApproved(true);
        audioRef.current.playWhistleApproval();
        setBoardingStatus('Light Man waving GREEN Torch & Copilot gave All-Clear Approval! Ready to depart.');
        addPassengerReview(
          '🟢',
          'Copilot & Light Man',
          'Departure Check',
          'Doors locked! Green torch & copilot approval given — clear to depart!',
          0.1,
          100
        );
      }
      return next;
    });
  }, [addPassengerReview]);

  const handleEmergencyStop = useCallback(() => {
    setEmergencyStop((prev) => {
      const next = !prev;
      if (next) {
        const wasMovingFast = Math.abs(physicsRef.current.speedMs * 3.6) > 35;
        setThrottle(0);
        setBrake(100);
        setAutopilot(false);
        audioRef.current.playHorn(controlsRef.current.trainModel);
        setBoardingStatus('EMERGENCY BRAKE ENGAGED — Release to restore traction');
        if (wasMovingFast) {
          addPassengerReview('😱', 'Sofia T.', 'Cabin Coach 1', 'Sudden emergency stop jolted everyone in the cabin!', -0.35, -150);
        }
      } else {
        setBrake(35);
        setBoardingStatus('Emergency Brake Reset. Traction restored.');
      }
      return next;
    });
  }, [addPassengerReview]);

  // Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      audioRef.current.init();

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          e.preventDefault();
          if (!controlsRef.current.emergencyStop && !controlsRef.current.doorsOpen) {
            setBrake((b) => Math.max(0, b - 20));
            setThrottle((t) => Math.min(100, t + 10));
          }
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          setThrottle((t) => {
            if (t > 0) return Math.max(0, t - 15);
            setBrake((b) => Math.min(100, b + 15));
            return 0;
          });
          break;
        case ' ':
          e.preventDefault();
          handleEmergencyStop();
          break;
        case 'h':
          e.preventDefault();
          triggerHorn();
          break;
        case 'b':
          e.preventDefault();
          setBellActive((prev) => !prev);
          break;
        case 'l':
          e.preventDefault();
          setHeadlights((prev) => !prev);
          break;
        case 'd':
          e.preventDefault();
          handleToggleDoors();
          break;
        case 'v':
          e.preventDefault();
          setCameraMode((prev) => (prev === 'cabin' ? 'cab' : 'cabin'));
          break;
        case 'c':
          e.preventDefault();
          setCameraMode((prev) => {
            const modes: CameraMode[] = ['follow', 'cab', 'cabin', 'orbit', 'side', 'station'];
            return modes[(modes.indexOf(prev) + 1) % modes.length];
          });
          break;
        case 'g':
          e.preventDefault();
          setTrackSwitchBranch((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEmergencyStop, handleToggleDoors, triggerHorn]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x93c5fd, 0.00055);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.2,
      3200
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting System
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x365314, 0.55);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    sunLight.position.set(300, 450, 250);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1600;
    const d = 550;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Sun & Full Moon with Halo
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(32, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    scene.add(sunOrb);

    const moonGroup = new THREE.Group();
    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(38, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(62, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.3, depthWrite: false })
    );
    const moonOuterHalo = new THREE.Mesh(
      new THREE.SphereGeometry(95, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.14, depthWrite: false })
    );
    moonGroup.add(moonCore, moonHalo, moonOuterHalo);
    scene.add(moonGroup);

    const moonLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    scene.add(moonLight);

    // Starfield
    const starCount = 1300;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.15);
      const r = 1500;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 4.5, transparent: true, opacity: 0.0 });
    scene.add(new THREE.Points(starGeo, starMat));

    const trackSpline = createRailwaySpline();

    // Ground & Bay Water
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2e4c1e, roughness: 0.92 })
    );
    groundMesh.position.y = -6.0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const cityApronMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 900).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    cityApronMesh.position.set(120, -0.15, -480);
    cityApronMesh.receiveShadow = true;
    scene.add(cityApronMesh);

    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(950, 1200).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.75 })
    );
    waterMesh.position.set(680, -0.2, 20);
    scene.add(waterMesh);

    const sleeperGeo = new THREE.BoxGeometry(8.2, 0.22, 0.45);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const sleeperCount = 950;
    const sleeperInstanced = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
    sleeperInstanced.receiveShadow = true;

    const pillarGeo = new THREE.CylinderGeometry(1.4, 1.7, 28, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    const dummy = new THREE.Object3D();

    const trackALeftRail: THREE.Vector3[] = [];
    const trackARightRail: THREE.Vector3[] = [];
    const trackBLeftRail: THREE.Vector3[] = [];
    const trackBRightRail: THREE.Vector3[] = [];
    const ballastPoints: THREE.Vector3[] = [];

    for (let i = 0; i < sleeperCount; i++) {
      const t = i / sleeperCount;
      const pt = trackSpline.getPointAt(t);
      const tangent = trackSpline.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      dummy.position.copy(pt).add(new THREE.Vector3(0, 0.08, 0));
      dummy.lookAt(pt.clone().add(tangent));
      dummy.updateMatrix();
      sleeperInstanced.setMatrixAt(i, dummy.matrix);

      // Track A (Offset -2.2m Left)
      trackALeftRail.push(pt.clone().addScaledVector(right, -2.2 - 0.78).add(new THREE.Vector3(0, 0.28, 0)));
      trackARightRail.push(pt.clone().addScaledVector(right, -2.2 + 0.78).add(new THREE.Vector3(0, 0.28, 0)));

      // Track B (Offset +2.2m Right)
      trackBLeftRail.push(pt.clone().addScaledVector(right, 2.2 - 0.78).add(new THREE.Vector3(0, 0.28, 0)));
      trackBRightRail.push(pt.clone().addScaledVector(right, 2.2 + 0.78).add(new THREE.Vector3(0, 0.28, 0)));

      ballastPoints.push(pt.clone().add(new THREE.Vector3(0, -0.18, 0)));

      if (pt.y > 2.0 && i % 16 === 0) {
        const pier = new THREE.Mesh(pillarGeo, pillarMat);
        pier.position.set(pt.x, pt.y - 14.2, pt.z);
        scene.add(pier);
      }
    }
    scene.add(sleeperInstanced);

    const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.2 });
    const ballastMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });

    [trackALeftRail, trackARightRail, trackBLeftRail, trackBRightRail].forEach((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts, true);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 650, 0.085, 6, true), railMat));
    });

    const ballastCurve = new THREE.CatmullRomCurve3(ballastPoints, true);
    const ballastMesh = new THREE.Mesh(new THREE.TubeGeometry(ballastCurve, 480, 4.8, 8, true), ballastMat);
    ballastMesh.scale.set(1, 0.16, 1);
    ballastMesh.receiveShadow = true;
    scene.add(ballastMesh);

    // Animated 3D Crossover Switches before each Station
    const switchBladeMeshes: THREE.Mesh[] = [];
    [0.01, 0.25, 0.51, 0.76].forEach((swT) => {
      const crossoverPts: THREE.Vector3[] = [];
      for (let k = 0; k <= 20; k++) {
        const t = (swT + (k / 20) * 0.022) % 1;
        const pt = trackSpline.getPointAt(t);
        const tan = trackSpline.getTangentAt(t).normalize();
        const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
        const lat = THREE.MathUtils.lerp(-2.2, 2.2, k / 20);
        crossoverPts.push(pt.clone().addScaledVector(right, lat).add(new THREE.Vector3(0, 0.29, 0)));
      }
      const crossCurve = new THREE.CatmullRomCurve3(crossoverPts, false);
      const bladeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(crossCurve, 24, 0.09, 6, false),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 })
      );
      scene.add(bladeMesh);
      switchBladeMeshes.push(bladeMesh);
    });

    // Underground section spans t = 0.44 to t = 0.68 (covers Station 2: Alpine Underground Metro)
    for (let i = 0; i < 68; i++) {
      const t = 0.44 + (i / 68) * 0.24;
      const pt = trackSpline.getPointAt(t);
      const tangent = trackSpline.getTangentAt(t).normalize();
      const tunnelRing = new THREE.Group();
      tunnelRing.position.copy(pt);
      tunnelRing.lookAt(pt.clone().add(tangent));

      const isUndergroundStation = t > 0.515 && t < 0.565;
      const archRadius = isUndergroundStation ? 12.5 : 7.8;

      const archMesh = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 1.35, 10, 24, Math.PI),
        new THREE.MeshStandardMaterial({
          color: i === 0 || i === 67 ? 0x94a3b8 : 0x1e293b,
          roughness: 0.85,
          side: THREE.DoubleSide,
        })
      );
      archMesh.position.y = -0.2;
      tunnelRing.add(archMesh);

      // Glowing Cyan / Amber Subway Wall Light Strips inside the underground tunnel
      if (i % 2 === 0) {
        const stripColor = isUndergroundStation ? 0x38bdf8 : 0xf59e0b;
        const leftLightStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.22, 3.8),
          new THREE.MeshBasicMaterial({ color: stripColor })
        );
        leftLightStrip.position.set(-archRadius + 1.1, 3.2, 0);
        const rightLightStrip = leftLightStrip.clone();
        rightLightStrip.position.set(archRadius - 1.1, 3.2, 0);
        tunnelRing.add(leftLightStrip, rightLightStrip);
      }
      scene.add(tunnelRing);
    }

    const cityBuildingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.6 });
    const cityGlassMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const cityBuildingsData = [
      { x: -120, z: -610, w: 34, d: 34, h: 95 },
      { x: -50, z: -620, w: 42, d: 36, h: 130 },
      { x: 30, z: -615, w: 38, d: 38, h: 110 },
      { x: 115, z: -610, w: 46, d: 36, h: 145 },
      { x: 205, z: -605, w: 36, d: 36, h: 85 },
      { x: 310, z: -595, w: 40, d: 40, h: 105 },
      { x: 420, z: -540, w: 34, d: 34, h: 78 },
      { x: -90, z: -420, w: 36, d: 32, h: 80 },
      { x: 40, z: -415, w: 42, d: 36, h: 98 },
      { x: 165, z: -420, w: 34, d: 34, h: 74 },
      { x: 290, z: -425, w: 38, d: 36, h: 88 },
      { x: 440, z: -320, w: 32, d: 32, h: 68 },
    ];

    cityBuildingsData.forEach((b, idx) => {
      const bGroup = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), cityBuildingMat);
      tower.position.y = b.h / 2;
      tower.castShadow = true;
      tower.receiveShadow = true;
      bGroup.add(tower);

      // Glowing Horizontal Window Bands
      for (let y = 10; y < b.h - 8; y += 12) {
        const winBand = new THREE.Mesh(
          new THREE.BoxGeometry(b.w + 0.3, 2.2, b.d + 0.3),
          idx % 2 === 0 ? cityGlassMat : new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        winBand.position.y = y;
        bGroup.add(winBand);
      }
      bGroup.position.set(b.x, 0, b.z);
      scene.add(bGroup);
    });

    // Interactive City Railway Level Crossing at LEVEL_CROSSING_DIST (620m)
    const crossT = LEVEL_CROSSING_DIST / TOTAL_TRACK_LENGTH;
    const crossPt = trackSpline.getPointAt(crossT);
    const crossTan = trackSpline.getTangentAt(crossT).normalize();
    const crossGroup = new THREE.Group();
    crossGroup.position.copy(crossPt);
    crossGroup.lookAt(crossPt.clone().add(crossTan));

    // Asphalt Road intersecting the Dual Railway Tracks
    const roadMesh = new THREE.Mesh(
      new THREE.BoxGeometry(75, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    roadMesh.position.y = 0.08;
    crossGroup.add(roadMesh);

    const roadStripe = new THREE.Mesh(
      new THREE.BoxGeometry(74, 0.2, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    roadStripe.position.y = 0.1;
    crossGroup.add(roadStripe);

    // Animated Barrier Gate Arms & Flashing Red Lights on Both Sides of the Track
    const gateArms: THREE.Group[] = [];
    const gateFlashMats: THREE.MeshBasicMaterial[] = [];
    const crossingPedestrians: HumanRig[] = [];

    [-1, 1].forEach((sideSign) => {
      const postGroup = new THREE.Group();
      postGroup.position.set(sideSign * 6.8, 0, sideSign * 5.2);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 3.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
      );
      post.position.y = 1.9;
      postGroup.add(post);

      // Flashing Red Warning Beacon
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
      gateFlashMats.push(beaconMat);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), beaconMat);
      beacon.position.y = 3.6;
      postGroup.add(beacon);

      // Pivoting Red/White Striped Barrier Arm
      const armPivot = new THREE.Group();
      armPivot.position.set(0, 1.35, 0);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.22, 10.5),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      bar.position.z = -sideSign * 5.0;
      const whiteStripes = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.24, 5.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      whiteStripes.position.z = -sideSign * 5.0;
      armPivot.add(bar, whiteStripes);
      postGroup.add(armPivot);
      gateArms.push(armPivot);
      crossGroup.add(postGroup);

      // Waiting 3D Car stopped behind the railway gate on each side
      const carGroup = new THREE.Group();
      carGroup.position.set(sideSign * 14.5, 0.65, sideSign * 2.4);
      const carBody = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 1.1, 2.1),
        new THREE.MeshStandardMaterial({ color: sideSign > 0 ? 0x3b82f6 : 0xf59e0b, metalness: 0.4, roughness: 0.3 })
      );
      const carCabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.85, 1.85),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
      );
      carCabin.position.y = 0.85;
      carGroup.add(carBody, carCabin);
      crossGroup.add(carGroup);

      // 4 Articulated 3D Pedestrians standing on BOTH sides of the Railway Gate watching the train pass!
      for (let p = 0; p < 4; p++) {
        const pedRig = createArticulatedHuman(
          [0xec4899, 0x3b82f6, 0x10b981, 0xf97316][(p + (sideSign > 0 ? 2 : 0)) % 4],
          0x1e293b,
          0xfde68a
        );
        pedRig.root.position.set(sideSign * (8.2 + p * 1.1), 0.15, -4.2 + p * 2.6);
        pedRig.root.rotation.y = sideSign > 0 ? -Math.PI / 2 : Math.PI / 2;
        crossGroup.add(pedRig.root);
        crossingPedestrians.push(pedRig);
      }
    });
    scene.add(crossGroup);

    // Bayview Suspension Bridge Towers
    const bridgeTowerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.35 });
    [0.23, 0.34].forEach((tPos) => {
      const pt = trackSpline.getPointAt(tPos);
      const tangent = trackSpline.getTangentAt(tPos).normalize();
      const towerGroup = new THREE.Group();
      towerGroup.position.copy(pt);
      towerGroup.lookAt(pt.clone().add(tangent));

      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 58, 2.4), bridgeTowerMat);
      leftLeg.position.set(-7.5, 18, 0);
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 58, 2.4), bridgeTowerMat);
      rightLeg.position.set(7.5, 18, 0);
      const crossBeam1 = new THREE.Mesh(new THREE.BoxGeometry(17.5, 2.2, 2.2), bridgeTowerMat);
      crossBeam1.position.set(0, 24, 0);
      const crossBeam2 = new THREE.Mesh(new THREE.BoxGeometry(17.5, 2.2, 2.2), bridgeTowerMat);
      crossBeam2.position.set(0, 42, 0);

      towerGroup.add(leftLeg, rightLeg, crossBeam1, crossBeam2);
      scene.add(towerGroup);
    });

    const stationLights: THREE.PointLight[] = [];

    interface PlatformPassengerAgent {
      rig: HumanRig;
      stationIndex: number;
      slotZ: number;
      sideSign: number; // -1 for Track A platform, +1 for Track B platform
      state: 'WAITING' | 'WALKING_TO_DOOR' | 'HIDDEN_ONBOARD' | 'ALIGHTING_TO_PLATFORM';
      progress: number;
      animPhase: number;
    }

    const platformAgents: PlatformPassengerAgent[] = [];
    const stationFlagmen: { rig: HumanRig; stationIndex: number }[] = [];
    const SHIRT_PALETTE = [0x2563eb, 0xdc2626, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf97316];
    const PANTS_PALETTE = [0x1e293b, 0x334155, 0x0f172a, 0x3f3f46];
    const SKIN_PALETTE = [0xfde68a, 0xfcd34d, 0xd97706, 0xfef08a];

    STATIONS.forEach((st, stIdx) => {
      const t = st.distance / TOTAL_TRACK_LENGTH;
      const pt = trackSpline.getPointAt(t);
      const tangent = trackSpline.getTangentAt(t).normalize();

      const stHubGroup = new THREE.Group();
      stHubGroup.position.copy(pt);
      stHubGroup.lookAt(pt.clone().add(tangent));

      // Build Twin Separated Platforms: Left Platform for Track A (-7.4m) & Right Platform for Track B (+7.4m)
      [-1, 1].forEach((sideSign) => {
        const platX = sideSign * 7.4;

        // Concrete Platform Deck
        const platformMesh = new THREE.Mesh(
          new THREE.BoxGeometry(4.6, 1.35, 62),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 })
        );
        platformMesh.position.set(platX, 0.4, 0);
        platformMesh.receiveShadow = true;
        stHubGroup.add(platformMesh);

        // Glowing Yellow Tactile Safety Line
        const safetyLine = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.06, 61.5),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        safetyLine.position.set(platX - sideSign * 2.05, 1.1, 0);
        stHubGroup.add(safetyLine);

        // Passenger Waiting Benches & Ticket Kiosk
        [-12, 12].forEach((bZ) => {
          const bench = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.55, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x1e293b })
          );
          bench.position.set(platX + sideSign * 0.8, 1.35, bZ);
          stHubGroup.add(bench);
        });
      });

      // Arched Glass & Steel Station Canopy spanning across both Track A & Track B
      const canopyArch = new THREE.Mesh(
        new THREE.CylinderGeometry(10.2, 10.2, 54, 20, 1, true, -Math.PI / 2, Math.PI),
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(st.color),
          transparent: true,
          opacity: 0.42,
          roughness: 0.2,
          metalness: 0.3,
          side: THREE.DoubleSide,
        })
      );
      canopyArch.rotation.x = Math.PI / 2;
      canopyArch.position.y = 4.2;
      stHubGroup.add(canopyArch);

      // Overhead Digital LED Station Name Signboard
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 1.1, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      signBoard.position.set(0, 7.6, 24);
      const signGlow = new THREE.Mesh(
        new THREE.BoxGeometry(8.1, 0.75, 0.44),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(st.color) })
      );
      signGlow.position.set(0, 7.6, 24);
      stHubGroup.add(signBoard, signGlow);

      // Precision Stop Target Zone Markers on Both Track A (-2.2m) and Track B (+2.2m)
      [-2.2, 2.2].forEach((trackX) => {
        const stopPad = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.08, 7.5),
          new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 })
        );
        stopPad.position.set(trackX, 0.32, 0);
        const stopLine = new THREE.Mesh(
          new THREE.BoxGeometry(2.3, 0.12, 0.65),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        stopLine.position.set(trackX, 0.35, 3.5);
        stHubGroup.add(stopPad, stopLine);
      });

      const stLight = new THREE.PointLight(0xfef08a, 2.2, 65);
      stLight.position.set(0, 7.2, 0);
      stHubGroup.add(stLight);
      stationLights.push(stLight);

      // Articulated 3D Station Light Man (Flagman) standing at the front of the platform with LED Torch/Flag!
      const flagmanRig = createArticulatedHuman(0x1e3a8a, 0x0f172a, 0xfde68a, {
        hasSignalTorch: true,
        isUniformed: true,
      });
      const recSide = st.recommendedTrack === 'B' ? 1 : -1;
      flagmanRig.root.position.set(recSide * 5.8, 1.08, 16);
      flagmanRig.root.rotation.y = Math.PI; // Faces approaching train
      stHubGroup.add(flagmanRig.root);
      stationFlagmen.push({ rig: flagmanRig, stationIndex: stIdx });

      // 10 Articulated 3D Passengers waiting on the station platforms (5 on Track A, 5 on Track B)
      for (let pIdx = 0; pIdx < 10; pIdx++) {
        const sideSign = pIdx < 5 ? -1 : 1;
        const shirt = SHIRT_PALETTE[(stIdx * 3 + pIdx) % SHIRT_PALETTE.length];
        const pants = PANTS_PALETTE[pIdx % PANTS_PALETTE.length];
        const skin = SKIN_PALETTE[(stIdx + pIdx) % SKIN_PALETTE.length];
        const rig = createArticulatedHuman(shirt, pants, skin);

        const slotZ = -14 + (pIdx % 5) * 7.0;
        const waitX = sideSign * 6.8;
        rig.root.position.set(waitX, 1.08, slotZ);
        rig.root.rotation.y = sideSign === 1 ? -Math.PI / 2 : Math.PI / 2;

        stHubGroup.add(rig.root);
        platformAgents.push({
          rig,
          stationIndex: stIdx,
          slotZ,
          sideSign,
          state: 'WAITING',
          progress: 0,
          animPhase: pIdx * 0.8,
        });
      }

      scene.add(stHubGroup);
    });

    // Block Signals
    const signalDistances = [340, 840, 1360, 1840, 2380, 2860, 3420, 3890];
    const signalLamps: {
      index: number;
      distance: number;
      state: SignalState;
      redMat: THREE.MeshBasicMaterial;
      yellowMat: THREE.MeshBasicMaterial;
      greenMat: THREE.MeshBasicMaterial;
      pointLight: THREE.PointLight;
    }[] = [];

    signalDistances.forEach((sigDist, idx) => {
      const t = sigDist / TOTAL_TRACK_LENGTH;
      const pt = trackSpline.getPointAt(t);
      const tangent = trackSpline.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const sigGroup = new THREE.Group();
      sigGroup.position.copy(pt).addScaledVector(right, 5.2);
      sigGroup.lookAt(sigGroup.position.clone().add(tangent));

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 6.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
      );
      post.position.y = 3.2;
      sigGroup.add(post);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 2.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      housing.position.y = 5.6;
      sigGroup.add(housing);

      const redMat = new THREE.MeshBasicMaterial({ color: 0x450a0a });
      const yellowMat = new THREE.MeshBasicMaterial({ color: 0x422006 });
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

      const redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), redMat);
      redBulb.position.set(0, 6.25, -0.26);
      const yellowBulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), yellowMat);
      yellowBulb.position.set(0, 5.6, -0.26);
      const greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), greenMat);
      greenBulb.position.set(0, 4.95, -0.26);

      const sigGlowLight = new THREE.PointLight(0x22c55e, 1.5, 22);
      sigGlowLight.position.set(0, 5.6, -0.8);

      sigGroup.add(redBulb, yellowBulb, greenBulb, sigGlowLight);
      scene.add(sigGroup);
      signalLamps.push({
        index: idx,
        distance: sigDist,
        state: 'GREEN',
        redMat,
        yellowMat,
        greenMat,
        pointLight: sigGlowLight,
      });
    });

    // Mountains & Redwood Pine Forest
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, flatShading: true });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, flatShading: true });
    [
      { x: 0, z: 820, r: 240, h: 290 },
      { x: -340, z: 780, r: 200, h: 250 },
      { x: 360, z: 750, r: 185, h: 220 },
      { x: -880, z: 220, r: 215, h: 240 },
      { x: -840, z: -260, r: 190, h: 205 },
    ].forEach((m) => {
      const mGroup = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(m.r, m.h, 7), mountainMat);
      base.position.y = m.h / 2 - 4;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(m.r * 0.36, m.h * 0.36, 7), snowCapMat);
      cap.position.y = m.h * 0.82 - 4;
      mGroup.add(base, cap);
      mGroup.position.set(m.x, 0, m.z);
      scene.add(mGroup);
    });

    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const foliageGeo = new THREE.ConeGeometry(2.8, 9.2, 7);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8, flatShading: true });

    const treeCount = 260;
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);

    let treeIdx = 0;
    for (let i = 0; i < 650 && treeIdx < treeCount; i++) {
      const angle = (i / 650) * Math.PI * 2;
      const radius = 250 + (i % 7) * 90 + Math.sin(i * 1.7) * 55;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      // Keep dense forest primarily in the western/forest half
      if (tx > 350 || (tz < -320 && tx > -220)) continue;
      const sampleT = (i % 100) / 100;
      const trackPt = trackSpline.getPointAt(sampleT);
      if (Math.hypot(tx - trackPt.x, tz - trackPt.z) < 32) continue;

      const scale = 0.9 + (i % 5) * 0.28;
      dummy.position.set(tx, 1.4 * scale, tz);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, i, 0);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(treeIdx, dummy.matrix);
      dummy.position.set(tx, 6.4 * scale, tz);
      dummy.updateMatrix();
      foliageInst.setMatrixAt(treeIdx, dummy.matrix);
      treeIdx++;
    }
    scene.add(trunkInst, foliageInst);

    const trainRootGroup = new THREE.Group();
    scene.add(trainRootGroup);

    interface CabinPassengerSeat {
      rig: HumanRig;
      seatX: number;
      seatZ: number;
      destinationStation: number;
      state: 'EMPTY' | 'BOARDING_AISLE' | 'SEATED' | 'ALIGHTING_AISLE';
      progress: number;
      doorSide: number;
    }

    interface CarMeshRefs {
      group: THREE.Group;
      bodyPivot: THREE.Group;
      shellMats: THREE.MeshStandardMaterial[];
      stripeMat: THREE.MeshStandardMaterial;
      leftDoors: THREE.Mesh[];
      rightDoors: THREE.Mesh[];
      wheels: THREE.Mesh[];
      cabinLight: THREE.PointLight;
      seats: CabinPassengerSeat[];
      headlightSpotL?: THREE.SpotLight;
      headlightSpotR?: THREE.SpotLight;
      volumetricConeL?: THREE.Mesh;
      volumetricConeR?: THREE.Mesh;
      headlightBulbL?: THREE.Mesh;
      headlightBulbR?: THREE.Mesh;
      cabThrottleLever?: THREE.Mesh;
      cabBrakeLever?: THREE.Mesh;
      copilotRig?: HumanRig;
    }

    const playerCars: CarMeshRefs[] = [];
    const MAX_CARS = 4;

    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.28, 16).rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const seatCushionMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
    const seatHeadrestMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      roughness: 0.08,
      metalness: 0.15,
    });

    for (let c = 0; c < MAX_CARS; c++) {
      const carGroup = new THREE.Group();
      const bodyPivot = new THREE.Group();
      carGroup.add(bodyPivot);

      const shellMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.4 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.25, metalness: 0.45 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 });

      // Cabin Floor & Illuminated Center Aisle
      const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(3.14, 0.25, 14.6), floorMat);
      floorDeck.position.y = 1.05;
      floorDeck.receiveShadow = true;
      bodyPivot.add(floorDeck);

      const aisleRunner = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.02, 13.8),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 })
      );
      aisleRunner.position.y = 1.185;
      bodyPivot.add(aisleRunner);

      // Side Walls, Panoramic Windows & Overhead Luggage Racks
      [-1.52, 1.52].forEach((sideX) => {
        [-4.2, 4.2].forEach((halfZ) => {
          const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 5.9), shellMat);
          lowerWall.position.set(sideX, 1.68, halfZ);
          lowerWall.castShadow = true;
          bodyPivot.add(lowerWall);

          const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.36, 5.92), stripeMat);
          stripeMesh.position.set(sideX, 1.65, halfZ);
          bodyPivot.add(stripeMesh);

          const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.08, 5.6), glassMat);
          windowPane.position.set(sideX, 2.72, halfZ);
          bodyPivot.add(windowPane);

          const upperHeader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 5.9), shellMat);
          upperHeader.position.set(sideX, 3.45, halfZ);
          bodyPivot.add(upperHeader);

          // Interior Overhead Luggage Rack & Handrail
          const rack = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.06, 5.6),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
          );
          rack.position.set(sideX * 0.78, 3.18, halfZ);
          bodyPivot.add(rack);
        });

        [-6.9, -4.2, -1.35, 1.35, 4.2, 6.9].forEach((pZ) => {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.5, 0.28), shellMat);
          pillar.position.set(sideX, 2.72, pZ);
          bodyPivot.add(pillar);
        });
      });

      // Roof Ceiling & Dual LED Interior Light Strips
      const roofCeiling = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.22, 14.6), shellMat);
      roofCeiling.position.y = 3.72;
      roofCeiling.castShadow = true;
      bodyPivot.add(roofCeiling);

      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.04, 13.4),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
      );
      ledStrip.position.y = 3.59;
      bodyPivot.add(ledStrip);

      const cabinLight = new THREE.PointLight(0xfffbeb, 1.8, 18);
      cabinLight.position.set(0, 3.35, 0);
      bodyPivot.add(cabinLight);

      // Rear Bulkhead & Front Glass Partition (so Cabin View can see into the Driver Cockpit & Copilot!)
      const rearBulkhead = new THREE.Mesh(new THREE.BoxGeometry(3.12, 2.65, 0.15), shellMat);
      rearBulkhead.position.set(0, 2.4, -7.2);
      bodyPivot.add(rearBulkhead);

      const frontPartitionGlass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.5, 0.08), glassMat);
      frontPartitionGlass.position.set(0, 2.4, 7.1);
      bodyPivot.add(frontPartitionGlass);

      // 12 Interior 3D Passenger Seats + Articulated 3D Humans
      const carSeats: CabinPassengerSeat[] = [];
      const seatZRows = [-5.5, -3.9, -2.3, 2.3, 3.9, 5.5];
      const seatSides = [-1.05, 1.05];

      seatZRows.forEach((sz, rIdx) => {
        seatSides.forEach((sx, sIdx) => {
          const seatGroup = new THREE.Group();
          seatGroup.position.set(sx, 1.18, sz);

          const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.58), seatCushionMat);
          base.position.y = 0.34;
          const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), roofMat);
          pedestal.position.y = 0.15;
          const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.12), seatCushionMat);
          backrest.position.set(0, 0.72, -0.24);
          const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.14), seatHeadrestMat);
          headrest.position.set(0, 1.04, -0.24);
          const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.46), roofMat);
          armrest.position.set(sx > 0 ? -0.32 : 0.32, 0.54, 0);

          seatGroup.add(base, pedestal, backrest, headrest, armrest);
          bodyPivot.add(seatGroup);

          const idxSeed = c * 12 + rIdx * 2 + sIdx;
          const humanRig = createArticulatedHuman(
            SHIRT_PALETTE[idxSeed % SHIRT_PALETTE.length],
            PANTS_PALETTE[idxSeed % PANTS_PALETTE.length],
            SKIN_PALETTE[idxSeed % SKIN_PALETTE.length]
          );

          const initiallyOccupied = c < 2 && (rIdx + sIdx) % 2 === 0;
          if (initiallyOccupied) {
            humanRig.root.position.set(sx, 1.18, sz);
            humanRig.root.rotation.y = 0;
            animateHumanPose(humanRig, 'SIT', 0);
            humanRig.root.visible = true;
          } else {
            humanRig.root.visible = false;
          }

          bodyPivot.add(humanRig.root);
          carSeats.push({
            rig: humanRig,
            seatX: sx,
            seatZ: sz,
            destinationStation: (idxSeed % 3) + 1,
            state: initiallyOccupied ? 'SEATED' : 'EMPTY',
            progress: initiallyOccupied ? 1 : 0,
            doorSide: -1,
          });
        });
      });

      let headlightSpotL: THREE.SpotLight | undefined;
      let headlightSpotR: THREE.SpotLight | undefined;
      let volumetricConeL: THREE.Mesh | undefined;
      let volumetricConeR: THREE.Mesh | undefined;
      let headlightBulbL: THREE.Mesh | undefined;
      let headlightBulbR: THREE.Mesh | undefined;
      let cabThrottleLever: THREE.Mesh | undefined;
      let cabBrakeLever: THREE.Mesh | undefined;
      let copilotRig: HumanRig | undefined;

      if (c === 0) {
        // Sleek Aerodynamic High-Speed Bullet Nose Cone
        const noseMain = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 1.56, 4.8, 24).rotateX(Math.PI / 2),
          shellMat
        );
        noseMain.scale.set(1.0, 0.82, 1.0);
        noseMain.position.set(0, 1.95, 9.6);
        noseMain.castShadow = true;
        bodyPivot.add(noseMain);

        const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), stripeMat);
        noseTip.scale.set(1.0, 0.82, 1.35);
        noseTip.position.set(0, 1.95, 12.0);
        bodyPivot.add(noseTip);

        // Wrap-Around Tinted Cockpit Canopy Glass
        const canopyGlass = new THREE.Mesh(
          new THREE.BoxGeometry(2.72, 0.95, 2.6),
          new THREE.MeshPhysicalMaterial({
            color: 0x0f172a,
            transparent: true,
            opacity: 0.38,
            roughness: 0.05,
            metalness: 0.8,
          })
        );
        canopyGlass.position.set(0, 2.92, 8.2);
        canopyGlass.rotation.x = 0.38;
        bodyPivot.add(canopyGlass);

        // Glowing Cyan LED Daytime Running Light (DRL) Strips
        const drlMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const drlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.9), drlMat);
        drlLeft.position.set(-0.98, 1.82, 10.6);
        drlLeft.rotation.y = 0.25;
        const drlRight = drlLeft.clone();
        drlRight.position.set(0.98, 1.82, 10.6);
        drlRight.rotation.y = -0.25;
        bodyPivot.add(drlLeft, drlRight);

        // High-Speed Roof Pantograph
        const pantoBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 1.8), roofMat);
        pantoBase.position.set(0, 3.9, -3.5);
        const pantoArm1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 1.1, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
        );
        pantoArm1.position.set(0, 4.35, -3.8);
        pantoArm1.rotation.x = 0.6;
        const pantoBow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.12), railMat);
        pantoBow.position.set(0, 4.78, -3.4);
        bodyPivot.add(pantoBase, pantoArm1, pantoBow);

        // 3D Driver Cockpit Dashboard Desk & MFD Screens (visible in Cab View & Cabin View!)
        const cabDesk = new THREE.Mesh(
          new THREE.BoxGeometry(2.75, 0.92, 1.25),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
        );
        cabDesk.position.set(0, 1.62, 8.45);
        bodyPivot.add(cabDesk);

        // 3 Glowing MFD Telemetry Screens on the 3D Cockpit Desk
        [-0.65, 0, 0.65].forEach((mfdX, mIdx) => {
          const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.48, 0.32, 0.04),
            new THREE.MeshBasicMaterial({
              color: mIdx === 1 ? 0x10b981 : 0x38bdf8,
            })
          );
          screen.position.set(mfdX, 2.22, 8.22);
          screen.rotation.x = -0.35;
          bodyPivot.add(screen);
        });

        // Physical Moving 3D Throttle & Brake Levers on Cockpit Desk
        cabThrottleLever = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.38, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x10b981 })
        );
        cabThrottleLever.position.set(-0.35, 2.15, 8.02);
        cabBrakeLever = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.38, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b })
        );
        cabBrakeLever.position.set(0.35, 2.15, 8.02);
        bodyPivot.add(cabThrottleLever, cabBrakeLever);

        // Articulated 3D Human Copilot / Guard in the Cab & Cabin doorway giving live Torch/Hand Approval!
        copilotRig = createArticulatedHuman(0x0284c7, 0x0f172a, 0xfde68a, {
          hasSignalTorch: true,
          isUniformed: true,
        });
        copilotRig.root.position.set(0.82, 1.18, 6.85);
        copilotRig.root.rotation.y = -0.45;
        bodyPivot.add(copilotRig.root);

        // Glowing Headlight Lenses & Volumetric SpotLights
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        headlightBulbL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), bulbMat);
        headlightBulbL.position.set(-0.88, 1.62, 10.9);
        headlightBulbR = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), bulbMat);
        headlightBulbR.position.set(0.88, 1.62, 10.9);
        bodyPivot.add(headlightBulbL, headlightBulbR);

        headlightSpotL = new THREE.SpotLight(0xfffbeb, 14.0, 380, Math.PI / 4.0, 0.35, 1.0);
        headlightSpotL.position.set(-0.88, 1.75, 11.2);
        const targetL = new THREE.Object3D();
        targetL.position.set(-1.1, 0.1, 110);
        bodyPivot.add(targetL);
        headlightSpotL.target = targetL;
        bodyPivot.add(headlightSpotL);

        headlightSpotR = new THREE.SpotLight(0xe0f2fe, 12.0, 380, Math.PI / 3.8, 0.4, 1.0);
        headlightSpotR.position.set(0.88, 1.75, 11.2);
        const targetR = new THREE.Object3D();
        targetR.position.set(1.1, 0.1, 110);
        bodyPivot.add(targetR);
        headlightSpotR.target = targetR;
        bodyPivot.add(headlightSpotR);

        const coneGeo = new THREE.ConeGeometry(8.2, 64, 24, 1, true);
        coneGeo.translate(0, -32, 0);
        coneGeo.rotateX(-Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef9c3,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });

        volumetricConeL = new THREE.Mesh(coneGeo, coneMat);
        volumetricConeL.position.set(-0.88, 1.62, 11.0);
        volumetricConeL.rotation.x = 0.04;
        volumetricConeR = new THREE.Mesh(coneGeo, coneMat);
        volumetricConeR.position.set(0.88, 1.62, 11.0);
        volumetricConeR.rotation.x = 0.04;
        bodyPivot.add(volumetricConeL, volumetricConeR);
      }

      // Roof HVAC Pod
      const roofPod = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 9.5), roofMat);
      roofPod.position.y = 3.95;
      bodyPivot.add(roofPod);

      // Sliding Passenger Doors
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.65, roughness: 0.25 });
      const leftDoors: THREE.Mesh[] = [];
      const rightDoors: THREE.Mesh[] = [];
      [-0.52, 0.52].forEach((zPanel) => {
        const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.35, 0.95), doorMat);
        leftDoor.position.set(1.56, 2.25, zPanel);
        bodyPivot.add(leftDoor);
        leftDoors.push(leftDoor);

        const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.35, 0.95), doorMat);
        rightDoor.position.set(-1.56, 2.25, zPanel);
        bodyPivot.add(rightDoor);
        rightDoors.push(rightDoor);
      });

      // Bogies & Wheels
      const wheels: THREE.Mesh[] = [];
      [-4.6, -3.0, 3.0, 4.6].forEach((zAxle) => {
        const axleGroup = new THREE.Group();
        axleGroup.position.set(0, 0.55, zAxle);
        const leftW = new THREE.Mesh(wheelGeo, wheelMat);
        leftW.position.x = -0.82;
        const rightW = new THREE.Mesh(wheelGeo, wheelMat);
        rightW.position.x = 0.82;
        const spokeBar = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.16, 0.16),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        );
        axleGroup.add(leftW, rightW, spokeBar);
        carGroup.add(axleGroup);
        wheels.push(axleGroup as unknown as THREE.Mesh);
      });

      trainRootGroup.add(carGroup);
      playerCars.push({
        group: carGroup,
        bodyPivot,
        shellMats: [shellMat],
        stripeMat,
        leftDoors,
        rightDoors,
        wheels,
        cabinLight,
        seats: carSeats,
        headlightSpotL,
        headlightSpotR,
        volumetricConeL,
        volumetricConeR,
        headlightBulbL,
        headlightBulbR,
        cabThrottleLever,
        cabBrakeLever,
        copilotRig,
      });
    }

    // AI Opposing Express Train running on the opposite track
    const aiTrainGroup = new THREE.Group();
    const aiBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 3.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 })
    );
    aiBody.position.y = 2.3;
    const aiStripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.08, 0.75, 15.8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    aiStripe.position.y = 2.75;
    aiTrainGroup.add(aiBody, aiStripe);
    scene.add(aiTrainGroup);

    // Pointer / Orbit Camera Controls
    const onPointerDown = (e: PointerEvent) => {
      physicsRef.current.isPointerDown = true;
      physicsRef.current.lastPointerX = e.clientX;
      physicsRef.current.lastPointerY = e.clientY;
      audioRef.current.init();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!physicsRef.current.isPointerDown) return;
      const dx = e.clientX - physicsRef.current.lastPointerX;
      const dy = e.clientY - physicsRef.current.lastPointerY;
      physicsRef.current.lastPointerX = e.clientX;
      physicsRef.current.lastPointerY = e.clientY;
      physicsRef.current.orbitYaw -= dx * 0.0065;
      physicsRef.current.orbitPitch = Math.max(-0.25, Math.min(1.35, physicsRef.current.orbitPitch + dy * 0.0065));
    };
    const onPointerUp = () => {
      physicsRef.current.isPointerDown = false;
    };
    const onWheel = (e: WheelEvent) => {
      physicsRef.current.orbitZoom = Math.max(8, Math.min(95, physicsRef.current.orbitZoom + e.deltaY * 0.03));
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: true });

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    let lastTime = performance.now();
    let uiTimer = 0;
    let passengerSpawnTimer = 0;

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsedSec = now * 0.001;

      const ctrl = controlsRef.current;
      const phys = physicsRef.current;
      const spec = TRAIN_SPECS[ctrl.trainModel];

      if (phys.redSignalOverrideTimer > 0) {
        phys.redSignalOverrideTimer = Math.max(0, phys.redSignalOverrideTimer - dt);
      }

      const normDist = ((phys.distance % TOTAL_TRACK_LENGTH) + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;
      const inUndergroundTunnel = normDist >= 1760 && normDist <= 2720;
      const isEveningOrNight = ctrl.timeOfDay >= 17.2 || ctrl.timeOfDay <= 6.5 || inUndergroundTunnel;

      // Update Train Livery, 3D Cockpit Levers, and Volumetric Headlights
      playerCars.forEach((car, idx) => {
        car.group.visible = idx < spec.carCount;
        car.shellMats.forEach((m) => m.color.setHex(spec.primaryColor));
        car.stripeMat.color.setHex(spec.secondaryColor);
        car.cabinLight.intensity = ctrl.interiorLights ? (isEveningOrNight ? 2.5 : 1.3) : 0.15;

        if (car.cabThrottleLever && car.cabBrakeLever) {
          car.cabThrottleLever.rotation.x = -0.5 + (ctrl.throttle / 100) * 1.0;
          car.cabBrakeLever.rotation.x = -0.5 + (ctrl.brake / 100) * 1.0;
        }

        if (
          car.headlightSpotL &&
          car.headlightSpotR &&
          car.volumetricConeL &&
          car.volumetricConeR &&
          car.headlightBulbL &&
          car.headlightBulbR
        ) {
          const beamPower = ctrl.headlights ? (isEveningOrNight ? 20.0 : 9.0) : 0;
          car.headlightSpotL.intensity = beamPower;
          car.headlightSpotR.intensity = beamPower * 0.92;
          car.volumetricConeL.visible = ctrl.headlights;
          car.volumetricConeR.visible = ctrl.headlights;
          (car.volumetricConeL.material as THREE.MeshBasicMaterial).opacity = isEveningOrNight ? 0.24 : 0.08;
          (car.headlightBulbL.material as THREE.MeshBasicMaterial).color.setHex(
            ctrl.headlights ? 0xffffff : 0x334155
          );
          (car.headlightBulbR.material as THREE.MeshBasicMaterial).color.setHex(
            ctrl.headlights ? 0xffffff : 0x334155
          );
        }
      });

      // Highlight 3D Crossover Switch Blades when Track B is selected
      switchBladeMeshes.forEach((bm) => {
        (bm.material as THREE.MeshStandardMaterial).color.setHex(ctrl.trackSwitchBranch ? 0x22c55e : 0x64748b);
      });

      // Animate City Railway Level Crossing Gates, Flashing Beacons & Waving Pedestrians
      const distToCrossing = Math.min(
        Math.abs(normDist - LEVEL_CROSSING_DIST),
        TOTAL_TRACK_LENGTH - Math.abs(normDist - LEVEL_CROSSING_DIST)
      );
      const trainApproachingCrossing = distToCrossing < 240;
      const targetGate = trainApproachingCrossing ? 1 : 0;
      phys.crossingGateAngle += (targetGate - phys.crossingGateAngle) * Math.min(1, dt * 3.2);

      gateArms.forEach((arm, idx) => {
        const sideSign = idx === 0 ? -1 : 1;
        // 0 = vertical open (-Math.PI/2), 1 = horizontal closed across road (0)
        arm.rotation.x = sideSign * (1 - phys.crossingGateAngle) * (Math.PI / 2.1);
      });

      const flashOn = trainApproachingCrossing && Math.floor(elapsedSec * 6) % 2 === 0;
      gateFlashMats.forEach((mat, idx) => {
        mat.color.setHex(
          trainApproachingCrossing
            ? (idx % 2 === 0 ? flashOn : !flashOn)
              ? 0xff1111
              : 0x450a0a
            : 0x334155
        );
      });

      if (trainApproachingCrossing && distToCrossing < 95) {
        phys.crossingBellTimer += dt;
        if (phys.crossingBellTimer > 0.65) {
          phys.crossingBellTimer = 0;
          audioRef.current.playBell();
        }
      }

      crossingPedestrians.forEach((ped, idx) => {
        animateHumanPose(ped, trainApproachingCrossing ? 'WAVE_TORCH' : 'IDLE', elapsedSec + idx);
      });

      // Locate Active Speed Zone, Nearest Station & Next Station Ahead
      const activeZone =
        SPEED_ZONES.find((z) => normDist >= z.start && normDist <= z.end) || SPEED_ZONES[0];

      let closestStation = STATIONS[0];
      let minStationDist = Infinity;
      let upcomingStation = STATIONS[1];
      let minForwardDist = Infinity;

      STATIONS.forEach((st) => {
        let dSigned = st.distance - normDist;
        if (dSigned < -TOTAL_TRACK_LENGTH / 2) dSigned += TOTAL_TRACK_LENGTH;
        if (dSigned > TOTAL_TRACK_LENGTH / 2) dSigned -= TOTAL_TRACK_LENGTH;

        if (Math.abs(dSigned) < Math.abs(minStationDist)) {
          minStationDist = dSigned;
          closestStation = st;
        }

        const dForward = (st.distance - normDist + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;
        if (dForward > 25 && dForward < minForwardDist) {
          minForwardDist = dForward;
          upcomingStation = st;
        }
      });

      const isStoppedAtPlatform = Math.abs(minStationDist) < 38 && Math.abs(phys.speedMs * 3.6) < 1.8;

      // Update Station Flagmen (3D Light Man) & 3D Copilot Pose & Torch Colors
      const currentFlagState: FlagmanState = ctrl.doorsOpen
        ? 'RED_BOARDING'
        : isStoppedAtPlatform && phys.stationBoardingComplete
        ? 'GREEN_CLEAR'
        : isStoppedAtPlatform
        ? 'RED_STOP'
        : Math.abs(minStationDist) < 180
        ? 'RED_STOP'
        : 'GREEN_CLEAR';

      stationFlagmen.forEach(({ rig, stationIndex }) => {
        const isCurrentSt = stationIndex === closestStation.index;
        const showGreen = isCurrentSt ? currentFlagState === 'GREEN_CLEAR' : true;
        const torchHex = showGreen ? 0x22c55e : 0xff2222;

        if (rig.torchBulbMat && rig.torchLight && rig.flagMat) {
          rig.torchBulbMat.color.setHex(torchHex);
          rig.torchLight.color.setHex(torchHex);
          rig.flagMat.color.setHex(torchHex);
          rig.flagMat.emissive.setHex(torchHex);
        }
        animateHumanPose(rig, showGreen ? 'WAVE_TORCH' : 'HOLD_STOP_TORCH', elapsedSec);
      });

      // Animate 3D Train Copilot inside Lead Car
      const leadCopilot = playerCars[0]?.copilotRig;
      if (leadCopilot) {
        const copilotGreen = !ctrl.doorsOpen && (!isStoppedAtPlatform || phys.stationBoardingComplete);
        const cHex = copilotGreen ? 0x22c55e : 0xff2222;
        if (leadCopilot.torchBulbMat && leadCopilot.torchLight && leadCopilot.flagMat) {
          leadCopilot.torchBulbMat.color.setHex(cHex);
          leadCopilot.torchLight.color.setHex(cHex);
          leadCopilot.flagMat.color.setHex(cHex);
          leadCopilot.flagMat.emissive.setHex(cHex);
        }
        animateHumanPose(leadCopilot, copilotGreen ? 'WAVE_TORCH' : 'HOLD_STOP_TORCH', elapsedSec);
      }

      // Block Signals & Red Signal SPAD Detection
      let upcomingSigDist = Infinity;
      let upcomingSigState: SignalState = 'GREEN';
      let upcomingSigIndex = 0;
      const trafficCycleBucket = Math.floor(elapsedSec / 19);

      signalLamps.forEach((sig) => {
        const distFromTrain = (sig.distance - normDist + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;
        const distFromAI = Math.abs(sig.distance - phys.aiDistance);

        let state: SignalState = 'GREEN';
        if (phys.redSignalOverrideTimer <= 0) {
          if (distFromAI < 210 || (sig.index + trafficCycleBucket) % 5 === 0) {
            state = 'RED';
          } else if (distFromAI < 450 || (sig.index + trafficCycleBucket) % 3 === 0) {
            state = 'YELLOW';
          }
        }
        sig.state = state;

        sig.redMat.color.setHex(state === 'RED' ? 0xff2222 : 0x3b0707);
        sig.yellowMat.color.setHex(state === 'YELLOW' ? 0xfacc15 : 0x3b2506);
        sig.greenMat.color.setHex(state === 'GREEN' ? 0x22c55e : 0x052e16);
        sig.pointLight.color.setHex(
          state === 'RED' ? 0xef4444 : state === 'YELLOW' ? 0xfacc15 : 0x22c55e
        );

        if (distFromTrain < upcomingSigDist) {
          upcomingSigDist = distFromTrain;
          upcomingSigState = state;
          upcomingSigIndex = sig.index;
        }
      });

      if (upcomingSigDist < 14 && phys.speedMs * 3.6 > 5 && phys.lastPassedSignalIndex !== upcomingSigIndex) {
        phys.lastPassedSignalIndex = upcomingSigIndex;
        if (upcomingSigState === 'RED') {
          audioRef.current.playAlarm();
          setSignalViolationAlert('RED SIGNAL VIOLATION (SPAD)! Always stop before a Red Signal!');
          addPassengerReview('🤬', 'Liam K.', 'Safety Violation', 'Driver ran a RED signal! Terrifying!', -0.8, -400);
          setTimeout(() => setSignalViolationAlert(null), 5000);
        }
      }

      // Autopilot Assist
      let activeThrottle = ctrl.throttle;
      let activeBrake = ctrl.brake;

      if (ctrl.autopilot && !ctrl.emergencyStop && !ctrl.doorsOpen) {
        let targetKmh = activeZone.limit * 0.9;
        if (upcomingSigState === 'RED' && upcomingSigDist < 260) {
          targetKmh = upcomingSigDist < 38 ? 0 : Math.min(targetKmh, (upcomingSigDist / 260) * 80);
        } else if (upcomingSigState === 'YELLOW' && upcomingSigDist < 240) {
          targetKmh = Math.min(targetKmh, 45);
        }
        if (minStationDist > 0 && minStationDist < 200 && !phys.stationBoardingComplete) {
          targetKmh = Math.min(targetKmh, Math.max(12, (minStationDist / 200) * 85));
        }

        const currKmh = phys.speedMs * 3.6;
        if (currKmh < targetKmh - 3) {
          activeThrottle = 68;
          activeBrake = 0;
        } else if (currKmh > targetKmh + 3) {
          activeThrottle = 0;
          activeBrake = 58;
        } else {
          activeThrottle = 25;
          activeBrake = 0;
        }
      }

      // Longitudinal Train Physics
      const tLead = normDist / TOTAL_TRACK_LENGTH;
      const leadTangent = trackSpline.getTangentAt(tLead).normalize();
      const slopeSine = leadTangent.y;

      const dirSign = ctrl.reverser === 'F' ? 1 : ctrl.reverser === 'R' ? -1 : 0;
      const maxSpeedMs = spec.maxSpeed / 3.6;

      let tractiveAccel = 0;
      if (!ctrl.emergencyStop && !ctrl.doorsOpen && dirSign !== 0) {
        tractiveAccel = (activeThrottle / 100) * spec.accelRate * dirSign;
      }

      const rollingDrag = 0.08 + 0.00045 * phys.speedMs * phys.speedMs;
      const gravityAccel = -slopeSine * 9.81 * 0.35;
      const brakeDecel =
        (ctrl.emergencyStop ? 1.85 : activeBrake / 100) * spec.brakeRate + rollingDrag;

      const prevSpeedMs = phys.speedMs;
      phys.speedMs += (tractiveAccel + gravityAccel) * dt;

      if (Math.abs(phys.speedMs) > 0.001) {
        const sign = Math.sign(phys.speedMs);
        const nextSpeed = phys.speedMs - sign * brakeDecel * dt;
        phys.speedMs = Math.sign(nextSpeed) !== sign ? 0 : nextSpeed;
      } else if (Math.abs(tractiveAccel) < brakeDecel) {
        phys.speedMs = 0;
      }

      phys.speedMs = Math.max(-maxSpeedMs * 0.45, Math.min(maxSpeedMs, phys.speedMs));
      phys.distance = (phys.distance + phys.speedMs * dt + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;

      // Speeding Penalty Check
      const currentSpeedKmh = Math.abs(phys.speedMs * 3.6);
      if (currentSpeedKmh > activeZone.limit + 4) {
        phys.overspeedPenaltyTimer += dt;
        if (phys.overspeedPenaltyTimer > 4.5) {
          phys.overspeedPenaltyTimer = 0;
          audioRef.current.playAlarm();
          addPassengerReview(
            '😨',
            'Maya P.',
            activeZone.label,
            `Speeding at ${Math.round(currentSpeedKmh)} km/h in ${activeZone.limit} km/h zone!`,
            -0.3,
            -120
          );
        }
      } else {
        phys.overspeedPenaltyTimer = Math.max(0, phys.overspeedPenaltyTimer - dt);
      }

      // Precision Station Stop Scoring & Spoken Passenger Review
      if (isStoppedAtPlatform && !phys.hasScoredCurrentStationStop) {
        phys.hasScoredCurrentStationStop = true;
        phys.stationBoardingComplete = false;
        const absErr = Math.abs(minStationDist);
        const activeTrackLabel = ctrl.trackSwitchBranch ? 'Track B' : 'Track A';
        const trackBonus =
          (ctrl.trackSwitchBranch ? 'B' : 'A') === closestStation.recommendedTrack ? 150 : 0;

        if (absErr <= 6.0) {
          const pts = 500 + trackBonus;
          setLastStopBanner(
            `🎯 BULLSEYE STOP (${absErr.toFixed(1)}m) on ${activeTrackLabel}! +${pts} PTS — Open Doors (D)!`
          );
          addPassengerReview(
            '🤩',
            PASSENGER_NAMES[closestStation.index % PASSENGER_NAMES.length],
            `Arrived ${closestStation.name}`,
            `Pinpoint stop (${absErr.toFixed(1)}m) on ${activeTrackLabel}! Best train driver ever!`,
            0.25,
            pts
          );
        } else if (absErr <= 18.0) {
          const pts = 250 + trackBonus;
          setLastStopBanner(
            `✅ GREAT STOP (${absErr.toFixed(1)}m) on ${activeTrackLabel}! +${pts} PTS — Open Doors (D)!`
          );
          addPassengerReview(
            '😍',
            PASSENGER_NAMES[(closestStation.index + 2) % PASSENGER_NAMES.length],
            `Arrived ${closestStation.name}`,
            `Smooth arrival at ${closestStation.name} (${absErr.toFixed(1)}m from marker).`,
            0.15,
            pts
          );
        } else {
          setLastStopBanner(
            `⚠️ ROUGH ALIGNMENT (${absErr.toFixed(1)}m) — +100 PTS — Open Doors (D) to board!`
          );
          addPassengerReview(
            '😐',
            PASSENGER_NAMES[(closestStation.index + 4) % PASSENGER_NAMES.length],
            `Arrived ${closestStation.name}`,
            `Stopped ${absErr.toFixed(1)}m away from the platform target marker.`,
            -0.05,
            100
          );
        }
      } else if (Math.abs(minStationDist) > 75) {
        phys.hasScoredCurrentStationStop = false;
        phys.stationBoardingComplete = false;
      }

      // Advance AI Opposing Train on opposite track
      phys.aiDistance = (phys.aiDistance + 22 * dt + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;
      const aiT = phys.aiDistance / TOTAL_TRACK_LENGTH;
      const aiPos = trackSpline.getPointAt(aiT);
      const aiTan = trackSpline.getTangentAt(aiT).normalize();
      const aiRight = new THREE.Vector3().crossVectors(aiTan, new THREE.Vector3(0, 1, 0)).normalize();
      const aiTrackOffset = ctrl.trackSwitchBranch ? -2.2 : 2.2;
      aiTrainGroup.position.copy(aiPos).addScaledVector(aiRight, aiTrackOffset);
      aiTrainGroup.lookAt(aiTrainGroup.position.clone().add(aiTan));

      // Smoothly steer player train between Separated Track A (-2.2m) and Track B (+2.2m)
      phys.lateralOffset += (phys.targetLateralOffset - phys.lateralOffset) * Math.min(1, dt * 2.8);

      const accelG = (phys.speedMs - prevSpeedMs) / (dt * 9.81);
      phys.bodyPitch += (-accelG * 0.08 - phys.bodyPitch) * Math.min(1, dt * 6);
      phys.wheelRotation += (phys.speedMs / 0.52) * dt;

      const targetDoor = ctrl.doorsOpen ? 1 : 0;
      phys.doorProgress += (targetDoor - phys.doorProgress) * Math.min(1, dt * 4.5);

      const CAR_SPACING = 16.4;
      for (let c = 0; c < spec.carCount; c++) {
        const carDist = (phys.distance - c * CAR_SPACING + TOTAL_TRACK_LENGTH) % TOTAL_TRACK_LENGTH;
        const tCar = carDist / TOTAL_TRACK_LENGTH;
        const pos = trackSpline.getPointAt(tCar);
        const tan = trackSpline.getTangentAt(tCar).normalize();
        const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

        const carRef = playerCars[c];
        carRef.group.position.copy(pos).addScaledVector(right, phys.lateralOffset);
        carRef.group.lookAt(carRef.group.position.clone().add(tan));
        carRef.bodyPivot.rotation.x = phys.bodyPitch;

        carRef.wheels.forEach((w) => {
          w.rotation.x = phys.wheelRotation;
        });

        const doorSlide = phys.doorProgress * 0.92;
        if (carRef.leftDoors.length === 2) {
          carRef.leftDoors[0].position.z = -0.52 - doorSlide;
          carRef.leftDoors[1].position.z = 0.52 + doorSlide;
          carRef.rightDoors[0].position.z = -0.52 - doorSlide;
          carRef.rightDoors[1].position.z = 0.52 + doorSlide;
        }
      }

      const activeStationIdx = closestStation.index;
      // If train is on Track B (+2.2m), doors open toward Right Platform (local X = -1.52); if Track A (-2.2m), Left Platform (local X = +1.52)
      const activePlatformSide = phys.lateralOffset >= 0 ? 1 : -1;
      const trainDoorLocalSign = activePlatformSide === 1 ? -1 : 1;

      platformAgents.forEach((agent) => {
        agent.animPhase += dt;
        const waitX = agent.sideSign * 6.8;
        const doorTargetX = agent.sideSign * 3.7;

        if (agent.state === 'WAITING') {
          agent.rig.root.visible = true;
          agent.rig.root.position.set(waitX, 1.08, agent.slotZ);
          agent.rig.root.rotation.y = agent.sideSign === 1 ? -Math.PI / 2 : Math.PI / 2;
          animateHumanPose(agent.rig, 'IDLE', agent.animPhase);
        } else if (agent.state === 'WALKING_TO_DOOR') {
          agent.rig.root.visible = true;
          agent.progress = Math.min(1, agent.progress + dt * 0.85);
          const curX = THREE.MathUtils.lerp(waitX, doorTargetX, agent.progress);
          const curZ = THREE.MathUtils.lerp(agent.slotZ, 0, agent.progress);
          agent.rig.root.position.set(curX, 1.08, curZ);
          agent.rig.root.rotation.y = Math.atan2(doorTargetX - waitX, 0 - agent.slotZ);
          animateHumanPose(agent.rig, 'WALK', agent.animPhase);

          if (agent.progress >= 1) {
            agent.state = 'HIDDEN_ONBOARD';
            agent.rig.root.visible = false;
          }
        } else if (agent.state === 'ALIGHTING_TO_PLATFORM') {
          agent.rig.root.visible = true;
          agent.progress = Math.min(1, agent.progress + dt * 0.78);
          const curX = THREE.MathUtils.lerp(doorTargetX, waitX, agent.progress);
          const curZ = THREE.MathUtils.lerp(0, agent.slotZ, agent.progress);
          agent.rig.root.position.set(curX, 1.08, curZ);
          agent.rig.root.rotation.y = Math.atan2(waitX - doorTargetX, agent.slotZ - 0);
          animateHumanPose(agent.rig, 'WALK', agent.animPhase);

          if (agent.progress >= 1) {
            agent.state = 'WAITING';
          }
        }
      });

      if (isStoppedAtPlatform && ctrl.doorsOpen && phys.doorProgress > 0.6) {
        passengerSpawnTimer += dt;
        if (passengerSpawnTimer > 0.6) {
          passengerSpawnTimer = 0;

          // 1. Alight passengers whose destination is this station
          let alightedOne = false;
          for (let c = 0; c < spec.carCount && !alightedOne; c++) {
            const seatToExit = playerCars[c].seats.find(
              (s) => s.state === 'SEATED' && s.destinationStation === activeStationIdx
            );
            if (seatToExit) {
              seatToExit.state = 'ALIGHTING_AISLE';
              seatToExit.progress = 0;
              seatToExit.doorSide = trainDoorLocalSign;
              alightedOne = true;

              const hiddenPlatAgent = platformAgents.find(
                (pa) => pa.stationIndex === activeStationIdx && pa.state === 'HIDDEN_ONBOARD'
              );
              if (hiddenPlatAgent) {
                hiddenPlatAgent.state = 'ALIGHTING_TO_PLATFORM';
                hiddenPlatAgent.progress = 0;
              }
            }
          }

          // 2. Board waiting passengers from this station into empty cabin seats
          const waitingPlatAgent = platformAgents.find(
            (pa) => pa.stationIndex === activeStationIdx && pa.state === 'WAITING'
          );
          if (waitingPlatAgent) {
            let emptySeat: CabinPassengerSeat | undefined;
            for (let c = 0; c < spec.carCount; c++) {
              emptySeat = playerCars[c].seats.find((s) => s.state === 'EMPTY');
              if (emptySeat) break;
            }
            if (emptySeat) {
              waitingPlatAgent.state = 'WALKING_TO_DOOR';
              waitingPlatAgent.progress = 0;

              const destIdx = (activeStationIdx + 1 + Math.floor(Math.random() * 2)) % STATIONS.length;
              emptySeat.state = 'BOARDING_AISLE';
              emptySeat.progress = 0;
              emptySeat.doorSide = trainDoorLocalSign;
              emptySeat.destinationStation = destIdx;
              emptySeat.rig.root.visible = true;
            }
          }
        }
      }

      // Animate Interior Cabin Passengers & Compute Live Manifest Breakdown
      let totalSeatedOrBoarding = 0;
      const destCounts = [0, 0, 0, 0];

      for (let c = 0; c < spec.carCount; c++) {
        playerCars[c].seats.forEach((seat, sIdx) => {
          const phase = elapsedSec + sIdx * 0.5;
          if (seat.state === 'BOARDING_AISLE') {
            totalSeatedOrBoarding++;
            destCounts[seat.destinationStation]++;
            seat.progress = Math.min(1, seat.progress + dt * 0.65);
            seat.rig.root.visible = true;

            if (seat.progress < 0.4) {
              const t = seat.progress / 0.4;
              const curX = THREE.MathUtils.lerp(seat.doorSide * 1.48, 0, t);
              seat.rig.root.position.set(curX, 1.18, 0);
              seat.rig.root.rotation.y = seat.doorSide > 0 ? -Math.PI / 2 : Math.PI / 2;
              animateHumanPose(seat.rig, 'WALK', phase);
            } else {
              const t = (seat.progress - 0.4) / 0.6;
              const curZ = THREE.MathUtils.lerp(0, seat.seatZ, t);
              const curX = t > 0.75 ? THREE.MathUtils.lerp(0, seat.seatX, (t - 0.75) / 0.25) : 0;
              seat.rig.root.position.set(curX, 1.18, curZ);
              seat.rig.root.rotation.y = seat.seatZ >= 0 ? 0 : Math.PI;
              animateHumanPose(seat.rig, 'WALK', phase);
            }

            if (seat.progress >= 1) {
              seat.state = 'SEATED';
              seat.rig.root.position.set(seat.seatX, 1.18, seat.seatZ);
              seat.rig.root.rotation.y = 0;
              animateHumanPose(seat.rig, 'SIT', phase);
            }
          } else if (seat.state === 'SEATED') {
            totalSeatedOrBoarding++;
            destCounts[seat.destinationStation]++;
            seat.rig.root.visible = true;
            seat.rig.root.position.set(seat.seatX, 1.18, seat.seatZ);
            seat.rig.root.rotation.y = 0;
            animateHumanPose(seat.rig, 'SIT', phase);
          } else if (seat.state === 'ALIGHTING_AISLE') {
            seat.progress = Math.min(1, seat.progress + dt * 0.75);
            seat.rig.root.visible = true;

            if (seat.progress < 0.6) {
              const t = seat.progress / 0.6;
              const curZ = THREE.MathUtils.lerp(seat.seatZ, 0, t);
              seat.rig.root.position.set(0, 1.18, curZ);
              seat.rig.root.rotation.y = seat.seatZ >= 0 ? Math.PI : 0;
              animateHumanPose(seat.rig, 'WALK', phase);
            } else {
              const t = (seat.progress - 0.6) / 0.4;
              const curX = THREE.MathUtils.lerp(0, seat.doorSide * 1.55, t);
              seat.rig.root.position.set(curX, 1.18, 0);
              seat.rig.root.rotation.y = seat.doorSide > 0 ? Math.PI / 2 : -Math.PI / 2;
              animateHumanPose(seat.rig, 'WALK', phase);
            }

            if (seat.progress >= 1) {
              seat.state = 'EMPTY';
              seat.rig.root.visible = false;
              setTotalDeliveredPassengers((prev) => {
                const nextTotal = prev + 1;
                if (nextTotal % 3 === 0) {
                  const pName = PASSENGER_NAMES[nextTotal % PASSENGER_NAMES.length];
                  addPassengerReview(
                    '🌟',
                    pName,
                    `Dropped at ${closestStation.name}`,
                    `Thank you for dropping me safely at ${closestStation.name}! +75 pts`,
                    0.08,
                    75
                  );
                }
                return nextTotal;
              });
            }
          } else {
            seat.rig.root.visible = false;
          }
        });
      }

      // Day / Sunset / Night / Underground Lighting Update
      let currentHour = ctrl.timeOfDay;
      if (ctrl.autoTimeCycle) {
        currentHour = (currentHour + dt * 0.08) % 24;
        controlsRef.current.timeOfDay = currentHour;
      }

      const sunAngle = ((currentHour - 6) / 24) * Math.PI * 2;
      const sunHeight = Math.sin(sunAngle);
      const sunHoriz = Math.cos(sunAngle);

      sunLight.position.set(sunHoriz * 550, Math.max(25, sunHeight * 500), 220);
      sunOrb.position.set(sunHoriz * 900, sunHeight * 800, -400);
      sunOrb.visible = sunHeight > -0.08;

      const moonHeight = -sunHeight;
      const moonHoriz = -sunHoriz;
      moonGroup.position.set(moonHoriz * 820, Math.max(180, moonHeight * 680 + 240), -520);
      moonLight.position.copy(moonGroup.position);

      const skyColor = new THREE.Color();
      if (inUndergroundTunnel) {
        skyColor.setHex(0x090d16);
        sunLight.intensity = 0.15;
        ambientLight.intensity = 0.35;
      } else if (sunHeight > 0.25) {
        skyColor.setHex(0x7dd3fc);
        sunLight.intensity = 1.45;
        sunLight.color.setHex(0xfffbeb);
        ambientLight.intensity = 0.68;
        moonGroup.visible = false;
        moonLight.intensity = 0;
        starMat.opacity = 0;
      } else if (sunHeight > -0.14) {
        skyColor.setHex(0xc2410c);
        sunLight.intensity = 0.95;
        sunLight.color.setHex(0xfdba74);
        ambientLight.intensity = 0.44;
        moonGroup.visible = true;
        moonLight.intensity = 0.38;
        starMat.opacity = 0.45;
      } else {
        skyColor.setHex(0x060b19);
        sunLight.intensity = 0.08;
        ambientLight.intensity = 0.26;
        moonGroup.visible = true;
        moonLight.intensity = 0.88;
        starMat.opacity = 0.95;
      }

      scene.background = skyColor;
      (scene.fog as THREE.FogExp2).color.copy(skyColor);

      const isDark = sunHeight < 0.15 || inUndergroundTunnel;
      stationLights.forEach((l) => {
        l.intensity = isDark ? 3.5 : 0.8;
      });

      // Camera Modes (including 3D Driver Cab with Copilot & 3D Passenger Cabin!)
      const leadCar = playerCars[0].group;
      const leadPos = leadCar.position.clone();
      const leadForward = trackSpline.getTangentAt(tLead).normalize();
      const leadRight = new THREE.Vector3().crossVectors(leadForward, new THREE.Vector3(0, 1, 0)).normalize();

      if (ctrl.cameraMode === 'follow') {
        const camOffset = leadPos
          .clone()
          .addScaledVector(leadForward, -26)
          .add(new THREE.Vector3(0, 9.2, 0))
          .addScaledVector(leadRight, 3.8);
        camera.position.lerp(camOffset, Math.min(1, dt * 6.5));
        camera.lookAt(leadPos.clone().addScaledVector(leadForward, 18).add(new THREE.Vector3(0, 2.4, 0)));
      } else if (ctrl.cameraMode === 'cab') {
        // Inside 3D Driver Cockpit showing MFD dashboard, moving levers, windshield, and 3D Copilot!
        const cabEyeWorld = new THREE.Vector3(-0.35, 2.68, 7.35);
        leadCar.localToWorld(cabEyeWorld);
        camera.position.copy(cabEyeWorld);

        const lookYawOffset = Math.sin(phys.orbitYaw - 0.65) * 4.5;
        const lookPitchOffset = (0.28 - phys.orbitPitch) * 3.0;
        const cabLookWorld = new THREE.Vector3(lookYawOffset, 2.1 + lookPitchOffset, 22.0);
        leadCar.localToWorld(cabLookWorld);
        camera.lookAt(cabLookWorld);
      } else if (ctrl.cameraMode === 'cabin') {
        // Inside 3D Passenger Cabin looking down the aisle at seats, doors, and Copilot at front!
        const cabinEyeWorld = new THREE.Vector3(0.0, 2.52, -5.8);
        leadCar.localToWorld(cabinEyeWorld);
        camera.position.copy(cabinEyeWorld);

        const lookYawOffset = Math.sin(phys.orbitYaw - 0.65) * 2.5;
        const lookPitchOffset = (0.28 - phys.orbitPitch) * 1.8;
        const cabinLookWorld = new THREE.Vector3(lookYawOffset, 2.05 + lookPitchOffset, 4.5);
        leadCar.localToWorld(cabinLookWorld);
        camera.lookAt(cabinLookWorld);
      } else if (ctrl.cameraMode === 'orbit') {
        const r = phys.orbitZoom;
        const ox = leadPos.x + r * Math.sin(phys.orbitYaw) * Math.cos(phys.orbitPitch);
        const oy = Math.max(2, leadPos.y + r * Math.sin(phys.orbitPitch));
        const oz = leadPos.z + r * Math.cos(phys.orbitYaw) * Math.cos(phys.orbitPitch);
        camera.position.lerp(new THREE.Vector3(ox, oy, oz), Math.min(1, dt * 10));
        camera.lookAt(leadPos.clone().add(new THREE.Vector3(0, 2.4, 0)));
      } else if (ctrl.cameraMode === 'side') {
        const sidePos = leadPos
          .clone()
          .addScaledVector(leadRight, 15)
          .addScaledVector(leadForward, -2)
          .add(new THREE.Vector3(0, 3.2, 0));
        camera.position.lerp(sidePos, Math.min(1, dt * 8));
        camera.lookAt(leadPos.clone().add(new THREE.Vector3(0, 2.2, 0)));
      } else if (ctrl.cameraMode === 'station') {
        const stT = closestStation.distance / TOTAL_TRACK_LENGTH;
        const stPt = trackSpline.getPointAt(stT);
        camera.position.lerp(stPt.clone().add(new THREE.Vector3(16, 7.5, 18)), Math.min(1, dt * 4));
        camera.lookAt(leadPos.clone().add(new THREE.Vector3(0, 2.2, 0)));
      }

      audioRef.current.update(phys.speedMs * 3.6, activeThrottle, activeBrake, inUndergroundTunnel);
      renderer.render(scene, camera);

      // Sync React HUD State ~15Hz
      uiTimer += dt;
      if (uiTimer > 0.065) {
        uiTimer = 0;
        const currentKmh = Math.abs(phys.speedMs * 3.6);
        setSpeedKmh(currentKmh);
        setDistanceTraveled(Math.round(normDist));
        setCurrentSpeedLimit(activeZone.limit);
        setCurrentZoneLabel(activeZone.label);
        setNearestStation(closestStation);
        setNextUpcomingStation(upcomingStation);
        setDistanceToNextStation(Math.round(Math.abs(minStationDist)));
        setStopPrecisionOffset(Number(minStationDist.toFixed(1)));
        setAtStationPlatform(isStoppedAtPlatform);
        setFlagmanSignal(currentFlagState);
        setCopilotApproved(!ctrl.doorsOpen && (!isStoppedAtPlatform || phys.stationBoardingComplete));
        setCrossingGateClosed(trainApproachingCrossing);

        setOnboardPassengers(totalSeatedOrBoarding);
        setDestinationBreakdown(destCounts);
        const targetNextIdx = isStoppedAtPlatform ? closestStation.index : upcomingStation.index;
        setDroppingNextStationCount(destCounts[targetNextIdx] ?? 0);

        const counts = [0, 0, 0, 0];
        platformAgents.forEach((pa) => {
          if (pa.state === 'WAITING') counts[pa.stationIndex]++;
        });
        setStationWaitingCounts(counts);

        setNextSignalState(upcomingSigState);
        setDistanceToNextSignal(Math.round(upcomingSigDist));
        setGForce(Number(accelG.toFixed(2)));
        setGradePercent(Number((slopeSine * 100).toFixed(1)));
        if (ctrl.autoTimeCycle) {
          setTimeOfDay(Number(currentHour.toFixed(2)));
        }
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [addPassengerReview]);

  const formattedTime = useMemo(() => {
    const hrs = Math.floor(timeOfDay) % 24;
    const mins = Math.floor((timeOfDay % 1) * 60);
    const period = hrs >= 12 ? 'PM' : 'AM';
    const h12 = hrs % 12 === 0 ? 12 : hrs % 12;
    return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
  }, [timeOfDay]);

  const ratingFace = useMemo(() => {
    if (passengerRating >= 4.5) return { emoji: '😍', label: '5★ Top Rated', color: 'text-emerald-400' };
    if (passengerRating >= 3.8) return { emoji: '😊', label: 'Smooth Service', color: 'text-blue-400' };
    if (passengerRating >= 2.8) return { emoji: '😐', label: 'Average Ride', color: 'text-amber-400' };
    if (passengerRating >= 1.8) return { emoji: '😠', label: 'Rough Stops', color: 'text-orange-400' };
    return { emoji: '🤬', label: 'Unsafe Driver!', color: 'text-red-400' };
  }, [passengerRating]);

  const isOverspeed = speedKmh > currentSpeedLimit + 2;
  const activeSpec = TRAIN_SPECS[trainModel];
  const maxSeatsCapacity = activeSpec.carCount * 12;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      {/* 3D WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Red Signal Violation Alert Banner */}
      {signalViolationAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-red-600/95 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl border border-red-300 animate-bounce">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          <div className="text-sm font-bold tracking-wide">{signalViolationAlert}</div>
        </div>
      )}

      {/* Top Navigation & Telemetry Header */}
      <header className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Brand, Score & Train Model Switcher */}
        <div className="flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-xl border border-white/10 px-3.5 py-2 rounded-2xl shadow-2xl pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-inner shadow-blue-300/30">
            <Train className="w-5 h-5 text-white" />
          </div>
          <div className="pr-2.5 border-r border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">RailOS 3D</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center gap-0.5">
                <Award className="w-3 h-3" /> {driverScore} PTS
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">{activeSpec.name}</p>
          </div>

          <div className="flex items-center gap-1">
            {(Object.keys(TRAIN_SPECS) as TrainModelType[]).map((key) => {
              const spec = TRAIN_SPECS[key];
              const isSelected = trainModel === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    audioRef.current.init();
                    setTrainModel(key);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {spec.id === 'express' ? 'Express' : spec.id === 'commuter' ? 'Metro' : 'Freight'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Station Precision Stop Target, Station Light Man & Copilot Approval Pill */}
        <div className="flex flex-wrap items-center gap-3.5 bg-slate-900/85 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl pointer-events-auto">
          {/* Station & Precision Stopping Meter */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>{atStationPlatform ? 'At Platform Stop Zone' : 'Target Station'}</span>
                <span className="text-cyan-400 font-bold">
                  (Rec: Track {nearestStation.recommendedTrack})
                </span>
              </div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>{nearestStation.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    Math.abs(stopPrecisionOffset) <= 8
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                      : Math.abs(stopPrecisionOffset) <= 38
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                      : 'bg-slate-800 text-blue-300'
                  }`}
                >
                  {Math.abs(stopPrecisionOffset) <= 45
                    ? `STOP TARGET: ${stopPrecisionOffset > 0 ? `+${stopPrecisionOffset}m` : `${stopPrecisionOffset}m`}`
                    : `${distanceToNextStation}m`}
                </span>
              </div>
            </div>
          </div>

          {/* 3D Station Light Man (Flagman) & Copilot Signal Status */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
            <div
              className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-[11px] font-bold ${
                flagmanSignal === 'GREEN_CLEAR'
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-red-500/20 border-red-400/40 text-red-300 animate-pulse'
              }`}
              title="3D Station Light Man on Platform"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  flagmanSignal === 'GREEN_CLEAR'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]'
                    : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                }`}
              />
              <span>
                Light Man: {flagmanSignal === 'GREEN_CLEAR' ? 'GREEN TORCH (GO)' : 'RED TORCH (STOP)'}
              </span>
            </div>

            <div
              className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 text-[11px] font-bold ${
                copilotApproved
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              }`}
              title="3D Human Copilot in Cab/Cabin"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Copilot: {copilotApproved ? 'APPROVED' : 'HOLD'}</span>
            </div>
          </div>

          {/* Block Signal Indicator + Clear Button */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="flex flex-col items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  nextSignalState === 'RED' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950'
                }`}
              />
              <span
                className={`w-2 h-2 rounded-full ${
                  nextSignalState === 'YELLOW' ? 'bg-amber-400 shadow-[0_0_8px_#facc15]' : 'bg-amber-950'
                }`}
              />
              <span
                className={`w-2 h-2 rounded-full ${
                  nextSignalState === 'GREEN' ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]' : 'bg-emerald-950'
                }`}
              />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">{distanceToNextSignal}m</div>
            {nextSignalState === 'RED' && (
              <button
                onClick={handleRequestSignalClearance}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-400/40 text-red-200 text-[10px] font-bold transition-all"
              >
                <Radio className="w-3 h-3 animate-pulse" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Camera Switcher (Cockpit Cab + Copilot & Cabin Views) & Time of Day */}
        <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-xl border border-white/10 px-3 py-2 rounded-2xl shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <Video className="w-4 h-4 text-slate-400 mr-1 hidden sm:block" />
            {(
              [
                { id: 'follow', label: 'Exterior' },
                { id: 'cab', label: '3D Cab + Copilot' },
                { id: 'cabin', label: '3D Cabin' },
                { id: 'orbit', label: 'Orbit' },
                { id: 'station', label: 'Station' },
              ] as { id: CameraMode; label: string }[]
            ).map((cam) => (
              <button
                key={cam.id}
                onClick={() => setCameraMode(cam.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  cameraMode === cam.id
                    ? cam.id === 'cabin' || cam.id === 'cab'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30'
                      : 'bg-slate-100 text-slate-900 font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {cam.id === 'cabin' && <Armchair className="w-3.5 h-3.5" />}
                {cam.id === 'cab' && <Gauge className="w-3.5 h-3.5" />}
                {cam.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <button
              onClick={() => {
                setAutoTimeCycle(false);
                setTimeOfDay(10.5);
              }}
              title="Daylight"
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay >= 7 && timeOfDay < 17 ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setAutoTimeCycle(false);
                setTimeOfDay(18.25);
              }}
              title="Evening Golden Sunset"
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay >= 17 && timeOfDay <= 19.5
                  ? 'bg-orange-500/25 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setAutoTimeCycle(false);
                setTimeOfDay(23.0);
              }}
              title="Full Moon Night Mode"
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay > 19.5 || timeOfDay < 6
                  ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                  : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 px-1 hidden 2xl:inline">{formattedTime}</span>
          </div>

          <button
            onClick={() => {
              audioRef.current.init();
              setIsMuted((m) => !m);
            }}
            className={`p-1.5 rounded-xl transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-slate-200 hover:bg-white/15'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Left Sidebar: Detailed Passenger Manifest, Next Station Drop Counter & Spoken Reviews */}
      <aside className="absolute top-20 left-3 z-20 hidden lg:flex flex-col gap-2.5 w-80 pointer-events-none">
        {/* Passenger Manifest & Destination Breakdown Card */}
        <div className="bg-slate-900/88 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{ratingFace.emoji}</span>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Passenger Manifest & Rating
                </div>
                <div className={`text-xs font-bold ${ratingFace.color}`}>{ratingFace.label}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 rounded-xl">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-mono font-extrabold text-amber-300">
                {passengerRating.toFixed(1)}
              </span>
            </div>
          </div>

          {/* 3 Key Manifest Counters: In Cabin, Leaving Next Station, Total Delivered */}
          <div className="grid grid-cols-3 gap-1.5 my-2 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-slate-300 block">In Cabin</span>
              <span className="text-xs font-mono font-extrabold text-emerald-300">
                {onboardPassengers} / {maxSeatsCapacity}
              </span>
            </div>
            <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-amber-200 block">Drop Next Stn</span>
              <span className="text-xs font-mono font-extrabold text-amber-300">
                {droppingNextStationCount} Leaving
              </span>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-slate-300 block">Delivered</span>
              <span className="text-xs font-mono font-extrabold text-blue-300">
                {totalDeliveredPassengers} Pax
              </span>
            </div>
          </div>

          {/* Per-Station Destination Drop & Waiting Breakdown */}
          <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2 space-y-1 text-[11px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex justify-between">
              <span>Station Stop</span>
              <span>Will Drop / Waiting</span>
            </div>
            {STATIONS.map((st) => {
              const isNext =
                (atStationPlatform ? nearestStation.index : nextUpcomingStation.index) === st.index;
              return (
                <div
                  key={st.id}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg ${
                    isNext ? 'bg-blue-600/25 border border-blue-400/30 text-white font-semibold' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                    {st.name.split(' ')[0]} (Trk {st.recommendedTrack})
                  </span>
                  <span className="font-mono text-[10px] shrink-0">
                    <span className="text-amber-300 font-bold">{destinationBreakdown[st.index] ?? 0} Drop</span>
                    {' · '}
                    <span className="text-cyan-300">{stationWaitingCounts[st.index] ?? 0} Wait</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live Spoken Passenger Reviews Feed */}
          <div className="space-y-1.5 mt-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Live Passenger Reviews
            </div>
            {emojiFeed.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/85 border border-white/5 px-2.5 py-1.5 rounded-xl text-[11px]"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <span className="font-bold text-slate-200">
                    {item.emoji} {item.passengerName}
                  </span>
                  <span className="text-cyan-400">{item.routeTag}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300 text-[11px] leading-snug">{item.message}</span>
                  {item.points && (
                    <span
                      className={`font-mono text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                        item.points > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {item.points > 0 ? `+${item.points}` : item.points}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dual-Track Route Radar & Level Crossing Status Card */}
        <div className="bg-slate-900/88 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold tracking-wide text-slate-200">
                Dual-Track & Crossing Radar
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                crossingGateClosed
                  ? 'bg-red-500/25 text-red-300 border border-red-400/30 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {crossingGateClosed ? '🚧 GATE CLOSED (PEDS WAITING)' : '🚧 Crossing Open'}
            </span>
          </div>

          <div className="relative w-full h-28 bg-slate-950/80 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
            <svg viewBox="-900 -750 1800 1500" className="w-full h-full">
              {/* Outer Track A & Inner Track B */}
              <ellipse cx="20" cy="20" rx="680" ry="560" fill="none" stroke="#334155" strokeWidth="42" />
              <ellipse
                cx="20"
                cy="20"
                rx="700"
                ry="580"
                fill="none"
                stroke={!trackSwitchBranch ? '#38bdf8' : '#475569'}
                strokeWidth="14"
              />
              <ellipse
                cx="20"
                cy="20"
                rx="655"
                ry="535"
                fill="none"
                stroke={trackSwitchBranch ? '#22c55e' : '#475569'}
                strokeWidth="14"
                strokeDasharray="30 16"
              />
              {STATIONS.map((st) => {
                const angle = (st.distance / TOTAL_TRACK_LENGTH) * Math.PI * 2 - Math.PI / 2;
                const sx = 20 + Math.cos(angle) * 680;
                const sy = 20 + Math.sin(angle) * 560;
                return (
                  <g key={st.id}>
                    <circle cx={sx} cy={sy} r="46" fill={st.color} />
                    <circle cx={sx} cy={sy} r="20" fill="#ffffff" />
                  </g>
                );
              })}
              {(() => {
                const pAngle = (distanceTraveled / TOTAL_TRACK_LENGTH) * Math.PI * 2 - Math.PI / 2;
                const px = 20 + Math.cos(pAngle) * 680;
                const py = 20 + Math.sin(pAngle) * 560;
                return (
                  <g>
                    <circle cx={px} cy={py} r="78" fill="#3b82f6" fillOpacity="0.35" />
                    <circle cx={px} cy={py} r="44" fill="#60a5fa" stroke="#ffffff" strokeWidth="16" />
                  </g>
                );
              })()}
            </svg>
          </div>

          <div className="mt-1.5 text-[11px] text-emerald-300 font-medium truncate">
            {lastStopBanner || boardingStatus}
          </div>
        </div>
      </aside>

      {/* Bottom Driving Control Desk */}
      <footer className="absolute bottom-3 left-3 right-3 z-20 flex flex-col xl:flex-row items-stretch xl:items-end justify-between gap-3 pointer-events-none">
        {/* Speedometer & Speed Limit Compliance */}
        <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-5 py-3.5 rounded-3xl shadow-2xl pointer-events-auto">
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeDasharray="240 360"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={isOverspeed ? '#ef4444' : '#3b82f6'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(240, (speedKmh / activeSpec.maxSpeed) * 240)} 360`}
                className="transition-all duration-100"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-extrabold font-mono tracking-tight ${
                  isOverspeed ? 'text-red-400 animate-pulse' : 'text-white'
                }`}
              >
                {Math.round(speedKmh)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">km/h</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pr-2 border-r border-white/10">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-11 h-11 rounded-full border-4 flex flex-col items-center justify-center font-mono font-bold shadow-md ${
                  isOverspeed
                    ? 'border-red-500 bg-red-500/20 text-red-200 animate-bounce'
                    : 'border-red-500 bg-white text-slate-900'
                }`}
              >
                <span className="text-xs leading-none">{currentSpeedLimit}</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Zone Limit</div>
                <div className={`text-xs font-bold ${isOverspeed ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isOverspeed ? 'OVERSPEED!' : currentZoneLabel.split(' ')[0]}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-white/5 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] text-slate-400 block">Grade</span>
                <span className="font-mono font-semibold text-slate-200">
                  {gradePercent > 0 ? `+${gradePercent}%` : `${gradePercent}%`}
                </span>
              </div>
              <div className="bg-white/5 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] text-slate-400 block">G-Force</span>
                <span className="font-mono font-semibold text-slate-200">{gForce} G</span>
              </div>
            </div>
          </div>

          {/* Reverser Lever */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Reverser</span>
            <div className="flex flex-col bg-slate-950 p-1 rounded-2xl border border-white/10 gap-1">
              {(['F', 'N', 'R'] as ReverserState[]).map((dir) => (
                <button
                  key={dir}
                  onClick={() => {
                    audioRef.current.init();
                    if (speedKmh < 5) setReverser(dir);
                  }}
                  className={`w-9 h-7 rounded-xl text-xs font-bold transition-all ${
                    reverser === dir
                      ? dir === 'F'
                        ? 'bg-emerald-600 text-white shadow'
                        : dir === 'R'
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Throttle, Service Brake & Single-Level Action Matrix */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-5 py-3.5 rounded-3xl shadow-2xl pointer-events-auto flex-1 max-w-4xl">
          <div className="flex items-center gap-5 flex-1 min-w-[260px]">
            {/* Throttle Slider */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <ChevronUp className="w-3.5 h-3.5" /> Throttle (W)
                </span>
                <span className="text-xs font-mono font-bold text-white bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  {throttle}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={throttle}
                disabled={emergencyStop || doorsOpen}
                onChange={(e) => {
                  audioRef.current.init();
                  const val = Number(e.target.value);
                  setThrottle(val);
                  if (val > 5 && brake > 0) setBrake(0);
                }}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Idle</span>
                <span>50%</span>
                <span>Max Traction</span>
              </div>
            </div>

            {/* Service Brake Slider */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <ChevronDown className="w-3.5 h-3.5" /> Brake (S)
                </span>
                <span className="text-xs font-mono font-bold text-white bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  {brake}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={brake}
                onChange={(e) => {
                  audioRef.current.init();
                  const val = Number(e.target.value);
                  setBrake(val);
                  if (val > 10) setThrottle(0);
                }}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Release</span>
                <span>Service</span>
                <span>Full Brake</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Doors Toggle */}
            <button
              onClick={handleToggleDoors}
              className={`flex flex-col items-center justify-center px-3 h-14 rounded-2xl border transition-all ${
                doorsOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg shadow-emerald-500/30'
                  : atStationPlatform
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
              title="Open / Close Passenger Doors (Key: D)"
            >
              {doorsOpen ? <DoorOpen className="w-5 h-5 mb-0.5" /> : <DoorClosed className="w-5 h-5 mb-0.5" />}
              <span className="text-[10px] font-bold">{doorsOpen ? 'CLOSE (D)' : 'DOORS (D)'}</span>
            </button>

            {/* Dual-Track Switcher (Track A Left vs Track B Right) */}
            <button
              onClick={() => {
                audioRef.current.init();
                setTrackSwitchBranch((s) => !s);
              }}
              className={`flex flex-col items-center justify-center px-3 h-14 rounded-2xl border transition-all ${
                trackSwitchBranch
                  ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-md shadow-emerald-500/20'
                  : 'bg-blue-500/25 border-blue-400/60 text-blue-200 shadow-md shadow-blue-500/20'
              }`}
              title="Switch Separated Track Path: Track A (Left Platform) vs Track B (Right Platform) (Key: G)"
            >
              <GitFork className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">{trackSwitchBranch ? 'TRACK B (G)' : 'TRACK A (G)'}</span>
            </button>

            {/* 3D Cab & Cabin View Toggle */}
            <button
              onClick={() =>
                setCameraMode((m) => (m === 'cab' ? 'cabin' : m === 'cabin' ? 'follow' : 'cab'))
              }
              className={`flex flex-col items-center justify-center px-3 h-14 rounded-2xl border transition-all ${
                cameraMode === 'cabin' || cameraMode === 'cab'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
              title="Cycle 3D Driver Cab (with Copilot) & 3D Passenger Cabin (Key: V)"
            >
              <Armchair className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">
                {cameraMode === 'cab' ? '3D CAB' : cameraMode === 'cabin' ? '3D CABIN' : 'CAB/CABIN'}
              </span>
            </button>

            {/* Air Horn */}
            <button
              onMouseDown={triggerHorn}
              className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 hover:bg-blue-600/35 active:scale-95 border border-blue-500/30 text-blue-300 transition-all"
              title="Sound Air Horn (Key: H)"
            >
              <Volume2 className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">HORN</span>
            </button>

            {/* Volumetric High-Beams */}
            <button
              onClick={() => setHeadlights((h) => !h)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border transition-all ${
                headlights
                  ? 'bg-yellow-400/25 border-yellow-400/50 text-yellow-200 shadow-md shadow-yellow-500/15'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
              }`}
              title="Toggle Volumetric Headlights (Key: L)"
            >
              <Lightbulb className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">BEAMS</span>
            </button>

            {/* Autopilot */}
            <button
              onClick={() => {
                audioRef.current.init();
                setAutopilot((a) => !a);
              }}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border transition-all ${
                autopilot
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg shadow-cyan-500/25'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">AUTO</span>
            </button>

            {/* Emergency Stop */}
            <button
              onClick={handleEmergencyStop}
              className={`flex flex-col items-center justify-center px-3 h-14 rounded-2xl border font-bold transition-all ${
                emergencyStop
                  ? 'bg-red-600 text-white border-red-300 shadow-xl shadow-red-600/50 animate-pulse'
                  : 'bg-red-500/20 hover:bg-red-500/35 border-red-500/40 text-red-300'
              }`}
            >
              <AlertOctagon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-wider">{emergencyStop ? 'RESET' : 'E-STOP'}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}