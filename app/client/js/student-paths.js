// Keep existing bookmarks working while all shop discovery uses one directory.
export function canonicalPath(path) {
  const [route, ...parts] = String(path).replace(/^#?\/?/, '').split('/');
  if (route === 'checkin') return ['explore', ...parts].join('/');
  if (route === 'deals') return 'explore/deals';
  if (route === 'cafes') return 'explore/cafes';
  return [route, ...parts].join('/');
}
