import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const vault=fs.readFileSync('alwaha-local-vault.js','utf8');
const block=html.match(/function marketCardRequiresInternet\(\{isOnline,localMeshEnabled,distanceKm,localRadiusKm,hasLocalRoute\}\)\s*\{[\s\S]*?\n\s{8}\}/);
assert.ok(block,'market card access policy must be centralized in one pure helper');
const policy=vm.runInNewContext('('+block[0]+')');

const cases=[
  ['online public listing remains interactive', {isOnline:true,localMeshEnabled:false,distanceKm:null,localRadiusKm:15}, false],
  ['online Mesh listing inside free radius with a verified route is local', {isOnline:true,localMeshEnabled:true,distanceKm:4.2,localRadiusKm:15,hasLocalRoute:true}, false],
  ['online Mesh listing outside free radius needs Internet', {isOnline:true,localMeshEnabled:true,distanceKm:15.1,localRadiusKm:15,hasLocalRoute:true}, true],
  ['offline without Mesh cannot interact with cached listings', {isOnline:false,localMeshEnabled:false,distanceKm:2,localRadiusKm:15}, true],
  ['offline Mesh listing inside free radius and with a verified route remains available', {isOnline:false,localMeshEnabled:true,distanceKm:14.9,localRadiusKm:15,hasLocalRoute:true}, false],
  ['inside the configured radius without a pinned reachable seller still requires Internet', {isOnline:false,localMeshEnabled:true,distanceKm:3,localRadiusKm:15,hasLocalRoute:false}, true],
  ['offline Mesh listing exactly on free-radius edge with a verified route remains available', {isOnline:false,localMeshEnabled:true,distanceKm:15,localRadiusKm:15,hasLocalRoute:true}, false],
  ['offline Mesh listing outside free radius is blocked even if a route exists', {isOnline:false,localMeshEnabled:true,distanceKm:15.01,localRadiusKm:15,hasLocalRoute:true}, true],
  ['unknown coordinates never grant local access even when a route exists', {isOnline:false,localMeshEnabled:true,distanceKm:null,localRadiusKm:15,hasLocalRoute:true}, true],
  ['invalid radius fails closed for an unknown distance', {isOnline:false,localMeshEnabled:true,distanceKm:2,localRadiusKm:0}, true],
  ['a negative distance cannot be trusted', {isOnline:false,localMeshEnabled:true,distanceKm:-1,localRadiusKm:15}, true],
];
for(const [name,args,expected] of cases)assert.equal(policy(args),expected,name);

assert.ok(vault.includes("'market-products'"),'encrypted account-view cache must allow the marketplace listing snapshot');
assert.ok(html.includes("getAccountViewCache?.(viewer.id,'market-products')"),'offline listing reads must be scoped to the signed-in account ID');
assert.ok(html.includes("saveAccountViewCache?.(viewer.id,'market-products',safeSnapshot)"),'only sanitized listing fields are written to the encrypted account cache');
assert.ok(html.includes('تعرض الآن قائمة السوق المحفوظة سابقاً لهذا الحساب'),'cached marketplace view must be clearly identified as previously stored');
assert.ok(html.includes('data-local-internet-required=')&&html.includes('aria-disabled="true" title="يحتاج اتصالاً بالإنترنت"'),'remote listings must be non-interactive where Internet is required');
assert.ok(html.includes('marketCardRequiresInternet({isOnline:navigator.onLine!==false,localMeshEnabled,distanceKm:productDistanceKm,localRadiusKm,hasLocalRoute})'),'every card uses the tested radius, connectivity and verified-route policy');
assert.ok(html.includes('canRouteToAccounts')&&html.includes('locallyReachableSellerIds.has(String(prod.seller_id||\'\'))'),'local cards require a trusted, connected route to the listing owner');

console.log('MARKETPLACE_OFFLINE_CACHE_RUNTIME=PASS ('+cases.length+' range/connectivity cases + encrypted account isolation checks)');
