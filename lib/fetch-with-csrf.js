/**
 * Fetch wrapper that automatically includes CSRF token
 * Usage: Same as normal fetch, but automatically adds CSRF token to requests
 */

let csrfToken = null;

/**
 * Fetches CSRF token from server
 * @returns {Promise<string>} - CSRF token
 */
async function getCsrfToken() {
	if (csrfToken) {
		return csrfToken;
	}

	try {
		const response = await fetch("/api/csrf-token");
		const data = await response.json();
		csrfToken = data.csrfToken;
		return csrfToken;
	} catch (error) {
		console.error("Failed to get CSRF token:", error);
		return null;
	}
}

/**
 * Fetch with automatic CSRF token inclusion
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithCsrf(url, options = {}) {
	const method = options.method || "GET";

	// Skip CSRF for GET, HEAD, OPTIONS
	if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
		return fetch(url, options);
	}

	// Get CSRF token
	const token = await getCsrfToken();

	if (!token) {
		console.warn("CSRF token not available, proceeding without it");
		return fetch(url, options);
	}

	// Add CSRF token to headers
	const headers = {
		...options.headers,
		"X-CSRF-Token": token,
	};

	return fetch(url, { ...options, headers });
}

/**
 * Reset CSRF token (call after logout or token expiry)
 */
export function resetCsrfToken() {
	csrfToken = null;
}
