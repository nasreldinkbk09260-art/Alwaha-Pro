import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const html = read('index.html');
const auth = read('supabase/functions/username-auth/index.ts');
const modal = read('alwaha-modal-shell.js');
const securityMigration = read('supabase/migrations/20261110001000_profile_account_security_hardening.sql');
const securityTest = read('supabase/tests/20261110001000_profile_account_security_hardening.sql');

function between(source, start, end) {
  const a = source.indexOf(start);
  if (a < 0) return '';
  const b = source.indexOf(end, a + start.length);
  return source.slice(a, b > a ? b : source.length);
}

const registration = between(html, 'async function handleNewUserRegistrationSubmit()', 'async function executeUserLoginAuth()');
const login = between(html, 'async function executeUserLoginAuth()', 'async function handleVerificationAvatarPick()');
const hydrate = between(html, 'async function hydrateAuthProfile', 'function formatAuthError');
const profileSync = between(html, 'function syncUiWithLoadedProfileData()', 'function normalizeAlwahaPhone');
const recovery = between(html, 'async function linkPhoneForAccountRecovery()', 'async function savePrivacyProfileUpdates');
const privacy = between(html, 'async function savePrivacyProfileUpdates()', 'async function handleVerificationAvatarPick');
const verification = between(html, 'async function submitAccountVerificationRequest()', 'async function loadAllRegisteredUsersList()');
const authListener = between(html, "onAuthStateChange((event, session) =>", "});");
const checks = [
  ['profile register entry opens the dedicated registration view', html.includes('id="profile-register-menu-item"') && html.includes("openSubProfileView('sub-prof-register')")],
  ['profile login entry opens the dedicated login view', html.includes('id="profile-login-menu-item"') && html.includes("openSubProfileView('sub-prof-login')")],
  ['guest register/login actions are hidden for signed-in users and logout is shown only for signed-in users', html.includes('async function syncProfileAuthMenu()') && html.includes("registerItem.style.display = signedIn ? 'none' : 'flex'") && html.includes("loginItem.style.display = signedIn ? 'none' : 'flex'") && html.includes("logoutButton.style.display = signedIn ? 'block' : 'none'")],
  ['registration and login are single-flight and submit buttons expose busy state', registration.includes('if(profileAuthActionInFlight)return;') && login.includes('if(profileAuthActionInFlight)return;') && registration.includes("profile-register-submit") && login.includes("profile-login-submit") && registration.includes("setAttribute('aria-busy','true')") && login.includes("setAttribute('aria-busy','true')")],
  ['registration validates name, username, email, international phone, password length, and confirmation', registration.includes("if(!firstName)") && registration.includes("^[a-z0-9_]{3,32}$") && registration.includes("if(email&&!/^\\S+@\\S+\\.\\S+$/.test(email))") && registration.includes("if(phoneInput&&!phone)") && registration.includes("if(password.length<8)") && registration.includes("if(password!==confirmPassword)")],
  ['registration supports email signup and username-only server registration', registration.includes('supabaseClient.auth.signUp') && registration.includes("action:'register'") && registration.includes("functions.invoke('username-auth'")],
  ['login supports email, legacy phone, and username authentication', login.includes('signInWithPassword({email:') && login.includes('signInWithPassword({phone,password})') && login.includes("action:'login'") && login.includes("functions.invoke('username-auth'")],
  ['password inputs are cleared after successful account creation or login', registration.includes("reg-password") && registration.includes("passwordField.value=''") && login.includes("login-password") && login.includes("passwordField.value=''")],
  ['registration avatar is compressed before being held as pending upload data', html.includes('compressImageFile(file,512,.8)') && html.includes("localStorage.setItem('alwaha_pending_avatar_data', dataUrl)")],
  ['pending avatar is bound to the submitted username and never uploaded to a different account', registration.includes("alwaha_pending_avatar_username") && hydrate.includes('pendingUsername !== currentUsername') && hydrate.includes('pendingUsername === currentUsername') && hydrate.includes('!profile.avatar_url')],
  ['pending avatar data is cleared after signout and on an auth SIGNED_OUT event', html.includes('function clearPendingProfileAvatar()') && html.includes('clearPendingProfileAvatar();') && authListener.includes('clearPendingProfileAvatar()')],
  ['username auth backend enforces 8-128 character passwords and separate registration/login rate limits', auth.includes('password.length < 8 || password.length > 128') && auth.includes('(count || 0) >= 5') && auth.includes('(count || 0) >= 15') && auth.includes('15 * 60 * 1000')],
  ['service role secret stays server-side and is not embedded in the client page', auth.includes('SUPABASE_SERVICE_ROLE_KEY') && !html.includes('SUPABASE_SERVICE_ROLE_KEY')],
  ['public profile UI hides email and keeps email/phone privacy locked on', profileSync.includes("emailEl.style.display = 'none'") && profileSync.includes('emailChk.checked = true') && profileSync.includes('emailChk.disabled = true') && profileSync.includes('phoneChk.checked = true') && profileSync.includes('phoneChk.disabled = true') && !privacy.includes('updateData.hide_email') && !privacy.includes('updateData.hide_phone') && !verification.includes('hide_email:true') && !verification.includes('hide_phone:true')],
  ['registration metadata defaults email and phone visibility to private', registration.includes('hide_email:true,hide_phone:true')],
  ['verification form is visibly deferred and sends no personal data until production insert permissions are hardened', verification.includes('طلبات التوثيق قيد التطوير') && !verification.includes('supabaseFetch') && html.includes('طلبات التوثيق — قريبًا') && html.includes('disabled aria-disabled="true"')],
  ['profile security migration removes direct user-row deletion and restricts verification inserts', securityMigration.includes('REVOKE DELETE ON TABLE public.users') && securityMigration.includes('DROP POLICY IF EXISTS users_delete_own') && securityMigration.includes('GRANT INSERT (') && securityMigration.includes("status = 'pending'") && securityMigration.includes('reviewed_at IS NULL') && securityMigration.includes('reviewed_by IS NULL') && securityMigration.includes('REVOKE UPDATE (hide_email,hide_phone)') && securityMigration.includes('UPDATE public.users SET hide_email=true,hide_phone=true')],
  ['profile security regression verifies contact details remain hidden in the public directory', securityTest.includes('security_invoker=true') && securityTest.includes('NULL::text AS identifier') && securityTest.includes('NULL::text AS phone')],
  ['profile modal shell contains focus management and background isolation primitives', modal.includes('aria-modal') && modal.includes('focus') && modal.includes('inert')]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + name);
  if (!ok) failed++;
}
console.log('PROFILE_UI_ACCEPTANCE=' + (failed ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed) + '/' + checks.length + ')');
if (failed) process.exit(1);
