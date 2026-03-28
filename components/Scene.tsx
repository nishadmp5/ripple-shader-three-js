"use client";

import { Canvas } from "@react-three/fiber";
import { Component, Suspense, type ReactNode } from "react";
import RippleEffect from "./RippleEffect";

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="absolute inset-0 w-full h-full bg-black" />;
    }
    return this.props.children;
  }
}

export default function Scene() {
  return (
    <WebGLErrorBoundary>
      <div className="absolute inset-0 w-full h-full bg-black">
        <Canvas dpr={[1, 2]}>
          <Suspense fallback={null}>
            <RippleEffect />
          </Suspense>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
