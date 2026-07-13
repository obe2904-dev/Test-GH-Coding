/**
 * @typedef {'inline' | 'link' | 'pdf' | 'none'} MenuSource
 * - 'inline': menu text found directly in the HTML
 * - 'link': a menu URL was detected, needs follow-up scrape
 * - 'pdf': menu link points to a .pdf file
 * - 'none': no menu signal found at all
 */

/**
 * @typedef {'rich' | 'thin' | 'shell'} ContentQuality
 * - 'rich': >2000 chars of clean content after stripping
 * - 'thin': 200–2000 chars — proceed with caution
 * - 'shell': <200 chars — JS shell or blocked, do not send to AI
 */

/**
 * @typedef {Object} MetaData
 * @property {string | null} title
 * @property {string | null} description
 * @property {string | null} og_title
 * @property {string | null} og_description
 * @property {string | null} og_image
 * @property {string | null} keywords
 * @property {string | null} locale
 */

/**
 * @typedef {Object} ContactData
 * @property {string | null} email
 * @property {string | null} phone
 * @property {string | null} address
 */

/**
 * @typedef {Object} LinksData
 * @property {string | null} booking
 * @property {string | null} menu_url
 * @property {string | null} takeaway
 * @property {string[]} social
 * @property {string[]} pdf_menus
 * @property {Array<{url: string, text: string}>} raw
 */

/**
 * @typedef {Object} ScrapedPayload
 * @property {string} url
 * @property {string} scraped_at - ISO timestamp
 * 
 * @property {MetaData} meta - Deterministic fields (zero AI cost)
 * @property {ContactData} contact
 * @property {string | null} opening_hours_raw - raw text block, AI will parse
 * @property {LinksData} links
 * 
 * @property {string | null} menu_text - dish/price content, stripped
 * @property {string | null} about_text - brand narrative copy
 * @property {string} full_text - everything else, fallback
 * 
 * @property {MenuSource} menu_source
 * @property {ContentQuality} content_quality
 * @property {number} content_char_count - chars after full strip
 * @property {number} raw_size_bytes - size of original HTML
 */

export {};
