"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { useControls, button } from "leva";
import {
  SIM_DELTA,
  WAVE_SPEED_DIVISOR,
  PRESSURE_SPRING,
  VELOCITY_DAMPING,
  PRESSURE_DECAY,
  MOUSE_RADIUS,
  MOUSE_STRENGTH,
  REFRACTION_STRENGTH,
  NORMAL_FLATNESS,
  LIGHT_DIR,
  SPECULAR_POWER,
  SPECULAR_INTENSITY,
} from "../constants/ripple";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const simulationFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec3 uMouse;
  uniform int uFrame;
  uniform float uDelta;
  uniform float uWaveSpeedDiv;
  uniform float uPressureSpring;
  uniform float uVelocityDamping;
  uniform float uPressureDecay;
  uniform float uMouseRadius;
  uniform float uMouseStrength;

  void main() {
    if (uFrame == 0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 fragCoord = vUv * uResolution;
    vec2 texel = 1.0 / uResolution;

    float pressure = texture2D(uTexture, vUv).x;
    float pVel = texture2D(uTexture, vUv).y;

    float p_right = texture2D(uTexture, vUv + vec2(texel.x, 0.0)).x;
    float p_left  = texture2D(uTexture, vUv + vec2(-texel.x, 0.0)).x;
    float p_up    = texture2D(uTexture, vUv + vec2(0.0, texel.y)).x;
    float p_down  = texture2D(uTexture, vUv + vec2(0.0, -texel.y)).x;

    if (vUv.x <= texel.x) p_left = p_right;
    if (vUv.x >= 1.0 - texel.x) p_right = p_left;
    if (vUv.y <= texel.y) p_down = p_up;
    if (vUv.y >= 1.0 - texel.y) p_up = p_down;

    pVel += uDelta * (-2.0 * pressure + p_right + p_left) / uWaveSpeedDiv;
    pVel += uDelta * (-2.0 * pressure + p_up + p_down) / uWaveSpeedDiv;
    pressure += uDelta * pVel;
    pVel -= uPressureSpring * uDelta * pressure;
    pVel *= 1.0 - uVelocityDamping * uDelta;
    pressure *= uPressureDecay;

    if (uMouse.z > 0.0) {
      float dist = distance(fragCoord, uMouse.xy);
      if (dist <= uMouseRadius) {
        pressure += uMouseStrength * (1.0 - dist / uMouseRadius);
      }
    }

    gl_FragColor = vec4(pressure, pVel, (p_right - p_left) / 2.0, (p_up - p_down) / 2.0);
  }
`;

const renderFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform sampler2D uBackground;
  uniform vec2 uResolution;
  uniform float uRefractionStrength;
  uniform float uNormalFlatness;
  uniform vec3 uLightDir;
  uniform float uSpecularPower;
  uniform float uSpecularIntensity;

  void main() {
    vec4 data = texture2D(uTexture, vUv);

    vec2 displacedUv = vUv + uRefractionStrength * data.zw;

    vec4 color = texture2D(uBackground, displacedUv);

    vec3 normal = normalize(vec3(-data.z, uNormalFlatness, -data.w));
    float specular = pow(max(0.0, dot(normal, normalize(uLightDir))), uSpecularPower);
    color += vec4(1.0) * specular * uSpecularIntensity;

    gl_FragColor = color;
  }
`;

function drawCards(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  images: HTMLImageElement[]
) {
  const ctx = canvas.getContext("2d")!;

  // Black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Card layout
  const cardWidth = Math.round(width * 0.22);
  const cardHeight = Math.round(height * 0.55);
  const gap = Math.round(width * 0.03);
  const totalWidth = cardWidth * 3 + gap * 2;
  const startX = (width - totalWidth) / 2;
  const startY = (height - cardHeight) / 2;
  const radius = 20;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (cardWidth + gap);
    const y = startY;

    // Card shadow
    ctx.shadowColor = "rgba(255, 255, 255, 0.08)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // White card
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, radius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw image covering the card with rounded corners
    const img = images[i];
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, radius);
      ctx.clip();

      // Cover fit
      const imgRatio = img.width / img.height;
      const cardRatio = cardWidth / cardHeight;
      let drawW, drawH, drawX, drawY;
      if (imgRatio > cardRatio) {
        drawH = cardHeight;
        drawW = cardHeight * imgRatio;
        drawX = x - (drawW - cardWidth) / 2;
        drawY = y;
      } else {
        drawW = cardWidth;
        drawH = cardWidth / imgRatio;
        drawX = x;
        drawY = y - (drawH - cardHeight) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
  }
}

