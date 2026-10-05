/**
 * Access-control concept (configurable per resource via resources.access_level)
 *
 *   public                → everyone
 *   registered            → any logged-in candidate
 *   verified              → candidate with verification_status = 'verified'
 *   lakshit_or_permitted  → verified लक्षित गट candidate, OR candidate with
 *                            study_material_permitted, OR a per-resource grant
 *
 * Final access-control rules are HOLD – only the levels above are implemented.
 */
const LEVELS = ['public', 'registered', 'verified', 'lakshit_or_permitted'];

function canAccess(candidate, resource, grantedIds = new Set()) {
  const level = resource.access_level || 'public';
  if (level === 'public') return true;
  if (!candidate) return false;
  if (grantedIds.has(resource.id)) return true;
  if (level === 'registered') return true;
  const verified = candidate.verification_status === 'verified';
  if (level === 'verified') return verified;
  if (level === 'lakshit_or_permitted') return (verified && candidate.category === 'lakshit') || candidate.study_material_permitted;
  return false;
}

// Why is this locked? Used for the lock message shown to users.
function lockReason(candidate, resource) {
  if (!candidate) return 'login';
  if (resource.access_level === 'verified') return 'verification';
  if (resource.access_level === 'lakshit_or_permitted') return 'lakshit';
  return 'restricted';
}

// Lectures: public | registered | verified
function canSeeLecture(candidate, lecture) {
  if (lecture.visibility === 'public') return true;
  if (!candidate) return false;
  if (lecture.visibility === 'verified') return candidate.verification_status === 'verified';
  return true;
}

module.exports = { LEVELS, canAccess, lockReason, canSeeLecture };
