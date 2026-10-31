import Logger from '../utils/logger';
import { DeliveryConfigRepository } from '../repositories/deliveryConfig.repository';
import { resolveDeliveryZone, DeliveryZone } from './pricing.service';

/** Remote areas a standard courier doesn't reach: Andaman & Nicobar, Lakshadweep. */
const NON_SERVICEABLE_PREFIXES = ['744', '682559', '682553'];
const ESTIMATED_DAYS = '5-7';
const LOOKUP_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PincodeLocation {
  district: string;
  state: string;
}

/** null = the pincode does not exist; undefined = the directory could not be reached. */
export type PincodeLookup = (pincode: string) => Promise<PincodeLocation | null | undefined>;

export interface PincodeCheckResult {
  pincode: string;
  available: boolean;
  /** False when the postal directory was unreachable and the pincode could not be confirmed. */
  verified: boolean;
  city?: string;
  state?: string;
  deliveryZone?: DeliveryZone | null;
  /** The charge checkout will add for this zone (from delivery-config). */
  deliveryFee?: number | null;
  estimatedDays?: string;
  reason?: string;
}

/** India Post's public pincode directory (api.postalpincode.in). */
export const indiaPostLookup: PincodeLookup = async (pincode) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Array<{ Status?: string; PostOffice?: Array<{ District?: string; State?: string }> | null }>;
    const entry = Array.isArray(body) ? body[0] : undefined;
    if (!entry) return undefined;
    const office = entry.PostOffice?.[0];
    if (entry.Status !== 'Success' || !office) return null;
    return { district: String(office.District ?? ''), state: String(office.State ?? '') };
  } catch (error) {
    Logger.warn(`[delivery] pincode lookup failed for ${pincode}: ${String(error)}`);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

export class DeliveryService {
  private cache = new Map<string, { at: number; value: PincodeLocation | null }>();

  constructor(
    private lookup: PincodeLookup = indiaPostLookup,
    private deliveryConfigRepository = new DeliveryConfigRepository(),
    private now: () => number = Date.now,
  ) {}

  private async locate(pincode: string): Promise<PincodeLocation | null | undefined> {
    const hit = this.cache.get(pincode);
    if (hit && this.now() - hit.at < CACHE_TTL_MS) return hit.value;
    const value = await this.lookup(pincode);
    // Only definite answers are cached; an outage is retried next time.
    if (value !== undefined) this.cache.set(pincode, { at: this.now(), value });
    return value;
  }

  public async checkPincode(pincode: string): Promise<PincodeCheckResult> {
    if (NON_SERVICEABLE_PREFIXES.some((prefix) => pincode.startsWith(prefix))) {
      return { pincode, available: false, verified: true, reason: 'Remote area — serviceable via manual arrangement' };
    }

    const location = await this.locate(pincode);
    if (location === null) {
      return { pincode, available: false, verified: true, reason: 'This pincode does not exist' };
    }
    if (location === undefined) {
      // Directory down: don't block a sale over it; checkout still prices delivery from the address.
      return { pincode, available: true, verified: false, estimatedDays: ESTIMATED_DAYS };
    }

    const zone = resolveDeliveryZone({ city: location.district, state: location.state });
    const config = await this.deliveryConfigRepository.getConfig();
    return {
      pincode,
      available: true,
      verified: true,
      city: location.district,
      state: location.state,
      deliveryZone: zone,
      deliveryFee: zone ? Number(config[zone]) || 0 : null,
      estimatedDays: ESTIMATED_DAYS,
    };
  }
}
