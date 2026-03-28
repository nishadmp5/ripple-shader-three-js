"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import RippleEffect from "./RippleEffect";

export default function Scene() {
  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <Canvas dpr={[1, 2]}>
        <Suspense fallback={null}>
          <RippleEffect />
        </Suspense>
      </Canvas>
    </div>
  );
}
