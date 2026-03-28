"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";

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

  const float delta = 1.0;

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

    pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
    pVel += delta * (-2.0 * pressure + p_up + p_down) / 4.0;
    pressure += delta * pVel;
    pVel -= 0.009 * delta * pressure;
    pVel *= 1.0 - 0.004 * delta;
    pressure *= 0.998;

    if (uMouse.z > 0.0) {
      float dist = distance(fragCoord, uMouse.xy);
      if (dist <= 60.0) {
        pressure += 1.5 * (1.0 - dist / 60.0);
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

  void main() {
    vec4 data = texture2D(uTexture, vUv);

    vec2 displacedUv = vUv + 0.2 * data.zw;

    vec4 color = texture2D(uBackground, displacedUv);

    vec3 normal = normalize(vec3(-data.z, 0.2, -data.w));
    float specular = pow(max(0.0, dot(normal, normalize(vec3(-3.0, 10.0, 3.0)))), 60.0);
    color += vec4(1.0) * specular * 0.5;

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
  const { viewport, gl, size } = useThree();

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
    const srcs = ["/1.png", "/2.png", "/3.png"];
    Promise.all(
      srcs.map(
        (src) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = src;
          })
      )
    ).then((images) => {
      drawCards(bgCanvas, bgCanvas.width, bgCanvas.height, images);
      backgroundTexture.needsUpdate = true;
    });
  }, [bgCanvas, backgroundTexture]);

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

    frameId.current++;
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
            uniforms={{
              uTexture: { value: null },
              uResolution: { value: new THREE.Vector2() },
              uMouse: { value: new THREE.Vector3() },
              uFrame: { value: 0 },
            }}
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
          uniforms={{
            uTexture: { value: null },
            uBackground: { value: backgroundTexture },
            uResolution: { value: new THREE.Vector2() },
          }}
        />
      </mesh>
    </>
  );
}
