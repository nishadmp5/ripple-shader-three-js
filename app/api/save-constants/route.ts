import { writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const values = await request.json();

  const content = `/**
 * Tunable constants for the water ripple effect.
 *
 * --- Simulation (wave physics) ---
 */

/** Simulation time-step multiplier. Higher = faster wave propagation per frame. */
export const SIM_DELTA = ${values.simDelta};

/** Divisor in the discrete Laplacian — controls wave propagation speed.
 *  Lower values = faster waves. */
export const WAVE_SPEED_DIVISOR = ${values.waveSpeedDivisor};

/** Spring-back coefficient — pulls pressure back toward zero.
 *  Higher = ripples contract/bounce more aggressively. */
export const PRESSURE_SPRING = ${values.pressureSpring};

/** Velocity damping per frame — bleeds kinetic energy.
 *  Higher = ripples die out faster. */
export const VELOCITY_DAMPING = ${values.velocityDamping};

/** Pressure decay multiplier applied every frame (< 1.0).
 *  Lower = ripples fade more quickly. */
export const PRESSURE_DECAY = ${values.pressureDecay};

/**
 * --- Mouse interaction ---
 */

/** Radius (in pixels) of the ripple created by the pointer. */
export const MOUSE_RADIUS = ${values.mouseRadius};

/** Peak pressure injected at the pointer centre. */
export const MOUSE_STRENGTH = ${values.mouseStrength};

/**
 * --- Rendering / visual ---
 */

/** How much the ripple normals displace the background UV (refraction strength).
 *  Higher = more dramatic lens-like distortion. */
export const REFRACTION_STRENGTH = ${values.refractionStrength};

/** Normal Y component — controls perceived surface flatness.
 *  Higher = flatter surface, subtler highlights. */
export const NORMAL_FLATNESS = ${values.normalFlatness};

/** Light direction (x, y, z) for the specular highlight. */
export const LIGHT_DIR: [number, number, number] = [${values.lightX}, ${values.lightY}, ${values.lightZ}];

/** Specular exponent (shininess). Higher = tighter, sharper highlight. */
export const SPECULAR_POWER = ${values.specularPower};

/** Specular intensity multiplier. Higher = brighter glint. */
export const SPECULAR_INTENSITY = ${values.specularIntensity};
`;

  const filePath = join(process.cwd(), "constants", "ripple.ts");
  await writeFile(filePath, content, "utf-8");

  return Response.json({ ok: true });
}
