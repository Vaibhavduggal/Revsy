const TITLES = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/messages': 'Messages',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/admin': 'Admin',
};

export function getTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + (pathname.split('/')[1] || '');
  return TITLES[base] || 'ReviewBot';
}
