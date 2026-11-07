import * as THREE from '../vendor/three/three.module.min.js';
import {temperatureIndicatorColor,temperatureIndicatorWeights} from './compare-temperature-color.js';

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
    this.boilingVisual = null;
    this.platformHeat = 0;
    this.platformEmissive = [];
    this.platformHeatOverlays = [];
    this.platformHeatColor = new THREE.Color('#e8f0ee');
    this.heaterLight = new THREE.PointLight('#e8f0ee', 0, 2.6);
    this.scene.add(this.heaterLight);
  }

  async enableBoiling(){
    if(this.disposed)return false;
    if(this.boilingVisual)return true;
    const {ComparisonBoilingVisual}=await import('./compare-boiling-vfx.js');
    if(this.disposed)return false;
    this.boilingVisual=new ComparisonBoilingVisual(this);
    return true;
  }

  updateBoiling(physics,snapshots,indexById,dt,activeId,phaseAppearanceById){
    this.boilingVisual?.update(physics,snapshots,indexById,dt,activeId,phaseAppearanceById);
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.camera.left = -width / 200;
    this.camera.right = width / 200;
    this.camera.top = height / 200;
    this.camera.bottom = -height / 200;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.heaterLight.position.set(0, height * .07 / 100 - .06, .35);
    if (this.model) this.positionModel();
  }

  positionModel() {
    if (!this.model) return;
    const { base, fit } = this.model;
    base.scale.setScalar(fit);
    // The Blender pedestal's top faces +Y in glTF. Tilt it towards the viewer
    // instead of accidentally exposing its underside.
    base.rotation.set(0.92, 0, 0);
    base.position.set(0, this.height * (0.5 - 0.43) / 100 - 0.42, -0.62);
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
    // The authored pedestal has a dedicated emissive texture for its white
    // illuminated arcs and dots. Change the light color, not the dark body.
    const glowing = new Set();
    base.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material?.emissiveMap && material.emissive && !glowing.has(material)) glowing.add(material);
      }
    });
    this.platformEmissive = [...glowing].map(material => ({
      material, neutral: material.emissive.clone(), intensity: material.emissiveIntensity,
    }));
    // Emissive PBR pixels washed out against the white lamp texture under
    // filmic tone mapping. A second mesh uses the *same authored emissive UV*
    // but stays tone-map-free, so temperature-dependent colors remain clear.
    const heatedMeshes = [];
    base.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material) || !object.material?.emissiveMap) return;
      heatedMeshes.push(object);
    });
    for (const mesh of heatedMeshes) {
      const overlay = mesh.clone(false);
      overlay.name = 'compare-heater-emission-overlay';
      overlay.material = new THREE.MeshBasicMaterial({
        map: mesh.material.emissiveMap, color: '#e8f0ee',
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthTest: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        toneMapped: false,
      });
      overlay.renderOrder = mesh.renderOrder + 1;
      mesh.parent.add(overlay);
      this.platformHeatOverlays.push(overlay);
    }
    this.applyPlatformHeat();
    base.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty();
    base.traverse(object => {
      if (object.isMesh && object.visible) box.union(new THREE.Box3().setFromObject(object));
    });
    const size = box.getSize(new THREE.Vector3());
    const width = Math.max(size.x, size.z, 0.01);
    const fit = 2.15 / width;
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

  applyPlatformHeat() {
    const brightness = THREE.MathUtils.smoothstep(this.platformHeat, 0.03, 0.95);
    for (const {material, neutral, intensity} of this.platformEmissive) {
      material.emissive.copy(neutral).lerp(this.platformHeatColor, brightness);
      // Reduce the original neutral-white lamp so it cannot dilute the overlay.
      material.emissiveIntensity = intensity * (1 - brightness * 0.72);
    }
    for (const overlay of this.platformHeatOverlays) {
      overlay.material.color.copy(this.platformHeatColor);
      overlay.material.opacity = brightness * 0.97;
    }
    this.heaterLight.color.copy(this.platformHeatColor);
    this.heaterLight.intensity = 6 * brightness;
  }

  setBoilingHeat({temperature,phase,progress} = {}, dt = 1 / 60) {
    const active = Number.isFinite(temperature) && (phase === 'heating' || phase === 'boiling');
    const desired = active ? THREE.MathUtils.clamp(0.25 + 0.75 * (progress || 0), 0, 1) : 0;
    const rate = desired > this.platformHeat ? 8 : 2.8;
    const fraction = 1 - Math.exp(-rate * THREE.MathUtils.clamp(dt, 0, 0.05));
    this.platformHeat += (desired - this.platformHeat) * fraction;
    if (active) this.platformHeatColor.lerp(new THREE.Color(temperatureIndicatorColor(temperature)), fraction);
    this.applyPlatformHeat();
  }

  toWorld(point) {
    return new THREE.Vector3((point.x - this.width / 2) / 100,
      (this.height / 2 - point.y) / 100,
      0.20 + point.z / 130);
  }

  draw(physics, focusIndex) {
    if (this.disposed || !this.width || !this.height) return;
    const grabbedIndex = physics.grabbed?.index ?? physics.docking?.index ?? focusIndex;
    const from = Math.max(0, Math.min(focusIndex, grabbedIndex) - 5);
    const to = Math.min(physics.arcPositions.length - 1, Math.max(focusIndex, grabbedIndex) + 5);
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
    this.boilingVisual?.dispose();
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

// Accessibility/fallback surface for cloud browsers and older phones where a
// WebGL context cannot be created. Geometry still follows the same PBD rope;
// a rendered image of the licensed model replaces only its static stage mesh.
export class ComparisonRopeCanvas {
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.ownerDocument.createElement('canvas');
    this.canvas.className = 'compare-physics-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.context = this.canvas.getContext('2d');
    if (!this.context) throw new Error('No drawing context for comparison');
    this.platform = stage.ownerDocument.createElement('img');
    this.platform.className = 'compare-pedestal-fallback';
    this.platform.alt = '';
    this.platform.src = new URL('../assets/compare/pedestal-preview.png', import.meta.url).href;
    this.platformHeat = 0;
    this.platformTemperature = 25;
    this.platformColdImage = this.platform.cloneNode(false);
    this.platformColdImage.classList.add('compare-pedestal-heated');
    this.platformColdImage.style.opacity = '0';
    this.platformColdImage.style.filter = 'sepia(1) saturate(7) hue-rotate(148deg) contrast(1.2) brightness(1.1) drop-shadow(0 0 12px #35bdfc)';
    this.platformHeatImage = this.platform.cloneNode(false);
    this.platformHeatImage.classList.add('compare-pedestal-heated');
    this.platformHeatImage.style.opacity = '0';
    this.platformHeatImage.style.filter = 'sepia(1) saturate(8) hue-rotate(-35deg) contrast(1.18) brightness(1.1) drop-shadow(0 0 12px #ff5822)';
    stage.prepend(this.platform, this.platformColdImage, this.platformHeatImage);
    stage.prepend(this.canvas);
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.ratio = Math.min(1.6, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.ratio);
    this.canvas.height = Math.round(height * this.ratio);
    this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
  }

  async loadPlatform() { return 'preferred'; }

  setBoilingHeat({temperature,phase,progress} = {}, dt = 1 / 60) {
    const active = Number.isFinite(temperature) && (phase === 'heating' || phase === 'boiling');
    const desired = active ? Math.max(0, Math.min(1, .25 + .75 * (progress || 0))) : 0;
    const speed = desired > this.platformHeat ? 8 : 2.8;
    const fraction = 1 - Math.exp(-speed * Math.max(0, Math.min(.05, dt)));
    this.platformHeat += (desired - this.platformHeat) * fraction;
    if (active) this.platformTemperature += (temperature - this.platformTemperature) * fraction;
    const {cold,warm} = temperatureIndicatorWeights(this.platformTemperature);
    this.platformColdImage.style.opacity = Math.min(1, this.platformHeat * cold * 1.2).toFixed(3);
    this.platformHeatImage.style.opacity = Math.min(1, this.platformHeat * warm * 1.2).toFixed(3);
  }

  draw(physics, focusIndex) {
    const ctx = this.context;
    if (!this.width || !this.height) return;
    ctx.clearRect(0, 0, this.width, this.height);
    const grabbedIndex = physics.grabbed?.index ?? physics.docking?.index ?? focusIndex;
    const points = physics.ropePoints(Math.max(0, Math.min(focusIndex, grabbedIndex) - 5), Math.min(physics.arcPositions.length - 1, Math.max(focusIndex, grabbedIndex) + 5));
    if (points.length < 2) return;
    const colors = ['#87c6c8', '#489ba8', '#c0efe1'];
    for (let ply = 0; ply < 3; ply++) {
      ctx.beginPath();
      const offset = i => Math.sin(i * 1.34 + ply * Math.PI * 2 / 3) * 1.5;
      ctx.moveTo(points[0].x, points[0].y + offset(0));
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        ctx.quadraticCurveTo(a.x, a.y + offset(i - 1), (a.x + b.x) / 2, (a.y + b.y) / 2 + offset(i));
      }
      const last = points.at(-1);
      ctx.lineTo(last.x, last.y + offset(points.length - 1));
      ctx.strokeStyle = colors[ply];
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#76dfe2';
      ctx.shadowBlur = 5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  dispose() { this.canvas.remove(); this.platform.remove(); this.platformColdImage.remove(); this.platformHeatImage.remove(); }
}
