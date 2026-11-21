// Shared ImageKit delivery helpers. Originals remain untouched in storage;
// transformations are applied only to public delivery URLs.
const IMAGEKIT_HOST = 'ik.imagekit.io';

export function optimizedImageUrl(value, width, quality = 80) {
  const source = String(value || '').trim();
  if (!source) return source;
  try {
    const url = new URL(source, window.location.href);
    if (url.hostname !== IMAGEKIT_HOST || !url.pathname.startsWith('/eazylife/')) return source;
    const transforms = [];
    if (Number.isFinite(Number(width)) && Number(width) > 0) transforms.push('w-' + Math.round(Number(width)));
    transforms.push('q-' + Math.max(1, Math.min(100, Math.round(Number(quality) || 80))));
    transforms.push('f-auto');
    url.searchParams.set('tr', transforms.join(','));
    return url.href;
  } catch (_) {
    return source;
  }
}

export function responsiveImageAttrs(value, widths = [320, 640, 960, 1280], sizes = '100vw', quality = 80) {
  const source = String(value || '').trim();
  if (!source) return '';
  try {
    const url = new URL(source, window.location.href);
    if (url.hostname !== IMAGEKIT_HOST || !url.pathname.startsWith('/eazylife/')) return '';
    const srcset = widths.map(width => optimizedImageUrl(source, width, quality) + ' ' + width + 'w').join(', ');
    return 'srcset="' + srcset.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" sizes="' + String(sizes).replace(/"/g, '&quot;') + '"';
  } catch (_) {
    return '';
  }
}