export default function RippleEffect() {
  const { gl, size } = useThree();

  const sim = useControls("Simulation", {
    delta: { value: SIM_DELTA, min: 0.1, max: 5.0, step: 0.1 },
    waveSpeedDivisor: { value: WAVE_SPEED_DIVISOR, min: 1.0, max: 20.0, step: 0.5 },
    pressureSpring: { value: PRESSURE_SPRING, min: 0.0, max: 0.1, step: 0.001 },
    velocityDamping: { value: VELOCITY_DAMPING, min: 0.0, max: 0.05, step: 0.001 },
    pressureDecay: { value: PRESSURE_DECAY, min: 0.9, max: 1.0, step: 0.001 },
  });

  const mouse = useControls("Mouse", {
    radius: { value: MOUSE_RADIUS, min: 5, max: 200, step: 1 },
    strength: { value: MOUSE_STRENGTH, min: 0.1, max: 10.0, step: 0.1 },
  });

  const render = useControls("Rendering", {
    refractionStrength: { value: REFRACTION_STRENGTH, min: 0.0, max: 1.0, step: 0.01 },
    normalFlatness: { value: NORMAL_FLATNESS, min: 0.01, max: 2.0, step: 0.01 },
    lightX: { value: LIGHT_DIR[0], min: -20, max: 20, step: 0.5 },
    lightY: { value: LIGHT_DIR[1], min: -20, max: 20, step: 0.5 },
    lightZ: { value: LIGHT_DIR[2], min: -20, max: 20, step: 0.5 },
    specularPower: { value: SPECULAR_POWER, min: 1, max: 200, step: 1 },
    specularIntensity: { value: SPECULAR_INTENSITY, min: 0.0, max: 2.0, step: 0.05 },
  });

  useControls("Save", {
    saveAsDefaults: button(() => {
      fetch("/api/save-constants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simDelta: sim.delta,
          waveSpeedDivisor: sim.waveSpeedDivisor,
          pressureSpring: sim.pressureSpring,
          velocityDamping: sim.velocityDamping,
          pressureDecay: sim.pressureDecay,
          mouseRadius: mouse.radius,
          mouseStrength: mouse.strength,
          refractionStrength: render.refractionStrength,
          normalFlatness: render.normalFlatness,
          lightX: render.lightX,
          lightY: render.lightY,
          lightZ: render.lightZ,
          specularPower: render.specularPower,
          specularIntensity: render.specularIntensity,
        }),
      });
    }),
  });

  const bgCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size.width * 2;
    canvas.height = size.height * 2;
    // Start with black
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }, [size.width, size.height]);

  const backgroundTexture = useMemo(
    () => new THREE.CanvasTexture(bgCanvas),
    [bgCanvas]
  );

  // Load card images and redraw
  useEffect(() => {
    let cancelled = false;
    const srcs = ["/1.png", "/2.png", "/3.png"];
    Promise.all(
      srcs.map(
        (src) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = src;
          })
      )
    ).then((images) => {
      if (cancelled) return;
      drawCards(bgCanvas, bgCanvas.width, bgCanvas.height, images);
      backgroundTexture.needsUpdate = true;
    });
    return () => {
      cancelled = true;
    };
  }, [bgCanvas, backgroundTexture]);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      backgroundTexture.dispose();
    };
  }, [backgroundTexture]);

  const fboA = useFBO(size.width, size.height, { type: THREE.HalfFloatType });
  const fboB = useFBO(size.width, size.height, { type: THREE.HalfFloatType });

  const simMatRef = useRef<THREE.ShaderMaterial>(null);
  const renderMatRef = useRef<THREE.ShaderMaterial>(null);

  const [scene] = useState(() => new THREE.Scene());
  const [camera] = useState(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  );

  const frameId = useRef(0);
  const pointerState = useRef(new THREE.Vector3(0, 0, 0));
  const pointerActive = useRef(false);

  const simUniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
      uResolution: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector3() },
      uFrame: { value: 0 },
      uDelta: { value: SIM_DELTA },
      uWaveSpeedDiv: { value: WAVE_SPEED_DIVISOR },
      uPressureSpring: { value: PRESSURE_SPRING },
      uVelocityDamping: { value: VELOCITY_DAMPING },
      uPressureDecay: { value: PRESSURE_DECAY },
      uMouseRadius: { value: MOUSE_RADIUS },
      uMouseStrength: { value: MOUSE_STRENGTH },
    }),
    []
  );

  const renderUniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
      uBackground: { value: backgroundTexture },
      uResolution: { value: new THREE.Vector2() },
      uRefractionStrength: { value: REFRACTION_STRENGTH },
      uNormalFlatness: { value: NORMAL_FLATNESS },
      uLightDir: { value: new THREE.Vector3(...LIGHT_DIR) },
      uSpecularPower: { value: SPECULAR_POWER },
      uSpecularIntensity: { value: SPECULAR_INTENSITY },
    }),
    [backgroundTexture]
  );

  // Native DOM pointer tracking for accuracy
  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerState.current.x =
        ((e.clientX - rect.left) / rect.width) * size.width;
      pointerState.current.y =
        (1.0 - (e.clientY - rect.top) / rect.height) * size.height;
      pointerActive.current = true;
    };

    const handlePointerLeave = () => {
      pointerActive.current = false;
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [gl, size]);

  useFrame(() => {
    if (!simMatRef.current || !renderMatRef.current) return;

    const simMat = simMatRef.current;

    // Push leva values into simulation uniforms
    simMat.uniforms.uDelta.value = sim.delta;
    simMat.uniforms.uWaveSpeedDiv.value = sim.waveSpeedDivisor;
    simMat.uniforms.uPressureSpring.value = sim.pressureSpring;
    simMat.uniforms.uVelocityDamping.value = sim.velocityDamping;
    simMat.uniforms.uPressureDecay.value = sim.pressureDecay;
    simMat.uniforms.uMouseRadius.value = mouse.radius;
    simMat.uniforms.uMouseStrength.value = mouse.strength;

    // Push leva values into render uniforms
    renderMatRef.current.uniforms.uRefractionStrength.value = render.refractionStrength;
    renderMatRef.current.uniforms.uNormalFlatness.value = render.normalFlatness;
    renderMatRef.current.uniforms.uLightDir.value.set(render.lightX, render.lightY, render.lightZ);
    renderMatRef.current.uniforms.uSpecularPower.value = render.specularPower;
    renderMatRef.current.uniforms.uSpecularIntensity.value = render.specularIntensity;

    simMat.uniforms.uFrame.value = frameId.current;
    simMat.uniforms.uResolution.value.set(size.width, size.height);

    pointerState.current.z = pointerActive.current ? 1.0 : 0.0;
    simMat.uniforms.uMouse.value.copy(pointerState.current);
    // Reset after each frame so ripple only triggers on actual movement
    pointerActive.current = false;

    // Ping pong FBOs
    const sourceFBO = frameId.current % 2 === 0 ? fboA : fboB;
    const destFBO = frameId.current % 2 === 0 ? fboB : fboA;

    simMat.uniforms.uTexture.value = sourceFBO.texture;

    gl.setRenderTarget(destFBO);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    renderMatRef.current.uniforms.uTexture.value = destFBO.texture;
    renderMatRef.current.uniforms.uResolution.value.set(
      size.width,
      size.height
    );

    // Prevent integer overflow on long sessions; reset after first frame
    if (frameId.current > 1_000_000) frameId.current = 2;
    else frameId.current++;
  });

  return (
    <>
      {createPortal(
        <mesh>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={simMatRef}
            vertexShader={vertexShader}
            fragmentShader={simulationFragmentShader}
            uniforms={simUniforms}
          />
        </mesh>,
        scene
      )}

      <mesh>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={renderMatRef}
          vertexShader={vertexShader}
          fragmentShader={renderFragmentShader}
          uniforms={renderUniforms}
        />
      </mesh>
    </>
  );
}
