import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { COLORS } from "../../config/theme";
import { clamp, EASE, lerp, prog, rnd, TAU } from "../../lib/anim";

// ───────────── Shot: a lit 3D sphere dissolves into particles that re-form as a logo ─────────────
const N = 3600;

/** Target shape: an abstract 8-ray spark, sampled as points. */
const sparkPoint = (i: number): [number, number, number] => {
  const ray = i % 8;
  const long = ray % 2 === 0;
  const a = (ray / 8) * TAU + Math.PI / 8;
  const t = Math.pow(rnd(`st${i}`), 0.75);
  const len = (long ? 2.25 : 1.35) * t + 0.12;
  const thick = (1 - t) * (long ? 0.2 : 0.15) + 0.018;
  const off = (rnd(`so${i}`) - 0.5) * 2 * thick;
  return [Math.cos(a) * len - Math.sin(a) * off, Math.sin(a) * len + Math.cos(a) * off, (rnd(`sz${i}`) - 0.5) * 0.14];
};

const SphereToLogo: React.FC<{ frame: number }> = ({ frame }) => {
  const { from, to, delay, colors } = useMemo(() => {
    const from = new Float32Array(N * 3);
    const to = new Float32Array(N * 3);
    const delay = new Float32Array(N);
    const colors = new Float32Array(N * 3);
    const v = new THREE.Color(COLORS.violet);
    const b = new THREE.Color(COLORS.blue);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      from.set([Math.cos(th) * r * 1.5, y * 1.5, Math.sin(th) * r * 1.5], i * 3);
      to.set(sparkPoint(i), i * 3);
      delay[i] = rnd(`sd${i}`) * 0.45;
      const c = v.clone().lerp(b, rnd(`sc${i}`)).lerp(new THREE.Color("#ffffff"), rnd(`sw${i}`) * 0.35);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { from, to, delay, colors };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [colors]);

  const morph = prog(frame, 24, 56, EASE.linear);
  const pos = geo.attributes.position.array as Float32Array;
  for (let i = 0; i < N; i++) {
    const k = EASE.inOut(clamp((morph - delay[i]) / 0.55));
    const swirl = Math.sin(k * Math.PI);
    for (let a = 0; a < 3; a++) {
      const wobble = swirl * (rnd(`n${i}${a}`) - 0.5) * 2.4;
      pos[i * 3 + a] = lerp(from[i * 3 + a], to[i * 3 + a], k) * (1 + swirl * 0.35) + wobble;
    }
  }
  geo.attributes.position.needsUpdate = true;

  const solid = 1 - prog(frame, 18, 34, EASE.inOut);
  const spin = lerp(frame * 0.045, 0, prog(frame, 24, 56, EASE.inOut));
  const settle = prog(frame, 50, 70, EASE.out);
  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 3, 5]} intensity={90} color={COLORS.blue} />
      <pointLight position={[-5, -2, 3]} intensity={120} color={COLORS.violet} />
      <pointLight position={[0, 4, -4]} intensity={60} color="#ffffff" />
      <group rotation={[0.25 * (1 - settle), spin, 0]} scale={1 + settle * 0.08 + Math.sin(frame / 9) * 0.012}>
        {solid > 0.01 ? (
          <mesh scale={solid * 1.48}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial color="#1a0f3a" metalness={0.85} roughness={0.22} emissive={COLORS.violet} emissiveIntensity={0.18} />
          </mesh>
        ) : null}
        <points geometry={geo}>
          <pointsMaterial size={0.05} vertexColors transparent opacity={prog(frame, 10, 26)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
      </group>
    </>
  );
};

export const SphereLogoShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const glow = prog(frame, 48, 66, EASE.out);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(40% 55% at 50% 46%, ${COLORS.violet}55, transparent 70%)`, opacity: 0.5 + glow * 0.5 }} />
      <AbsoluteFill style={{ transform: `translateY(-40px) scale(${1.02 + frame * 0.0012})`, filter: `drop-shadow(0 0 ${glow * 26}px ${COLORS.violetSoft})` }}>
        <ThreeCanvas width={width} height={height} camera={{ fov: 40, position: [0, 0, 8.2] }}>
          <SphereToLogo frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────── Shot: 3D relief map with glowing regions ─────────────
const height = (x: number, z: number) =>
  Math.sin(x * 0.55) * Math.cos(z * 0.45) * 0.55 + Math.sin(x * 1.3 + z * 0.9) * 0.22 + Math.cos(z * 1.7 - x * 0.4) * 0.16;

const SPOTS: [number, number][] = [[-3.2, -0.6], [0.4, 1.4], [3.4, -1.2], [1.2, -2.6], [-1.6, 2.2]];

const MapWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const terrain = useMemo(() => {
    const g = new THREE.PlaneGeometry(16, 11, 80, 55);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const arcs = useMemo(
    () =>
      SPOTS.slice(1).map(([x, z], i) => {
        const [x0, z0] = SPOTS[i];
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 40; k++) {
          const t = k / 40;
          pts.push(new THREE.Vector3(lerp(x0, x, t), lerp(height(x0, z0), height(x, z), t) + Math.sin(t * Math.PI) * 1.5 + 0.1, lerp(z0, z, t)));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );
  arcs.forEach((g, i) => g.setDrawRange(0, Math.round(41 * prog(frame, 16 + i * 9, 34 + i * 9, EASE.inOut))));

  const rise = prog(frame, 0, 26, EASE.out);
  return (
    <>
      <fog attach="fog" args={[COLORS.bg, 9, 21]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 2]} intensity={1.6} color={COLORS.violetSoft} />
      <group rotation={[0, -0.5 + frame * 0.0065, 0]} scale={[1, rise, 1]}>
        <mesh geometry={terrain}>
          <meshStandardMaterial color="#0c0722" metalness={0.5} roughness={0.55} flatShading />
        </mesh>
        <mesh geometry={terrain} position={[0, 0.012, 0]}>
          <meshBasicMaterial color={COLORS.blueDeep} wireframe transparent opacity={0.55} />
        </mesh>
        {SPOTS.map(([x, z], i) => {
          const on = prog(frame, 10 + i * 9, 26 + i * 9, EASE.out);
          const y = height(x, z);
          const c = i % 2 ? COLORS.blue : COLORS.violetSoft;
          const ring = ((frame + i * 9) % 34) / 34;
          return (
            <group key={i} position={[x, y + 0.03, z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} scale={on}>
                <circleGeometry args={[0.85, 40]} />
                <meshBasicMaterial color={c} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} scale={0.3 + ring * 1.5}>
                <ringGeometry args={[0.92, 1, 48]} />
                <meshBasicMaterial color={c} transparent opacity={(1 - ring) * on} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
              <mesh position={[0, on * 1.1, 0]} scale={[1, Math.max(0.001, on), 1]}>
                <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, on * 2.25, 0]} scale={on * (1 + 0.15 * Math.sin(frame / 4 + i))}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color={c} />
              </mesh>
            </group>
          );
        })}
        {arcs.map((g, i) => (
          <primitive key={i} object={new THREE.Line(g, new THREE.LineBasicMaterial({ color: i % 2 ? COLORS.violetSoft : COLORS.blue }))} />
        ))}
      </group>
    </>
  );
};

export const MapShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height: h } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 50% 60%, ${COLORS.blueDeep}44, transparent 70%)` }} />
      <AbsoluteFill style={{ transform: `translateY(-30px) scale(${1 + frame * 0.0016})` }}>
        <ThreeCanvas width={width} height={h} camera={{ fov: 38, position: [0, 6.4, 10.5] }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}>
          <MapWorld frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
