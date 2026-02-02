/**
 * Frontend Utilities
 * Common utility functions for the frontend
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * Use this when inserting dynamic content into innerHTML
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Creates a DOM element with the specified properties
 * Safer alternative to innerHTML for simple elements
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    className?: string;
    textContent?: string;
    children?: (HTMLElement | string)[];
    attributes?: Record<string, string>;
  }
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options?.className) {
    element.className = options.className;
  }

  if (options?.textContent) {
    element.textContent = options.textContent;
  }

  if (options?.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      element.setAttribute(key, value);
    }
  }

  if (options?.children) {
    for (const child of options.children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

/**
 * Formats a level ID to a human-readable name
 */
export function formatLevelName(levelId: string): string {
  return levelId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/** @deprecated Use formatLevelName instead */
export const formatDungeonName = formatLevelName;
