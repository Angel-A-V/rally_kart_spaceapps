// The 3D Moon with the sites marked on it. Uses three.js.
// The surface picture is NASA's LRO wide-angle camera mosaic, loaded live from Moon Trek's tile
// service. The stars are decoration (random points), not a real star map.
//
// createGlobe(container, sites, handlers) draws into `container` and returns
// { select, flyTo, setView, setPin, addSite, removeSite, markPending }. See app/CLAUDE.md.
//   sites      the sites index (id, label, lat_deg, lon_deg_east, is_model_site)
//   handlers   { onSelect(siteId), onPick(lat, lon), onContext(lat, lon, x, y), onHover(lat, lon | null) }
//              onSelect: a marker was clicked; onPick: bare surface was clicked; onContext: right-click
//              or long press on the surface (x, y = screen position for a menu); onHover: cursor moved.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LAYERS, detailWindow, flightPoint, latLonToXyz, tileGrid, tileUrl, xyzToLatLon } from "./geo.js";
import { isOnNearHalf, minDiameterKm } from "./features.js";

const TILE_PX = 256;
const SURFACE_ZOOM = 3;      // 16 x 8 tiles = a 4096 x 2048 picture
const PREVIEW_ZOOM = 1;      // 4 x 2 tiles, shown first while the sharper ones arrive
const MARKER_RADIUS = 0.004; // on a Moon of radius 1 (about 7 km)
const COLORS = { named: 0x3987e5, model: 0xeb6834, custom: 0x2fbf71, pending: 0xffd23f, selected: 0xffffff };
const FLY_MS = 1400;          // length of a fly-to
const MAX_FEATURE_LABELS = 60; // official feature names on screen at once
const SITE_DISTANCE = 1.55;   // camera distance from the Moon's centre after flying to a site (radius 1)
const LONG_PRESS_MS = 550;    // touch: hold this long for the context menu
// Which label wins when two would overlap.
const labelRank = (m, selectedId) =>
  (m.site.id === selectedId ? 100 : 0) + (m.site.is_model_site ? 10 : 0) + (m.site.id.startsWith("custom_") ? 5 : 0);
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out cubic


// Points you picked or typed in have ids starting with "custom_" (made by the backend).
const colorFor = (site) =>
  site.is_model_site ? COLORS.model : site.id.startsWith("custom_") ? COLORS.custom : COLORS.named;

// Paint Moon Trek tiles onto one big canvas that three.js uses as the Moon's surface.
function loadSurface(texture, canvas, layer = "photo", isCurrent = () => true) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#6f6f6f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const draw = (zoom) => {
    const { cols, rows } = tileGrid(zoom);
    const size = canvas.width / cols; // on-canvas size of one tile at this zoom
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Moon Trek allows this (Access-Control-Allow-Origin: *)
        img.onload = () => {
          if (!isCurrent()) return; // the layer was switched while this tile was on its way
          ctx.drawImage(img, col * size, row * size, size, size);
          texture.needsUpdate = true;
        };
        img.src = tileUrl(zoom, row, col, layer);
      }
    }
  };
  draw(PREVIEW_ZOOM);
  draw(SURFACE_ZOOM);
}

function makeStars() {
  const positions = [];
  for (let i = 0; i < 1500; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * 2 * Math.PI;
    const s = Math.sqrt(1 - u * u);
    positions.push(60 * s * Math.cos(t), 60 * u, 60 * s * Math.sin(t));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false }));
}

