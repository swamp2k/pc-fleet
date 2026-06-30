import type { Db } from './db';

interface RamModule {
  slot: string;
  capacity_gb: number;
  speed_mhz?: number;
  manufacturer?: string;
}

interface GpuInfo {
  model: string;
  vram_mb?: number;
}

interface StorageDevice {
  model: string;
  size_gb?: number;
  type?: string;
}

export interface SyncResult {
  synced: number;
  inStocked: number;
}

// Returns true when the CPU is soldered to the board and should not appear as a
// standalone swappable spare part.
export function isCpuSoldered(cpuModel: string, motherboardModel: string): boolean {
  // Intel mobile/embedded suffixes — always soldered regardless of board
  if (/\bi[3-9]-\d{4,5}[UHPYG]\b/i.test(cpuModel)) return true;
  // AMD mobile (Ryzen 3/5/7/9 xxxxU / xxxxH)
  if (/\bRyzen\s+[3579]\s+\d{4}[UH]\b/i.test(cpuModel)) return true;
  // Intel T-series: low-power desktop, but soldered in Tiny / Mini / NUC boards
  if (/\bi[3-9]-\d{4,5}T\b/i.test(cpuModel) && isTinyFormFactor(motherboardModel)) return true;
  return false;
}

function isTinyFormFactor(moboModel: string): boolean {
  return /\b(tiny|mini|nuc|m920|m720|m620|m520|m920x|m720q|p920|p720)\b/i.test(moboModel);
}

function safeParse<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

function ramLabel(m: RamModule): string {
  const parts: string[] = [];
  if (m.manufacturer) parts.push(m.manufacturer);
  if (m.capacity_gb) parts.push(`${m.capacity_gb}GB`);
  if (m.speed_mhz) parts.push(`DDR4-${m.speed_mhz}`);
  return parts.join(' ') || 'Unknown RAM';
}

function storageLabel(s: StorageDevice): string {
  const parts: string[] = [s.model || 'Unknown'];
  if (s.size_gb) parts.push(`${Math.round(s.size_gb)}GB`);
  if (s.type) parts.push(s.type.toUpperCase());
  return parts.join(' ');
}

export async function syncHardwareToSpares(db: Db): Promise<SyncResult> {
  const now = new Date().toISOString();
  const devices = await db.listDevicesWithHardware();

  const seenFingerprints: string[] = [];
  const processedDeviceIds: string[] = [];
  let synced = 0;

  for (const device of devices) {
    // Skip devices that have never reported hardware
    if (!device.cpu_model && !device.ram_modules_json && !device.gpu_json && !device.motherboard_model) {
      continue;
    }
    processedDeviceIds.push(device.id);

    const solderedOverride: string[] = safeParse(device.soldered_components);

    // ── RAM ──────────────────────────────────────────────────────────────────
    const ramModules = safeParse<RamModule>(device.ram_modules_json);
    for (const m of ramModules) {
      const fp = `ram:${device.id}:${m.slot}`;
      const specJson = JSON.stringify({
        slot: m.slot,
        capacity_gb: m.capacity_gb,
        speed_mhz: m.speed_mhz,
        manufacturer: m.manufacturer,
      });
      await db.upsertSpareByFingerprint({
        fingerprint: fp, deviceId: device.id, partType: 'ram',
        model: ramLabel(m), specJson, now,
      });
      seenFingerprints.push(fp);
      synced++;
    }

    // ── GPU ──────────────────────────────────────────────────────────────────
    const gpus = safeParse<GpuInfo>(device.gpu_json);
    // Track per-model occurrence index so two identical GPUs get distinct fingerprints
    const gpuModelCount: Record<string, number> = {};
    for (const g of gpus) gpuModelCount[g.model] = (gpuModelCount[g.model] ?? 0) + 1;
    const gpuModelIdx: Record<string, number> = {};
    for (const g of gpus) {
      const idx = gpuModelIdx[g.model] ?? 0;
      gpuModelIdx[g.model] = idx + 1;
      const fp = gpuModelCount[g.model] > 1
        ? `gpu:${device.id}:${g.model}:${idx}`
        : `gpu:${device.id}:${g.model}`;
      const specJson = JSON.stringify({ model: g.model, vram_mb: g.vram_mb });
      await db.upsertSpareByFingerprint({
        fingerprint: fp, deviceId: device.id, partType: 'gpu',
        model: g.model, specJson, now,
      });
      seenFingerprints.push(fp);
      synced++;
    }

    // ── Storage ───────────────────────────────────────────────────────────────
    const storages = safeParse<StorageDevice>(device.storage_devices_json);
    const storageKey = (s: StorageDevice) => `${s.model}:${Math.round(s.size_gb ?? 0)}`;
    const storageCount: Record<string, number> = {};
    for (const s of storages) storageCount[storageKey(s)] = (storageCount[storageKey(s)] ?? 0) + 1;
    const storageIdx: Record<string, number> = {};
    for (const s of storages) {
      const key = storageKey(s);
      const idx = storageIdx[key] ?? 0;
      storageIdx[key] = idx + 1;
      const fp = storageCount[key] > 1
        ? `storage:${device.id}:${key}:${idx}`
        : `storage:${device.id}:${key}`;
      const specJson = JSON.stringify({ model: s.model, size_gb: s.size_gb, type: s.type });
      await db.upsertSpareByFingerprint({
        fingerprint: fp, deviceId: device.id, partType: 'storage',
        model: storageLabel(s), specJson, now,
      });
      seenFingerprints.push(fp);
      synced++;
    }

    // ── Motherboard ───────────────────────────────────────────────────────────
    if (device.motherboard_model) {
      const fp = `motherboard:${device.id}:${device.motherboard_model}`;
      const soldered = device.cpu_model
        ? isCpuSoldered(device.cpu_model, device.motherboard_model)
        : false;
      // When the CPU is soldered, embed it in the motherboard's spec so the info isn't lost
      const spec: Record<string, unknown> = {
        model: device.motherboard_model,
        bios_version: device.bios_version,
      };
      if (soldered && device.cpu_model) {
        spec.soldered_cpu = device.cpu_model;
        spec.soldered_cpu_cores = device.cpu_cores;
        spec.soldered_cpu_threads = device.cpu_threads;
      }
      await db.upsertSpareByFingerprint({
        fingerprint: fp, deviceId: device.id, partType: 'motherboard',
        model: device.motherboard_model, specJson: JSON.stringify(spec), now,
      });
      seenFingerprints.push(fp);
      synced++;
    }

    // ── CPU (skip if soldered or manually overridden) ─────────────────────────
    const cpuSoldered = device.cpu_model && device.motherboard_model
      ? isCpuSoldered(device.cpu_model, device.motherboard_model)
      : false;
    if (device.cpu_model && !cpuSoldered && !solderedOverride.includes('cpu')) {
      const fp = `cpu:${device.id}:${device.cpu_model}`;
      const specJson = JSON.stringify({
        model: device.cpu_model,
        cores: device.cpu_cores,
        threads: device.cpu_threads,
      });
      await db.upsertSpareByFingerprint({
        fingerprint: fp, deviceId: device.id, partType: 'cpu',
        model: device.cpu_model, specJson, now,
      });
      seenFingerprints.push(fp);
      synced++;
    }
  }

  const inStocked = await db.markAutoSparesInStock(seenFingerprints, processedDeviceIds);
  return { synced, inStocked };
}
