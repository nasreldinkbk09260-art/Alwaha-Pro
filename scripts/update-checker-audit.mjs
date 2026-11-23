import assert from 'node:assert/strict';
import {compareVersions,parseReleaseBuild,parseReleaseVersion,selectNewerRelease} from '../alwaha-update-checker.mjs';
assert.equal(compareVersions('3.0.5','3.0.4'),1);assert.equal(compareVersions('3.0.4','3.0.4'),0);assert.equal(compareVersions('3.0.3','3.0.4'),-1);
const r={tag_name:'v3.0.4-beta.1306',draft:false,prerelease:true,body:'Public beta build #1306',assets:[{name:'Alwaha-Pro-Android.apk',browser_download_url:'https://github.com/nasreldinkbk09260-art/Alwaha-Pro/releases/download/v3.0.4-beta.1306/Alwaha-Pro-Android.apk'}]};
assert.equal(parseReleaseVersion(r),'3.0.4');assert.equal(parseReleaseBuild(r),1306);assert.equal(selectNewerRelease([r],'3.0.4',1305).build,1306);assert.equal(selectNewerRelease([r],'3.0.4',1306),null);assert.equal(selectNewerRelease([r],'3.0.5',1),null);
assert.equal(selectNewerRelease([{...r,assets:[{name:'wrong.apk',browser_download_url:'https://github.com/x'}]}],'3.0.4',1),null);assert.equal(selectNewerRelease([{...r,assets:[{name:'Alwaha-Pro-Android.apk',browser_download_url:'http://evil.example/app.apk'}]}],'3.0.4',1),null);
console.log('UPDATE_CHECKER_AUDIT=PASS');