export function createGlobe(container, sites, handlers = {}) {
  const { onSelect = () => {}, onPick = null, onContext = null, onHover = null } = handlers;
  const width = () => container.clientWidth || 600;
  const height = () => container.clientHeight || 440;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(makeStars());

  const camera = new THREE.PerspectiveCamera(40, width() / height(), 0.01, 200);

  // The Moon: a sphere of radius 1 with the picture wrapped around it. It is drawn unlit
  // (no pretend Sun), so every part of the surface can be seen.
  const canvas = document.createElement("canvas");
  canvas.width = tileGrid(SURFACE_ZOOM).cols * TILE_PX;
  canvas.height = tileGrid(SURFACE_ZOOM).rows * TILE_PX;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  let layer = "photo";
  let surfaceToken = 0;
  loadSurface(texture, canvas);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(moon);

  // Sharper picture for the area in view: a patch of higher-zoom Moon Trek tiles laid just above the
  // base picture, reloaded whenever the camera comes to rest somewhere new (geo.js detailWindow).
  let patch = null;       // { mesh, key }
  let patchToken = 0;
  const updatePatch = () => {
    const d = camera.position.length();
    const [x, y, z] = camera.position.toArray();
    const under = xyzToLatLon(x, y, z);
    // Degrees of Moon from the centre of the view to its corner, with a margin.
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const reach = Math.hypot(Math.tan(halfV), Math.tan(halfV) * camera.aspect) * (d - 1);
    const viewDeg = Math.min(60, THREE.MathUtils.radToDeg(reach) * 1.25);
    const win = d > 2.8 ? null
      : detailWindow(under.lat, ((under.lon + 180) % 360 + 360) % 360 - 180, viewDeg, { maxZoom: LAYERS[layer].maxZoom });
    const key = win ? [layer, win.zoom, win.row0, win.rows, win.col0, win.cols].join("/") : `none/${layer}`;
    if (patch && patch.key === key) return;
    const token = ++patchToken;
    const old = patch;
    const drop = () => {
      if (!old?.mesh) return;
      scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.map.dispose();
      old.mesh.material.dispose();
    };
    if (!win) {
      drop();
      patch = { key, mesh: null };
      return;
    }
    const pc = document.createElement("canvas");
    pc.width = win.cols * win.tileW;
    pc.height = win.rows * TILE_PX;
    const ctx = pc.getContext("2d");
    // Start from the base picture stretched over the patch, so nothing flashes while tiles arrive.
    const perDeg = canvas.width / 360;
    const sy = (90 - win.latN) * (canvas.height / 180);
    const sh = (win.latN - win.latS) * (canvas.height / 180);
    const span = win.lonE - win.lonW;
    for (let done = 0; done < span;) {
      const lon = ((win.lonW + done + 180) % 360 + 360) % 360;   // 0..360 from the picture's left edge
      const part = Math.min(span - done, 360 - lon);
      ctx.drawImage(canvas, lon * perDeg, sy, part * perDeg, sh, (done / span) * pc.width, 0, (part / span) * pc.width, pc.height);
      done += part;
    }
    const tex = new THREE.CanvasTexture(pc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const rad = THREE.MathUtils.degToRad;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.0006, Math.min(256, win.cols * 4), Math.max(8, win.rows * 6),
        rad(win.lonW + 180), rad(span), rad(90 - win.latN), rad(win.latN - win.latS)),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    scene.add(mesh);
    patch = { key, mesh };
    drop();
    const total = tileGrid(win.zoom).cols;
    for (let r = 0; r < win.rows; r++) {
      for (let c = 0; c < win.cols; c++) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (token !== patchToken) return; // the view moved on
          ctx.drawImage(img, c * win.tileW, r * TILE_PX, win.tileW, TILE_PX);
          tex.needsUpdate = true;
        };
        img.src = tileUrl(win.zoom, win.row0 + r, ((win.col0 + c) % total + total) % total, layer);
      }
    }
  };
  let restAt = 0;
  const lastCam = new THREE.Vector3();
  // Swap the picture the Moon wears ("photo" or "lola"): reload the base picture and the sharp patch.
  const setLayer = (name) => {
    if (!LAYERS[name] || name === layer) return;
    layer = name;
    const token = ++surfaceToken;
    loadSurface(texture, canvas, layer, () => token === surfaceToken);
    restAt = performance.now() + 900; // let the base picture arrive, then refresh the patch
    if (patch?.mesh) patch.mesh.visible = false;
  };

  // Site markers: a small dot to see, and a bigger invisible ball around it that is easier to click.
  const markers = [];
  const hitTargets = [];
  const labelLayer = document.createElement("div");
  labelLayer.className = "globe-labels";
  container.appendChild(labelLayer);
  const addSite = (site) => {
    if (markers.some((m) => m.site.id === site.id)) return;
    const position = new THREE.Vector3(...latLonToXyz(site.lat_deg, site.lon_deg_east, 1.003));
    // A dot with a ring around it that always faces the viewer (round at every angle). It is drawn
    // over the Moon without a depth test, so it never sinks into the surface; the frame loop hides
    // it when its site is on the far side.
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(MARKER_RADIUS * 0.5, 24),
      new THREE.MeshBasicMaterial({ color: colorFor(site), depthTest: false })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(MARKER_RADIUS * 0.8, MARKER_RADIUS, 32),
      new THREE.MeshBasicMaterial({ color: colorFor(site), transparent: true, opacity: 0.75, depthTest: false })
    );
    dot.renderOrder = 10;
    ring.renderOrder = 10;
    dot.add(ring);
    dot.position.copy(position);
    scene.add(dot);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(MARKER_RADIUS * 2.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(position);
    hit.userData.siteId = site.id;
    scene.add(hit);
    hitTargets.push(hit);
    const label = document.createElement("span");
    label.className = "globe-label";
    label.textContent = site.label;
    labelLayer.appendChild(label);
    markers.push({ site, dot, hit, label, position });
  };
  for (const site of sites) addSite(site);

  // Official feature names (IAU), shown by size and zoom. A small pool of label elements is reused.
  let features = [];
  const featureLabels = [];
  const setFeatures = (list) => (features = list || []);
  const featureLabel = (i) => {
    if (!featureLabels[i]) {
      const el = document.createElement("span");
      el.className = "feature-label";
      labelLayer.appendChild(el);
      featureLabels[i] = el;
    }
    return featureLabels[i];
  };

  // A yellow dot where you clicked, shown while the backend works out that point.
  const pendingDot = new THREE.Mesh(
    new THREE.SphereGeometry(MARKER_RADIUS * 1.3, 16, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.pending })
  );
  pendingDot.visible = false;
  scene.add(pendingDot);
  const markPending = (lat, lon) => {
    if (lat === null) {
      pendingDot.visible = false;
      return;
    }
    pendingDot.position.set(...latLonToXyz(lat, lon, 1.003));
    pendingDot.visible = true;
  };

  // A pulsing ring lying flat on the surface: marks the selected site or a clicked point.
  const pin = new THREE.Mesh(
    new THREE.RingGeometry(MARKER_RADIUS * 1.6, MARKER_RADIUS * 2.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  pin.visible = false;
  scene.add(pin);

  // Day and night: a see-through dark shell over the half of the Moon facing away from the Sun.
  // The Sun's direction comes from NASA JPL Horizons (main.js, via geo.js sunDirection).
  const night = new THREE.Mesh(
    new THREE.SphereGeometry(1.0015, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { sunDir: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      // Soft edge about 6 degrees wide: the Sun is a disc and the ground is rough, so day fades into night.
      fragmentShader: "uniform vec3 sunDir; varying vec3 vDir; void main() { float lit = smoothstep(-0.04, 0.07, dot(normalize(vDir), sunDir)); gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - lit) * 0.62); }",
    })
  );
  night.visible = false;
  scene.add(night);
  const setSun = (dir) => {
    night.visible = Boolean(dir);
    if (dir) night.material.uniforms.sunDir.value.set(...dir).normalize();
  };
  const setPin = (lat, lon) => {
    if (lat === null || lat === undefined) {
      pin.visible = false;
      return;
    }
    const p = new THREE.Vector3(...latLonToXyz(lat, lon, 1.004));
    pin.position.copy(p);
    pin.lookAt(p.clone().multiplyScalar(2)); // face outward, so the ring lies on the ground
    pin.visible = true;
  };

  let inset = { right: 0, bottom: 0 }; // space covered by panels (see setInset)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 1.06;
  controls.maxDistance = 8;

  // Camera flights. While flying, the mouse does not steer; the frame loop moves the camera.
  let flight = null;
  const flyToXyz = (target) => {
    const to = target.map(Number);
    if (reducedMotion()) {
      camera.position.set(...to);
      controls.update();
      return;
    }
    flight = { from: camera.position.toArray(), to, start: performance.now() };
    controls.enabled = false;
  };
  const flyTo = (lat, lon, distance = SITE_DISTANCE) => flyToXyz(latLonToXyz(lat, lon, distance));

  // Distance at which the whole Moon fits in the free part of the window (beside or above any panel),
  // with room for the bars: the Moon's disc takes about 70 % of the smaller free dimension.
  const fitDistance = () => {
    const w = width();
    const h = height();
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const freeV = Math.atan(Math.tan(halfV) * Math.max(0.3, (h - inset.bottom) / h));
    const freeH = Math.atan(Math.tan(halfV) * (Math.max(0.3 * w, w - inset.right) / h));
    return Math.min(controls.maxDistance, 1 / Math.sin(Math.min(freeV, freeH) * 0.7));
  };
  const POLE_DISTANCE = 1.9; // shows about 20 degrees of latitude around the pole
  const views = {
    near: () => [0, 0, fitDistance()],      // the side that always faces Earth
    far: () => [0, 180, fitDistance()],
    pole: () => [-89.9, 0, POLE_DISTANCE],  // straight above the south pole (0.1 deg off keeps "up" defined)
    north: () => [89.9, 0, POLE_DISTANCE],
    moon: () => [-20, 20, fitDistance()],   // tilted a little towards the south pole, where most sites are
  };
  const setView = (name, animate = true) => {
    const [lat, lon, d] = views[name]();
    if (animate) return flyTo(lat, lon, d);
    camera.position.set(...latLonToXyz(lat, lon, d));
    controls.update();
  };
  setView("moon", false); // the sites span the whole Moon (Apollo sites and both poles)

  let selectedId = null;
  const select = (siteId) => {
    selectedId = siteId;
    for (const m of markers) {
      const on = m.site.id === siteId;
      m.dot.material.color.setHex(on ? COLORS.selected : colorFor(m.site));
      m.dot.children[0].material.color.setHex(on ? COLORS.selected : colorFor(m.site));
      m.label.classList.toggle("selected", on);
    }
  };

  // Clicking: a marker selects that site; bare surface picks that point (any point on the Moon).
  // A drag (rotating the Moon) is not a click.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const aim = (event) => {
    const box = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const siteUnder = (event) => {
    aim(event);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object.userData.siteId : null;
  };
  const pointUnder = (event) => {
    aim(event);
    const hits = raycaster.intersectObject(moon, false);
    return hits.length ? xyzToLatLon(hits[0].point.x, hits[0].point.y, hits[0].point.z) : null;
  };
  let downAt = null;
  let pressTimer = null;
  let pressed = false; // a long press already opened the menu: do not also count it as a click
  const cancelPress = () => clearTimeout(pressTimer);
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downAt = [e.clientX, e.clientY];
    pressed = false;
    if (e.pointerType === "touch" && onContext) {
      cancelPress();
      pressTimer = setTimeout(() => {
        const point = pointUnder(e);
        if (point) {
          pressed = true;
          onContext(point.lat, point.lon, e.clientX, e.clientY);
        }
      }, LONG_PRESS_MS);
    }
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    cancelPress();
    if (e.button !== 0 || pressed || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const id = siteUnder(e);
    if (id) return onSelect(id);
    const point = onPick ? pointUnder(e) : null;
    if (point) onPick(point.lat, point.lon);
  });
  renderer.domElement.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // our own menu instead of the browser's
    const point = onContext ? pointUnder(e) : null;
    if (point) onContext(point.lat, point.lon, e.clientX, e.clientY);
  });
  // Hover: cursor shape and the coordinate readout. Checked at most once per frame.
  let hoverEvent = null;
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) cancelPress();
    hoverEvent = e;
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    hoverEvent = null;
    if (onHover) onHover(null);
  });
  const updateHover = () => {
    if (!hoverEvent) return;
    const e = hoverEvent;
    hoverEvent = null;
    const site = siteUnder(e);
    const point = pointUnder(e);
    renderer.domElement.style.cursor = site ? "pointer" : point ? "crosshair" : "grab";
    if (onHover) onHover(point ? point.lat : null, point ? point.lon : null);
  };

  // Panels over the canvas: shift the view so the Moon centres in the free space beside them.
  const applyInset = () => {
    const w = width();
    const h = height();
    if (inset.right > 0 || inset.bottom > 0) camera.setViewOffset(w, h, inset.right / 2, inset.bottom / 2, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  // rightPx: a panel on the right (desktop); bottomPx: a bottom sheet (phones).
  const setInset = (rightPx = 0, bottomPx = 0) => {
    inset = { right: Math.max(0, rightPx), bottom: Math.max(0, bottomPx) };
    applyInset();
  };
  const resize = () => {
    renderer.setSize(width(), height());
    camera.aspect = width() / height();
    applyInset();
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(container);

  const toCamera = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const frame = (now = performance.now()) => {
    if (flight) {
      const t = Math.min(1, (now - flight.start) / FLY_MS);
      camera.position.set(...flightPoint(flight.from, flight.to, ease(t)));
      camera.lookAt(0, 0, 0);
      if (t >= 1) {
        flight = null;
        controls.enabled = true;
      }
    }
    controls.update();
    updateHover();
    // Camera at rest for a moment (and not mid-flight): load sharper tiles for this view.
    if (camera.position.distanceToSquared(lastCam) > 1e-10) {
      lastCam.copy(camera.position);
      restAt = now + 300;
    } else if (restAt && now >= restAt && !flight) {
      restAt = 0;
      updatePatch();
    }
    if (pin.visible) {
      const k = reducedMotion() ? 0 : (now % 1600) / 1600; // one pulse every 1.6 s
      const s = Math.min(6, Math.max(0.35, (camera.position.length() - 1) / 0.5));
      pin.scale.setScalar(s * (1 + 0.8 * k));
      pin.material.opacity = 0.9 * (1 - k * 0.85);
    }
    // Keep markers a steady size on screen as you zoom, and put each name next to its dot.
    const scale = Math.min(5, Math.max(0.3, (camera.position.length() - 1) / 0.6));
    pendingDot.scale.setScalar(scale);
    // Labels: most important first (selected, model site, your points), and a label that would
    // overlap one already placed is hidden, so names never pile on top of each other.
    const placed = [];
    const ordered = [...markers].sort((a, b) => labelRank(b, selectedId) - labelRank(a, selectedId));
    for (const m of ordered) {
      const s = m.site.id === selectedId ? scale * 1.5 : scale;
      m.dot.scale.setScalar(s);
      m.hit.scale.setScalar(scale);
      toCamera.copy(camera.position).sub(m.position);
      const facing = toCamera.dot(m.position) > 0; // false when the site is on the far side
      m.dot.visible = facing;
      m.dot.quaternion.copy(camera.quaternion);     // face the viewer
      projected.copy(m.position).project(camera);
      const x = ((projected.x + 1) / 2) * width();
      const y = ((1 - projected.y) / 2) * height();
      const box = { x0: x + 8, x1: x + 14 + m.label.textContent.length * 7, y0: y - 9, y1: y + 9 };
      const free = facing && !placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
      m.label.style.display = free ? "" : "none";
      if (free) {
        placed.push(box);
        m.label.style.left = `${x}px`;
        m.label.style.top = `${y}px`;
      }
    }
    // Feature names: biggest first, only on the near half and on screen, never over another label.
    const camPos = camera.position.toArray();
    const minD = minDiameterKm(camera.position.length());
    let used = 0;
    for (const f of features) {
      if (used >= MAX_FEATURE_LABELS || f.d < minD) break; // the list is sorted biggest first
      if (!isOnNearHalf(f.pos, camPos)) continue;
      projected.set(...f.pos).project(camera);
      if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
      const x = ((projected.x + 1) / 2) * width();
      const y = ((1 - projected.y) / 2) * height();
      const half = (f.name.length * (f.big ? 9 : 6.5)) / 2 + 4;
      const box = { x0: x - half, x1: x + half, y0: y - 9, y1: y + 9 };
      if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      const el = featureLabel(used++);
      if (el.textContent !== f.name) {
        el.textContent = f.name;
        el.classList.toggle("big", f.big);
      }
      el.style.display = "";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    for (let i = used; i < featureLabels.length; i++) featureLabels[i].style.display = "none";
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  frame();

  // Take a marker off the Moon (used for points you added yourself).
  const removeSite = (siteId) => {
    const i = markers.findIndex((m) => m.site.id === siteId);
    if (i < 0) return;
    const m = markers[i];
    scene.remove(m.dot, m.hit);
    m.dot.children[0].geometry.dispose();
    m.dot.children[0].material.dispose();
    m.dot.geometry.dispose();
    m.dot.material.dispose();
    m.hit.geometry.dispose();
    m.hit.material.dispose();
    m.label.remove();
    markers.splice(i, 1);
    hitTargets.splice(hitTargets.indexOf(m.hit), 1);
    if (selectedId === siteId) selectedId = null;
  };

  return { select, flyTo, setView, setPin, setInset, setFeatures, setSun, setLayer, addSite, removeSite, markPending };
}
