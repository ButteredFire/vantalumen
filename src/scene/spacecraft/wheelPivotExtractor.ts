import * as THREE from 'three';
import type { WheelRuntimeSample } from '../simulation/RoverController';

export interface ExtractedWheelPivot {
  sampleIndex: number;
  steerGroup: THREE.Group;
  spinGroup: THREE.Group;
  restLocalPos: THREE.Vector3;
}

export interface PartitionedRoverRig {
  wheelPivots: ExtractedWheelPivot[];
  createdGeometries: THREE.BufferGeometry[];
}

/**
 * Splits wheel triangles from a scaled, ground-aligned rover GLB into 4 or 6 independent
 * steering + rolling pivot groups at runtime without mutating validated GLB files on disk.
 * Triangles outside wheel envelopes remain stationary in the chassis geometry.
 */
export function partitionRoverWheelsIntoPivots(
  modelRoot: THREE.Object3D,
  wheelAnchors: Array<{
    sampleIndex: number;
    localX: number;
    localZ: number;
    wheelRadiusM: number;
    wheelWidthM: number;
  }>,
  onlyNodeNameIncludes?: string,
): PartitionedRoverRig {
  const wheelPivots: ExtractedWheelPivot[] = [];
  const createdGeometries: THREE.BufferGeometry[] = [];
  if (wheelAnchors.length === 0) {
    return { wheelPivots, createdGeometries };
  }

  modelRoot.updateMatrixWorld(true);
  const rootInverse = modelRoot.matrixWorld.clone().invert();

  // Group extracted geometry primitives by anchor index
  const buckets = wheelAnchors.map((anchor) => ({
    anchor,
    centerY: anchor.wheelRadiusM,
    meshes: [] as Array<{
      positions: number[];
      normals: number[];
      uvs: number[];
      material: THREE.Material | THREE.Material[];
      hasNormals: boolean;
      hasUvs: boolean;
    }>,
  }));

  const targetMeshes: THREE.Mesh[] = [];
  modelRoot.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (onlyNodeNameIncludes) {
      let cursor: THREE.Object3D | null = obj;
      let matched = false;
      while (cursor && cursor !== modelRoot) {
        if (cursor.name.toLowerCase().includes(onlyNodeNameIncludes.toLowerCase())) {
          matched = true;
          break;
        }
        cursor = cursor.parent;
      }
      if (!matched) return;
    }
    targetMeshes.push(obj);
  });

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  for (const mesh of targetMeshes) {
    const geom = mesh.geometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) continue;
    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');

    // Compute transform from mesh local -> modelRoot local
    const meshToRoot = rootInverse.clone().multiply(mesh.matrixWorld);
    const rootToMesh = meshToRoot.clone().invert();
    normalMat.getNormalMatrix(meshToRoot);

    const indexAttr = geom.getIndex();
    const triCount = indexAttr ? Math.floor(indexAttr.count / 3) : Math.floor(posAttr.count / 3);
    if (triCount === 0) continue;

    // Track triangle assignments: -1 stays on chassis, >= 0 goes to wheel bucket i
    const assignments = new Int8Array(triCount);
    assignments.fill(-1);
    let anyAssigned = false;

    for (let t = 0; t < triCount; t += 1) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      p0.fromBufferAttribute(posAttr, i0).applyMatrix4(meshToRoot);
      p1.fromBufferAttribute(posAttr, i1).applyMatrix4(meshToRoot);
      p2.fromBufferAttribute(posAttr, i2).applyMatrix4(meshToRoot);
      centroid.copy(p0).add(p1).add(p2).multiplyScalar(1 / 3);

      // Quick Y guard avoids decks, solar arrays & sensor masts completely
      const maxAnchorRadius = wheelAnchors[0].wheelRadiusM;
      if (centroid.y > maxAnchorRadius * 2.28 || centroid.y < -0.05) continue;

      for (let b = 0; b < wheelAnchors.length; b += 1) {
        const a = wheelAnchors[b];
        const dx = Math.abs(centroid.x - a.localX);
        const dz = centroid.z - a.localZ;
        const dy = centroid.y - a.wheelRadiusM;
        const radial = Math.hypot(dz, dy);
        if (dx <= Math.max(a.wheelWidthM * 1.4, a.wheelRadiusM * 0.95) && radial <= a.wheelRadiusM * 1.18) {
          assignments[t] = b;
          anyAssigned = true;
          break;
        }
      }
    }

    if (!anyAssigned) continue;

    // Collect chassis triangles & wheel triangles cleanly into unindexed buffers
    const chassisPos: number[] = [];
    const chassisNorm: number[] = [];
    const chassisUv: number[] = [];

    const perBucketBuffers = wheelAnchors.map(() => ({
      pos: [] as number[],
      norm: [] as number[],
      uv: [] as number[],
    }));

    for (let t = 0; t < triCount; t += 1) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      const assign = assignments[t];
      if (assign < 0) {
        for (const vi of [i0, i1, i2]) {
          chassisPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
          if (normAttr) chassisNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
          if (uvAttr) chassisUv.push(uvAttr.getX(vi), uvAttr.getY(vi));
        }
      } else {
        const bucket = perBucketBuffers[assign];
        const anchor = wheelAnchors[assign];
        // Write wheel vertices directly into wheel-pivot centered root coordinates!
        for (const vi of [i0, i1, i2]) {
          p0.fromBufferAttribute(posAttr, vi).applyMatrix4(meshToRoot);
          bucket.pos.push(
            p0.x - anchor.localX,
            p0.y - anchor.wheelRadiusM,
            p0.z - anchor.localZ,
          );
          if (normAttr) {
            n0.fromBufferAttribute(normAttr, vi).applyMatrix3(normalMat).normalize();
            bucket.norm.push(n0.x, n0.y, n0.z);
          }
          if (uvAttr) {
            bucket.uv.push(uvAttr.getX(vi), uvAttr.getY(vi));
          }
        }
      }
    }

    // Replace original mesh geometry with pruned chassis geometry
    const nextChassisGeom = new THREE.BufferGeometry();
    if (chassisPos.length > 0) {
      nextChassisGeom.setAttribute('position', new THREE.Float32BufferAttribute(chassisPos, 3));
      if (normAttr) nextChassisGeom.setAttribute('normal', new THREE.Float32BufferAttribute(chassisNorm, 3));
      if (uvAttr) nextChassisGeom.setAttribute('uv', new THREE.Float32BufferAttribute(chassisUv, 2));
      nextChassisGeom.computeBoundingBox();
      nextChassisGeom.computeBoundingSphere();
    } else {
      // Keep an empty non-zero draw count guard by hiding empty remaining shell
      mesh.visible = false;
    }
    void rootToMesh;
    void n1;
    void n2;
    mesh.geometry = nextChassisGeom;
    geom.dispose();
    createdGeometries.push(nextChassisGeom);

    perBucketBuffers.forEach((buf, bIdx) => {
      if (buf.pos.length === 0) return;
      buckets[bIdx].meshes.push({
        positions: buf.pos,
        normals: buf.norm,
        uvs: buf.uv,
        material: mesh.material,
        hasNormals: Boolean(normAttr),
        hasUvs: Boolean(uvAttr),
      });
    });
  }

  for (const bucket of buckets) {
    if (bucket.meshes.length === 0) continue;
    const steerGroup = new THREE.Group();
    const spinGroup = new THREE.Group();
    steerGroup.name = `sim_wheel_steer_${bucket.anchor.sampleIndex}`;
    spinGroup.name = `sim_wheel_spin_${bucket.anchor.sampleIndex}`;
    const restPos = new THREE.Vector3(
      bucket.anchor.localX,
      bucket.anchor.wheelRadiusM,
      bucket.anchor.localZ,
    );
    steerGroup.position.copy(restPos);
    steerGroup.add(spinGroup);

    for (const part of bucket.meshes) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      if (part.hasNormals && part.normals.length === part.positions.length) {
        wg.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      } else {
        wg.computeVertexNormals();
      }
      if (part.hasUvs) {
        wg.setAttribute('uv', new THREE.Float32BufferAttribute(part.uvs, 2));
      }
      wg.computeBoundingSphere();
      createdGeometries.push(wg);
      const wheelMesh = new THREE.Mesh(wg, part.material);
      wheelMesh.castShadow = true;
      wheelMesh.receiveShadow = true;
      spinGroup.add(wheelMesh);
    }

    modelRoot.add(steerGroup);
    wheelPivots.push({
      sampleIndex: bucket.anchor.sampleIndex,
      steerGroup,
      spinGroup,
      restLocalPos: restPos,
    });
  }

  return { wheelPivots, createdGeometries };
}

export function applyWheelPivotSamples(
  pivots: ExtractedWheelPivot[],
  wheels: WheelRuntimeSample[],
  eqCompressionM: number,
  glYawOffsetRad: number,
): void {
  void glYawOffsetRad;
  for (const pivot of pivots) {
    const sample = wheels[pivot.sampleIndex];
    if (!sample) continue;
    // Vertical suspension bump offset in meters
    const dy = (sample.compressionM - eqCompressionM) * 0.85;
    pivot.steerGroup.position.set(
      pivot.restLocalPos.x,
      pivot.restLocalPos.y + dy,
      pivot.restLocalPos.z,
    );
    pivot.steerGroup.rotation.y = sample.steerAngleRad;
    pivot.spinGroup.rotation.x = sample.spinAngleRad;
  }
}
