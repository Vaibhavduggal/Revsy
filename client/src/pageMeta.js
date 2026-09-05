export function getTitle(pathname, copy) {
  const people = copy?.personPluralTitle || 'Customers';
  const TITLES = {
    '/dashboard': 'Dashboard',
    '/customers': people,
    '/messages': 'Messages',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/admin': 'Admin',
  };
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + (pathname.split('/')[1] || '');
  return TITLES[base] || 'Revsy';
}
