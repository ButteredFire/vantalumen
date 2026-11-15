import type { VehicleInputState } from './RoverController';

/**
 * Shared input bridge uniting keyboard (W/S/A/D/Arrows, Space brake/climb, Q/E/F altitude),
 * HUD mobile virtual joystick buttons, and lifecycle safety release handlers.
 */
class SurfaceInputBridge {
  private readonly keys = new Set<string>();
  private virtualThrottle = 0;
  private virtualSteer = 0;
  private virtualBrake = false;
  private virtualAscend = 0;

  public setKeyDown(code: string): void {
    this.keys.add(code);
  }

  public setKeyUp(code: string): void {
    this.keys.delete(code);
  }

  public setVirtualJoystick(throttle: number, steer: number): void {
    this.virtualThrottle = Math.max(-1, Math.min(1, throttle));
    this.virtualSteer = Math.max(-1, Math.min(1, steer));
  }

  public setVirtualBrake(active: boolean): void {
    this.virtualBrake = active;
  }

  public setVirtualAscend(val: number): void {
    this.virtualAscend = Math.max(-1, Math.min(1, val));
  }

  public releaseAll(): void {
    this.keys.clear();
    this.virtualThrottle = 0;
    this.virtualSteer = 0;
    this.virtualBrake = false;
    this.virtualAscend = 0;
  }

  public isActive(): boolean {
    return (
      this.keys.size > 0 ||
      Math.abs(this.virtualThrottle) > 0.01 ||
      Math.abs(this.virtualSteer) > 0.01 ||
      this.virtualBrake ||
      Math.abs(this.virtualAscend) > 0.01
    );
  }

  public sample(isHelicopter: boolean): VehicleInputState {
    let keyThrottle = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) keyThrottle += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) keyThrottle -= 1;

    let keySteer = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) keySteer += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) keySteer -= 1;

    let keyAscend = 0;
    if (isHelicopter) {
      if (this.keys.has('Space') || this.keys.has('KeyE')) keyAscend += 1;
      if (this.keys.has('KeyQ') || this.keys.has('KeyF')) keyAscend -= 1;
    }

    const brake = (!isHelicopter && this.keys.has('Space')) || this.virtualBrake;

    return {
      throttle: Math.max(-1, Math.min(1, keyThrottle + this.virtualThrottle)),
      steer: Math.max(-1, Math.min(1, keySteer + this.virtualSteer)),
      brake,
      ascend: Math.max(-1, Math.min(1, keyAscend + this.virtualAscend)),
    };
  }
}

export const surfaceInputBridge = new SurfaceInputBridge();
