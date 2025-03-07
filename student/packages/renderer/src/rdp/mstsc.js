/**
 * The Mstsc class encapsulates helper functionality for RDP rendering.
 * It provides basic utilities such as element shortcuts, computing element
 * offsets, browser detection and locale detection.
 */
class Mstsc {
	constructor() {
		// Initialization if needed.
	}
	
	/**
	 * Shortcut for document.getElementById.
	 * @param {string} id - The id of the element to retrieve.
	 * @returns {HTMLElement|null} The element with the specified id.
	 */
	$(id) {
		return document.getElementById(id);
	}
	
	/**
	 * Compute screen offset (top, left) for a target element.
	 * @param {HTMLElement} el - The DOM element.
	 * @returns {{top: number, left: number}} The offset of the element.
	 */
	elementOffset(el) {
		let x = 0;
		let y = 0;
		while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
			x += el.offsetLeft - el.scrollLeft;
			y += el.offsetTop - el.scrollTop;
			el = el.offsetParent;
		}
		return { top: y, left: x };
	}
	
	/**
	 * Detects the browser.
	 * @returns {string|null} Returns 'firefox', 'chrome', or 'ie' if detected, otherwise null.
	 */
	browser() {
		if (typeof InstallTrigger !== 'undefined') {
			return 'firefox';
		}
		
		if (!!window.chrome) {
			return 'chrome';
		}
		
		if (!!document.documentMode) {
			return 'ie';
		}
		
		return null;
	}
	
	/**
	 * Detect the language of the browser.
	 * @returns {string} The browser language.
	 */
	locale() {
		return window.navigator.userLanguage || window.navigator.language;
	}
}

// Create a single instance of Mstsc
const mstscInstance = new Mstsc();

// Optional: expose Mstsc globally (for legacy or non-module code)
if (typeof window !== 'undefined') {
	window.Mstsc = mstscInstance;
}

// Export the instance as the default export for ES modules.
export default mstscInstance;