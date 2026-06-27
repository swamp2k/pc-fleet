import Anthropic from '@anthropic-ai/sdk';
import type { Db } from './db';

const MODEL = 'claude-sonnet-4-6';

interface PromptInput {
  device: { id: string; name: string; owner: string | null; status: string; notes: string | null };
  hardware: Record<string, unknown> | null;
  recentMetrics: unknown[];
  diskMetrics: unknown[];
  avStatus: unknown | null;
  pendingUpdates: unknown | null;
  userProfile: {
    primary_use_cases: string | null;
    performance_expectation: string | null;
    usage_notes: string | null;
  } | null;
  spareParts: unknown[];
}

export async function buildPromptInput(db: Db, deviceId: string): Promise<PromptInput> {
  const [device, hardware, recentMetrics, diskMetrics, avStatus, pendingUpdates, profile, spareParts] =
    await Promise.all([
      db.getDevice(deviceId),
      db.getHardware(deviceId),
      db.getRecentMetrics(deviceId),
      db.getLatestDiskMetrics(deviceId),
      db.getAvStatus(deviceId),
      db.getPendingUpdates(deviceId),
      db.getProfile(deviceId),
      db.listSpares(),
    ]);

  if (!device) throw new Error('device not found');

  return {
    device: { id: device.id, name: device.name, owner: device.owner, status: device.status, notes: device.notes },
    hardware: hardware as Record<string, unknown> | null,
    recentMetrics,
    diskMetrics,
    avStatus,
    pendingUpdates,
    userProfile: profile ? {
      primary_use_cases: profile.primary_use_cases,
      performance_expectation: profile.performance_expectation,
      usage_notes: profile.usage_notes,
    } : null,
    spareParts,
  };
}

function formatPrompt(input: PromptInput): string {
  const hw = input.hardware as Record<string, unknown> | null;
  const sections: string[] = [
    `## Device: ${input.device.name}${input.device.owner ? ` (${input.device.owner})` : ''}`,
  ];

  if (input.device.notes) sections.push(`**Notes from admin:** ${input.device.notes}`);

  // Hardware
  if (hw) {
    const gpus = hw.gpu_json ? JSON.parse(hw.gpu_json as string) : [];
    const gpuStr = Array.isArray(gpus) && gpus.length
      ? gpus.map((g: Record<string, unknown>) => g.model ?? JSON.stringify(g)).join(', ')
      : 'none reported';
    sections.push(`
## Hardware (as of ${hw.collected_at ?? 'unknown'})
- CPU: ${hw.cpu_model ?? 'unknown'} (${hw.cpu_cores ?? '?'} cores / ${hw.cpu_threads ?? '?'} threads)
- RAM: ${hw.ram_total_gb ?? '?'} GB
- GPU: ${gpuStr}
- Motherboard: ${hw.motherboard_model ?? 'unknown'}
- Storage: ${hw.storage_devices_json ?? 'not reported'}`);
  } else {
    sections.push('\n## Hardware\nNo hardware inventory collected yet.');
  }

  // Recent metrics
  if (input.recentMetrics.length) {
    const metrics = input.recentMetrics as Array<{ recorded_at: string; cpu_pct: number | null; ram_pct: number | null; temp_c: number | null }>;
    const avgCpu = average(metrics.map(m => m.cpu_pct));
    const avgRam = average(metrics.map(m => m.ram_pct));
    const avgTemp = average(metrics.map(m => m.temp_c));
    sections.push(`
## Recent Performance (last ${metrics.length} readings)
- Avg CPU: ${fmt(avgCpu, '%')}
- Avg RAM: ${fmt(avgRam, '%')}
- Avg CPU temp: ${fmt(avgTemp, '°C')}`);
  }

  // Disk
  if (input.diskMetrics.length) {
    const vols = input.diskMetrics as Array<{ volume_label: string; total_gb: number | null; free_gb: number | null; used_pct: number | null }>;
    sections.push('\n## Disk');
    for (const v of vols) {
      sections.push(`- ${v.volume_label}: ${fmt(v.free_gb, ' GB free')} of ${fmt(v.total_gb, ' GB')} (${fmt(v.used_pct, '% used')})`);
    }
  }

  // User profile
  if (input.userProfile) {
    const useCases = input.userProfile.primary_use_cases
      ? JSON.parse(input.userProfile.primary_use_cases).join(', ')
      : 'not specified';
    sections.push(`
## User Profile
- Primary use cases: ${useCases}
- Performance expectation: ${input.userProfile.performance_expectation ?? 'not specified'}
- Notes: ${input.userProfile.usage_notes ?? 'none'}`);
  } else {
    sections.push('\n## User Profile\nNot configured yet — give general advice based on hardware.');
  }

  // Spare parts
  if (input.spareParts.length) {
    const parts = input.spareParts as Array<{ part_type: string; model: string | null; condition: string | null; spec_json: string | null }>;
    sections.push('\n## Available Spare Parts');
    for (const p of parts) {
      const spec = p.spec_json ? ` (${p.spec_json})` : '';
      sections.push(`- ${p.part_type}: ${p.model ?? 'unspecified'}${spec} [${p.condition ?? 'unknown condition'}]`);
    }
  } else {
    sections.push('\n## Available Spare Parts\nNone on hand.');
  }

  // Security / updates
  const av = input.avStatus as Record<string, unknown> | null;
  const upd = input.pendingUpdates as Record<string, unknown> | null;
  if (av || upd) {
    sections.push('\n## Security & Updates');
    if (av) sections.push(`- Defender: ${av.defender_enabled ? 'enabled' : 'disabled'}, signatures ${fmt(av.signature_age_days as number | null, ' days old')}`);
    if (upd) sections.push(`- Pending Windows updates: ${upd.count ?? 0}`);
  }

  return sections.join('\n');
}

export async function generateRecommendation(apiKey: string, input: PromptInput): Promise<string> {
  const client = new Anthropic({ apiKey });

  const userContent = formatPrompt(input) + `

## Request
Based on all of the above, provide a concise PC fleet recommendation for this device. Cover:
1. **Upgrade priority** — what (if anything) most limits this machine for its stated use case
2. **Specific component recommendations** — what to upgrade or replace and why
3. **Spare parts match** — if any on-hand spare parts would help, call them out explicitly
4. **Leave well enough alone** — if the machine is fine for its purpose, say so

Keep the response practical and under 400 words.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'You are a practical PC hardware advisor for a home/family fleet. Give concrete, specific recommendations. Avoid marketing language.',
    messages: [{ role: 'user', content: userContent }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('unexpected response type from Anthropic API');
  return block.text;
}

function average(vals: (number | null)[]): number | null {
  const clean = vals.filter((v): v is number => v != null);
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function fmt(val: number | null, suffix: string): string {
  return val != null ? `${val.toFixed(1)}${suffix}` : 'unknown';
}

export { MODEL };
