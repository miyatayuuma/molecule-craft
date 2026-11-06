import * as THREE from '../vendor/three/three.module.min.js';

const COLORS = [0x9fd8d5, 0x569da7, 0xc9e8df];
const ropeRadius = 0.015;

// The rope is drawn in actual lit 3D, not as a 2D polyline or a CSS spring.
// Three thin helically twisted plies borrow the visual language of the MIT
// Tangle reference: https://github.com/mrdoob/codevember-2026/tree/main/04
export class ComparisonRopeScene {
  constructor(stage) {
    this.stage = stage;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 40);
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(1.6, globalThis.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.domElement.className = 'compare-physics-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.prepend(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(0xc3e8ef, 1.5));
    const sunlight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunlight.position.set(-3, 5, 8);
    this.scene.add(sunlight);
    const rim = new THREE.PointLight(0x36b6d5, 9, 10);
    rim.position.set(1.8, -0.8, 2.5);
    this.scene.add(rim);
    this.materials = COLORS.map(color => new THREE.MeshPhysicalMaterial({
      color, roughness: 0.39, metalness: 0.23, sheen: 0.65,
      sheenColor: new THREE.Color(0xd8faf7), clearcoat: 0.12,
    }));
    this.threads = this.materials.map(material => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.model = null;
    this.modelReady = false;
    this.disposed = false;
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.camera.left = -width / 200;
    this.camera.right = width / 200;
    this.camera.top = height / 200;
    this.camera.bottom = -height / 200;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model) this.positionModel();
  }

  positionModel() {
    if (!this.model) return;
    const { base, fit } = this.model;
    base.scale.setScalar(fit);
    base.rotation.set(-0.82, 0, 0);
    base.position.set(0, this.height * (0.5 - 0.43) / 100 - 0.60, -0.62);
  }

  async loadPlatform(url, fallbackUrl) {
    let selected = url;
    let response = await fetch(selected, { method: 'HEAD' });
    if (!response.ok && fallbackUrl) {
      selected = fallbackUrl;
      response = await fetch(selected, { method: 'HEAD' });
    }
    if (!response.ok) return false;
    const { GLTFLoader } = await import('../vendor/three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(selected);
    if (this.disposed) return false;
    const base = gltf.scene;
    // The temporary CC0 hologram projector is used only as a sculpted pedestal.
    // The floating planet would interfere with the focused molecular bead.
    if (selected === fallbackUrl) {
      base.traverse(object => {
        if (object.name?.includes('hologram_glow')) object.visible = false;
        if (object.isMesh && object.name?.includes('body')) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!material) continue;
            material.color?.multiplyScalar(0.38);
            material.metalness = 0.73;
            material.roughness = 0.35;
          }
        }
      });
    }
    base.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty();
    base.traverse(object => {
      if (object.isMesh && object.visible) box.union(new THREE.Box3().setFromObject(object));
    });
    const size = box.getSize(new THREE.Vector3());
    const width = Math.max(size.x, size.z, 0.01);
    const fit = 1.90 / width;
    const center = box.getCenter(new THREE.Vector3());
    base.position.sub(center);
    // Center imported art around an independent transform, retaining its
    // original meshes, UVs, surface materials and authored detail.
    const holder = new THREE.Group();
    holder.add(base);
    this.scene.add(holder);
    this.model = { base: holder, fit };
    this.positionModel();
    this.modelReady = true;
    return selected === fallbackUrl ? 'provisional' : 'preferred';
  }

  toWorld(point) {
    return new THREE.Vector3((point.x - this.width / 2) / 100,
      (this.height / 2 - point.y) / 100,
      0.20 + point.z / 130);
  }

  draw(physics, focusIndex) {
    if (this.disposed || !this.width || !this.height) return;
    const from = Math.max(0, focusIndex - 5), to = Math.min(physics.arcPositions.length - 1, focusIndex + 5);
    const points = physics.ropePoints(from, to).map(point => this.toWorld(point));
    if (points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.15);
    const count = Math.max(25, (points.length - 1) * 5);
    const twist = 12.5;
    const previous = this.threads.map(mesh => mesh.geometry);
    for (let ply = 0; ply < this.threads.length; ply++) {
      const strand = [];
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const center = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
        if (side.lengthSq() < .1) side.set(1, 0, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
        const angle = t * count * twist * .12 + ply * Math.PI * 2 / 3;
        center.addScaledVector(side, Math.cos(angle) * .012);
        center.addScaledVector(normal, Math.sin(angle) * .012);
        strand.push(center);
      }
      this.threads[ply].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strand), count, ropeRadius, 5, false);
    }
    for (const geometry of previous) geometry.dispose();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    for (const mesh of this.threads) mesh.geometry.dispose();
    for (const material of this.materials) material.dispose();
    if (this.model) {
      this.model.base.traverse(object => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
          material.dispose();
        }
      });
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
