import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export const LOAD_TIMEOUT_MS = 8000;

// AssetManager: tải 1 lần, dùng chung. Loader inject được để test trong Node.
export function createAssetManager(opts = {}) {
  const makeLoader = opts.makeLoader || (() => new GLTFLoader());
  const registry = new Map(); // id -> { status, promise, scene, error }
  const progressCbs = new Set();

  function emit(id, loaded, total) {
    for (const cb of progressCbs) cb(id, loaded, total);
  }

  const am = {
    onProgress(cb) {
      progressCbs.add(cb);
      return () => progressCbs.delete(cb);
    },

    loadModel(id, url, { timeoutMs = LOAD_TIMEOUT_MS } = {}) {
      const existing = registry.get(id);
      if (existing) {
        if (existing.status === 'ready') return Promise.resolve(existing.scene);
        return existing.promise;
      }
      const entry = { status: 'loading', promise: null, scene: null, gltf: null, error: null };
      entry.promise = new Promise((resolve, reject) => {
        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          entry.status = 'error';
          entry.error = new Error(`AssetTimeout: ${id}`);
          reject(entry.error);
        }, timeoutMs);
        const loader = makeLoader();
        const onLoad = (gltf) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          entry.status = 'ready';
          entry.scene = gltf.scene;
          entry.gltf = gltf;
          emit(id, 1, 1);
          resolve(gltf.scene);
        };
        const onError = (err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          entry.status = 'error';
          entry.error = err instanceof Error ? err : new Error(`AssetFailed: ${id}`);
          reject(entry.error);
        };
        try {
          // Cùng chữ ký callback như GLTFLoader: load(url, onLoad, onProgress, onError)
          loader.load(url, onLoad, (ev) => {
            if (ev && ev.total) emit(id, ev.loaded, ev.total);
          }, onError);
        } catch (err) {
          onError(err);
        }
      });
      registry.set(id, entry);
      return entry.promise;
    },

    getModel(id) {
      const e = registry.get(id);
      return e && e.status === 'ready' ? e.scene : null;
    },

    getClips(id) {
      const e = registry.get(id);
      return e && e.status === 'ready' && e.gltf ? e.gltf.animations || [] : [];
    },

    cloneModel(id) {
      const src = am.getModel(id);
      if (!src) throw new Error(`cloneModel: ${id} not ready`);
      let skinned = false;
      src.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
      return skinned ? skeletonClone(src) : src.clone(true);
    },

    async loadTexture(id, url) {
      const existing = registry.get(id);
      if (existing) {
        if (existing.status === 'ready') return existing.scene;
        return existing.promise;
      }
      // Texture: dùng ImageBitmap/fetch, cache chung registry
      const entry = { status: 'loading', promise: null, scene: null, error: null };
      entry.promise = (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TextureFailed: ${id} ${res.status}`);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        entry.status = 'ready';
        entry.scene = bmp;
        return bmp;
      })().catch((err) => {
        entry.status = 'error';
        entry.error = err;
        throw err;
      });
      registry.set(id, entry);
      return entry.promise;
    },

    getTexture(id) {
      const e = registry.get(id);
      return e && e.status === 'ready' ? e.scene : null;
    },

    dispose(id) {
      const e = registry.get(id);
      if (!e || !e.scene) {
        registry.delete(id);
        return;
      }
      e.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          if (m.dispose) m.dispose();
        }
      });
      registry.delete(id);
    },

    status(id) {
      const e = registry.get(id);
      return e ? e.status : 'missing';
    },
  };

  return am;
}
