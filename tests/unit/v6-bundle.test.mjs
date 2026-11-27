import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');

describe('Production Bundle Invariants (v6.0.0)', () => {
  it('dist/ exists with PWA manifest, service worker, and split lazy chunks', () => {
    assert.equal(fs.existsSync(path.join(distDir, 'index.html')), true);
    assert.equal(fs.existsSync(path.join(distDir, 'sw.js')), true);
    assert.equal(fs.existsSync(path.join(distDir, 'manifest.webmanifest')), true);

    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    assert.ok(jsFiles.some((f) => f.startsWith('LiveMap-')), 'LiveMap should be a lazy chunk');
    assert.ok(jsFiles.some((f) => f.startsWith('Nomina-')), 'Nomina should be a lazy chunk');
    assert.ok(jsFiles.some((f) => f.startsWith('CommercialPortal-')), 'CommercialPortal should be a lazy chunk');
    assert.ok(jsFiles.some((f) => f.startsWith('Settings-')), 'Settings should be a lazy chunk');
  });

  it('all 4 Face ID model manifests including SSD MobileNet v1 are present in dist/models', () => {
    const modelsDir = path.join(distDir, 'models');
    for (const file of [
      'ssd_mobilenetv1_model-weights_manifest.json',
      'tiny_face_detector_model-weights_manifest.json',
      'face_landmark_68_model-weights_manifest.json',
      'face_recognition_model-weights_manifest.json',
    ]) {
      assert.equal(fs.existsSync(path.join(modelsDir, file)), true, `Missing model manifest: ${file}`);
    }
  });

  it('production JS contains zero hardcoded (r43), zero __ZUSTAND_STORE__ leak, zero MSAL/SharePoint, and zero "Tomar Foto" button', () => {
    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    let combined = '';
    for (const f of jsFiles) {
      combined += fs.readFileSync(path.join(assetsDir, f), 'utf8');
    }

    assert.equal(combined.includes('(r43)'), false, 'Bundle must not contain hardcoded (r43)');
    assert.equal(combined.includes('__ZUSTAND_STORE__'), false, 'Production bundle must not expose __ZUSTAND_STORE__');
    assert.equal(combined.includes('PublicClientApplication'), false, 'MSAL must be completely removed');
    assert.equal(combined.includes('Tomar Foto'), false, 'Manual Tomar Foto button must be removed');
    assert.equal(combined.includes('6.0.0'), true, 'Bundle must embed version 6.0.0');
  });
});
