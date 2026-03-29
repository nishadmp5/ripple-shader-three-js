/**
 * Tunable constants for the water ripple effect.
 *
 * --- Simulation (wave physics) ---
 */

/** Simulation time-step multiplier. Higher = faster wave propagation per frame. */
export const SIM_DELTA = 1.0;

/** Divisor in the discrete Laplacian — controls wave propagation speed.
 *  Lower values = faster waves. */
export const WAVE_SPEED_DIVISOR = 4.0;

/** Spring-back coefficient — pulls pressure back toward zero.
 *  Higher = ripples contract/bounce more aggressively. */
export const PRESSURE_SPRING = 0.009;

/** Velocity damping per frame — bleeds kinetic energy.
 *  Higher = ripples die out faster. */
export const VELOCITY_DAMPING = 0.004;

/** Pressure decay multiplier applied every frame (< 1.0).
 *  Lower = ripples fade more quickly. */
export const PRESSURE_DECAY = 0.998;

/**
 * --- Mouse interaction ---
 */

/** Radius (in pixels) of the ripple created by the pointer. */
export const MOUSE_RADIUS = 60.0;

/** Peak pressure injected at the pointer centre. */
export const MOUSE_STRENGTH = 1.5;

/**
 * --- Rendering / visual ---
 */

/** How much the ripple normals displace the background UV (refraction strength).
 *  Higher = more dramatic lens-like distortion. */
export const REFRACTION_STRENGTH = 0.2;

/** Normal Y component — controls perceived surface flatness.
 *  Higher = flatter surface, subtler highlights. */
export const NORMAL_FLATNESS = 0.2;

/** Light direction (x, y, z) for the specular highlight. */
export const LIGHT_DIR: [number, number, number] = [-3.0, 10.0, 3.0];

/** Specular exponent (shininess). Higher = tighter, sharper highlight. */
export const SPECULAR_POWER = 60.0;

/** Specular intensity multiplier. Higher = brighter glint. */
export const SPECULAR_INTENSITY = 0.5;
