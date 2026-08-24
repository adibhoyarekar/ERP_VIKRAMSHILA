/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param lat1 Latitude of the first point in decimal degrees
 * @param lon1 Longitude of the first point in decimal degrees
 * @param lat2 Latitude of the second point in decimal degrees
 * @param lon2 Longitude of the second point in decimal degrees
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // in meters
  return distance;
}

export interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Robustly acquires user device geolocation with multi-tier fallback.
 * Solves false "permission denied" errors when GPS is already on by retrying
 * with network/cached location if hardware GPS lock is slow or times out.
 */
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser or device.");
  }

  // Attempt 1: High Accuracy GPS (12s timeout, allows 30s cached position)
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000
      });
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  } catch (firstError: any) {
    // If the user explicitly denied permission (code 1), do not retry
    if (firstError?.code === 1) {
      throw new Error(
        "Location permission is blocked. Please tap the lock/tune icon in your browser address bar and allow Location access."
      );
    }

    console.warn("High-accuracy GPS lock timed out or failed. Retrying with network location fallback...", firstError);

    // Attempt 2: Fallback with standard network location & 2-minute cached position
    try {
      const fallbackPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 120000 // Accept position up to 2 minutes old
        });
      });

      return {
        latitude: fallbackPosition.coords.latitude,
        longitude: fallbackPosition.coords.longitude,
        accuracy: fallbackPosition.coords.accuracy
      };
    } catch (secondError: any) {
      if (secondError?.code === 1) {
        throw new Error(
          "Location permission is blocked. Please allow Location access in your browser settings."
        );
      } else if (secondError?.code === 2) {
        throw new Error(
          "Location unavailable. Please make sure your phone's Location / GPS toggle is turned ON."
        );
      } else if (secondError?.code === 3) {
        throw new Error(
          "Location request timed out. Please ensure your device has a clear GPS/network signal and try again."
        );
      }

      throw new Error(
        secondError?.message || "Unable to retrieve device coordinates. Please verify your phone's GPS is enabled."
      );
    }
  }
}
