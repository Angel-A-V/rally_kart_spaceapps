// The 3D Moon with the sites marked on it. Uses three.js.
// The surface picture is NASA's LRO wide-angle camera mosaic, loaded live from Moon Trek's tile
// service. The stars are decoration (random points), not a real star map.
//
// createGlobe(container, sites, onSelect, onPick) draws into `container` and returns
// { select, setView, addSite, removeSite, markPending }.
//   sites      the sites index (id, label, lat_deg, lon_deg_east, is_model_site)
//   onSelect   called with a site id when a marker is clicked
//   onPick     called with (lat, lon) when bare Moon surface is clicked (any point on the Moon)
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { latLonToXyz, tileGrid, tileUrl, xyzToLatLon } from "./geo.js";

const TILE_PX = 256;
const SURFACE_ZOOM = 3;      // 16 x 8 tiles = a 4096 x 2048 picture
const PREVIEW_ZOOM = 1;      // 4 x 2 tiles, shown first while the sharper ones arrive
const MARKER_RADIUS = 0.004; // on a Moon of radius 1 (about 7 km)
const COLORS = { named: 0x3987e5, model: 0xeb6834, custom: 0x2fbf71, pending: 0xffd23f, selected: 0xffffff };

// Points you picked or typed in have ids starting with "custom_" (made by the backend).
const colorFor = (site) =>
  site.is_model_site ? COLORS.model : site.id.startsWith("custom_") ? COLORS.custom : COLORS.named;

// Paint Moon Trek tiles onto one big canvas that three.js uses as the Moon's surface.
function loadSurface(texture, canvas) {
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
          ctx.drawImage(img, col * size, row * size, size, size);
          texture.needsUpdate = true;
        };
        img.src = tileUrl(zoom, row, col);
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

export function createGlobe(container, sites, onSelect, onPick = null) {
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
  loadSurface(texture, canvas);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(moon);

  // Site markers: a small dot to see, and a bigger invisible ball around it that is easier to click.
  const markers = [];
  const hitTargets = [];
  const labelLayer = document.createElement("div");
  labelLayer.className = "globe-labels";
  container.appendChild(labelLayer);
  const addSite = (site) => {
    if (markers.some((m) => m.site.id === site.id)) return;
    const position = new THREE.Vector3(...latLonToXyz(site.lat_deg, site.lon_deg_east, 1.003));
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(MARKER_RADIUS, 16, 12),
      new THREE.MeshBasicMaterial({ color: colorFor(site) })
    );
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

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 1.06;
  controls.maxDistance = 6;

  const views = {
    // Hovering over the south pole region, where all the sites are.
    pole: () => camera.position.set(...latLonToXyz(-82, 20, 1.5)),
    moon: () => camera.position.set(...latLonToXyz(-25, 20, 3.4)),
  };
  const setView = (name) => {
    views[name]();
    controls.update();
  };
  setView("moon"); // the sites now span the whole Moon (Apollo sites and the south pole)

  let selectedId = null;
  const select = (siteId) => {
    selectedId = siteId;
    for (const m of markers) {
      const on = m.site.id === siteId;
      m.dot.material.color.setHex(on ? COLORS.selected : colorFor(m.site));
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
  renderer.domElement.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const id = siteUnder(e);
    if (id) return onSelect(id);
    const point = onPick ? pointUnder(e) : null;
    if (point) onPick(point.lat, point.lon);
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    const cursor = siteUnder(e) ? "pointer" : onPick && pointUnder(e) ? "crosshair" : "grab";
    renderer.domElement.style.cursor = cursor;
  });

  const resize = () => {
    renderer.setSize(width(), height());
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(container);

  const toCamera = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const frame = () => {
    controls.update();
    // Keep markers a steady size on screen as you zoom, and put each name next to its dot.
    const scale = Math.min(6, Math.max(0.35, (camera.position.length() - 1) / 0.5));
    pendingDot.scale.setScalar(scale);
    for (const m of markers) {
      const s = m.site.id === selectedId ? scale * 1.5 : scale;
      m.dot.scale.setScalar(s);
      m.hit.scale.setScalar(scale);
      toCamera.copy(camera.position).sub(m.position);
      const facing = toCamera.dot(m.position) > 0; // false when the site is on the far side
      projected.copy(m.position).project(camera);
      m.label.style.display = facing ? "" : "none";
      m.label.style.left = `${((projected.x + 1) / 2) * width()}px`;
      m.label.style.top = `${((1 - projected.y) / 2) * height()}px`;
    }
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
    m.dot.geometry.dispose();
    m.dot.material.dispose();
    m.hit.geometry.dispose();
    m.hit.material.dispose();
    m.label.remove();
    markers.splice(i, 1);
    hitTargets.splice(hitTargets.indexOf(m.hit), 1);
    if (selectedId === siteId) selectedId = null;
  };

  return { select, setView, addSite, removeSite, markPending };
}
