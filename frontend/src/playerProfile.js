export function playerProfilePath(currentUserId, userId, groupId) {
  if (Number(userId) === Number(currentUserId)) return '/profile';
  const q = groupId ? `?group=${groupId}` : '';
  return `/profile/${userId}${q}`;
}
