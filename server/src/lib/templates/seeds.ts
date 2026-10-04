import type { Row } from '../dataSource.js'

/**
 * Compiled fallbacks, one per template — the copy that answers when a widget
 * has no source bound to that template, or when the bound source has not
 * produced a good copy yet. They are the old hardcoded tables from the engine
 * chat route, moved here unchanged: a template must always be able to render,
 * and it must never be the reason a deploy is needed to fix a price.
 */

export const CINEMA_DATA: Record<string, Record<string, unknown>> = {
  '1': { id: '1', name: 'Cinescape 360', name_ar: 'سينسكيب 360', address: '360 Mall, Zahra (South Surra)', address_ar: 'مول 360، الزهراء', hours: '11 AM - 4 AM', lat: 29.267396766357216, lng: 47.99196210604129, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000001.jpg?v=169', maps_url: 'https://maps.google.com/?q=29.267396766357216,47.99196210604129', experiences: ['STANDARD', 'VIP', '4DX', 'DOLBY'] },
  '8': { id: '8', name: 'Cinescape Avenues', name_ar: 'سينسكيب الأفنيوز', address: 'The Avenues Mall (Phase 1), Al-Rai', address_ar: 'مول الأفنيوز، الري', hours: '11 AM - 2 AM', lat: 29.30258, lng: 47.92927, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000008.jpg?v=741', maps_url: 'https://maps.google.com/?q=29.30258,47.92927', experiences: ['STANDARD', 'VIP', '4DX', 'DOLBY', 'SCREENX'] },
  '5': { id: '5', name: 'Cinescape Al Kout', name_ar: 'سينسكيب الكوت', address: 'Al Kout Mall, Fahaheel', address_ar: 'الكوت مول، الفحيحيل', hours: '11 AM - 4 AM', lat: 29.07798, lng: 48.13963, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000005.jpg', maps_url: 'https://maps.google.com/?q=29.07798,48.13963', experiences: ['STANDARD', 'IMAX', '4DX', 'ELEVEN'] },
  '13': { id: '13', name: 'Cinescape Assima', name_ar: 'سينسكيب العاصمة', address: 'Assima Mall, Mirqab (Kuwait City)', address_ar: 'مول العاصمة، المرقاب', hours: '11 AM - 3 AM', lat: 29.373813616320145, lng: 47.98789268449745, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000013.jpg?v=646', maps_url: 'https://maps.google.com/?q=29.373813616320145,47.98789268449745', experiences: ['STANDARD', 'VIP', '4DX', '4DXSCREEN', '3D', 'DOLBY', 'SKYLINE'] },
  '14': { id: '14', name: 'Cinescape Khiran', name_ar: 'سينسكيب الخيران', address: 'Al Khiran Outlet Mall, Sabah Al Ahmed Sea City', address_ar: 'مول الخيران، مدينة صباح الأحمد البحرية', hours: '11 AM - 2 AM', lat: 28.67086, lng: 48.34639, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000014.jpg?v=867', maps_url: 'https://maps.google.com/?q=28.67086,48.34639', experiences: ['STANDARD', 'VIP'] },
  '15': { id: '15', name: 'Cinescape Warehouse', name_ar: 'سينسكيب ذا ويرهاوس', address: 'The Warehouse Mall, South Sabahiya', address_ar: 'مول ذا ويرهاوس، جنوب الصباحية', hours: '11 AM - 3 AM', lat: 29.0859, lng: 48.1032, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000015.jpg?v=103', maps_url: 'https://maps.google.com/?q=29.0859,48.1032', experiences: ['STANDARD'] },
  '3': { id: '3', name: 'Cinescape Al Bairaq', name_ar: 'سينسكيب البيرق', address: 'Al Bairaq Mall, Eqaila', address_ar: 'البيرق مول، العقيلة', hours: '12 PM - 2 AM', lat: 29.17358, lng: 48.09881, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000003.jpg?v=238', maps_url: 'https://maps.google.com/?q=29.17358,48.09881', experiences: ['STANDARD'] },
  '2': { id: '2', name: 'Cinescape Ajial', name_ar: 'سينسكيب أجيال', address: 'Ajial Mall, Fahaheel', address_ar: 'أجيال مول، الفحيحيل', hours: '3:30 PM - 2 AM', lat: 29.08288, lng: 48.13633, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000002.jpg?v=046', maps_url: 'https://maps.google.com/?q=29.08288,48.13633', experiences: ['STANDARD'] },
  '12': { id: '12', name: '1954 Film House', name_ar: 'بيت الأفلام 1954', address: 'Souq Al Kout (Seaside), Fahaheel', address_ar: 'سوق الكوت القديم (الواجهة البحرية)، الفحيحيل', hours: '12 PM - 3 AM', lat: 29.08078, lng: 48.14085, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000012.jpg?v=800', maps_url: 'https://maps.google.com/?q=29.08078,48.14085', experiences: ['STANDARD'] },
}

export const PRICE_ITEMS = [
  { label: 'عادي 2D/3D', label_en: 'Standard 2D/3D', price: '3.500' },
  { label: 'ستاندرد بريميوم', label_en: 'Standard Premium', price: '4.000' },
  { label: 'VIP', label_en: 'VIP', price: '8.000' },
  { label: '4DX', label_en: '4DX', price: '8.000' },
  { label: '4DX Screen', label_en: '4DX Screen', price: '8.000' },
  { label: 'IMAX عادي', label_en: 'IMAX Regular', price: '4.000' },
  { label: 'IMAX بريميوم', label_en: 'IMAX Premium', price: '4.500' },
  { label: 'ScreenX', label_en: 'ScreenX', price: '4.500' },
  { label: 'دولبي', label_en: 'Dolby Cinema', price: '4.500' },
  { label: 'ELEVEN', label_en: 'ELEVEN', price: '3.500' },
  { label: 'Skyline', label_en: 'Skyline', price: '5.000' },
  { label: 'بيت الأفلام 1954 (ديلوكس)', label_en: '1954 Film House (Deluxe)', price: '6.000' },
]

export const EXPERIENCE_ITEMS = [
  { name: 'IMAX', cinemas_ar: 'الكوت فقط (الوحيدة بالكويت)', cinemas_en: 'Al Kout only (the only one in Kuwait)', price: '4.000' },
  { name: 'Dolby Cinema', cinemas_ar: '360، الأفنيوز، العاصمة', cinemas_en: '360, Avenues, Assima', price: '4.500' },
  { name: '4DX', cinemas_ar: '360، الأفنيوز، الكوت', cinemas_en: '360, Avenues, Al Kout', price: '8.000' },
  { name: '4DX Screen', cinemas_ar: 'العاصمة فقط', cinemas_en: 'Assima only', price: '8.000' },
  { name: 'ScreenX', cinemas_ar: 'الأفنيوز والعاصمة', cinemas_en: 'Avenues and Assima', price: '4.500' },
  { name: 'ELEVEN', cinemas_ar: 'الكوت فقط', cinemas_en: 'Al Kout only', price: '3.500' },
  { name: 'VIP', cinemas_ar: '360، الأفنيوز، العاصمة، الخيران', cinemas_en: '360, Avenues, Assima, Khiran', price: '8.000' },
  { name: 'Skyline', cinemas_ar: 'العاصمة', cinemas_en: 'Assima', price: '5.000', note_ar: 'موسمي بالشتاء', note_en: 'seasonal, winter' },
  { name: '1954 Film House', cinemas_ar: 'سوق الكوت', cinemas_en: 'Souq Al Kout', price: '6.000', note_ar: 'سينما بوتيك بمقاعد ديلوكس', note_en: 'boutique cinema, Deluxe seats' },
]

/** The store links, a one-row source so the dashboard can edit them like any other. */
export const APP_LINKS: Row = {
  ios: 'https://apps.apple.com/in/app/cinescape-kncc/id443396586',
  android: 'https://play.google.com/store/apps/details?id=com.cinescape&hl=en_IN',
}

/** Cinemas as rows (the registry works in rows; the id stays on each one). */
export const CINEMA_ROWS: Row[] = Object.values(CINEMA_DATA)
