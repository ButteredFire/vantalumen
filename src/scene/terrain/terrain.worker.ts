import type { BodyId } from '../../types/cosmos.types';
import {
  BASE_TILE_SEGMENTS,
  generateTilePayload,
  type TerrainRockSpec,
} from './terrainDataPipeline';

export interface TerrainWorkerBuildRequest {
  type: 'build';
  requestId: number;
  bodyId: BodyId;
  tx: number;
  tz: number;
  segments?: number;
}

export interface TerrainWorkerCancelRequest {
  type: 'cancel';
  requestId: number;
}

export type TerrainWorkerMessage =
  | TerrainWorkerBuildRequest
  | TerrainWorkerCancelRequest;

export interface TerrainWorkerResult {
  type: 'built';
  requestId: number;
  key: string;
  bodyId: BodyId;
  tx: number;
  tz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  segments: number;
  heightsBuffer: ArrayBuffer;
  minHeight: number;
  maxHeight: number;
  rocks: TerrainRockSpec[];
}

const cancelledIds = new Set<number>();

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<TerrainWorkerMessage>) => {
    const msg = event.data;
    if (msg.type === 'cancel') {
      cancelledIds.add(msg.requestId);
      return;
    }
    if (cancelledIds.has(msg.requestId)) {
      cancelledIds.delete(msg.requestId);
      return;
    }

    const payload = generateTilePayload(
      msg.bodyId,
      msg.tx,
      msg.tz,
      msg.segments ?? BASE_TILE_SEGMENTS,
    );

    if (cancelledIds.has(msg.requestId)) {
      cancelledIds.delete(msg.requestId);
      return;
    }

    const buffer = payload.heights.buffer as ArrayBuffer;
    const response: TerrainWorkerResult = {
      type: 'built',
      requestId: msg.requestId,
      key: payload.key,
      bodyId: payload.bodyId,
      tx: payload.tx,
      tz: payload.tz,
      minX: payload.minX,
      maxX: payload.maxX,
      minZ: payload.minZ,
      maxZ: payload.maxZ,
      segments: payload.segments,
      heightsBuffer: buffer,
      minHeight: payload.minHeight,
      maxHeight: payload.maxHeight,
      rocks: payload.rocks,
    };

    (self as unknown as Worker).postMessage(response, [buffer]);
  };
}
