const locationErrors = {
  1: "Location permission was denied. Allow location for this site in your browser and device settings, or ask your trainer to record attendance separately.",
  2: "Your device could not find its location. Turn on Location services and Wi-Fi, then retry near the venue. A phone may work better than a desktop computer.",
  3: "Your device did not provide a location after two attempts. Turn on Location services and Wi-Fi, allow location for this site, then retry near the venue or use your phone. No attendance was saved.",
};

function getPosition(geolocation, options, signal) {
  return new Promise((resolve, reject) => {
    function abort() {
      reject(new DOMException("Location check cancelled.", "AbortError"));
    }
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    const finish = (callback) => (value) => {
      signal?.removeEventListener("abort", abort);
      if (!signal?.aborted) callback(value);
    };
    try {
      geolocation.getCurrentPosition(finish(resolve), finish(reject), options);
    } catch (error) {
      finish(reject)(error);
    }
  });
}

export async function locate({
  geolocation = globalThis.navigator?.geolocation,
  signal,
  onRetry = () => {},
} = {}) {
  if (!geolocation) {
    throw new Error(
      "This browser cannot share location. Use a supported browser over HTTPS, or ask your trainer to record attendance separately.",
    );
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  };
  try {
    try {
      return await getPosition(geolocation, options, signal);
    } catch (error) {
      // A normal-accuracy request can work when a precise fix is unavailable.
      // Do not retry a denied permission or a cancelled request.
      if (signal?.aborted || ![2, 3].includes(error.code)) throw error;
      onRetry();
      return await getPosition(
        geolocation,
        { ...options, enableHighAccuracy: false },
        signal,
      );
    }
  } catch (error) {
    if (signal?.aborted)
      throw new DOMException("Location check cancelled.", "AbortError");
    if (error.name === "AbortError") throw error;
    throw new Error(
      locationErrors[error.code] ||
        "Location could not be read. Please try again. No attendance was saved.",
    );
  }
}
