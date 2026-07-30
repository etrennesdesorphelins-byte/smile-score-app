import type { Category } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// Built with import.meta.env.BASE_URL, matching mediapipe.ts, so this
// resolves correctly both locally and under the GitHub Pages project subpath.
const MODEL_PATH = `${import.meta.env.BASE_URL}models/facecap.glb`;

const CANVAS_SIZE = 320;

export type FaceFigureHandle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Object3D;
  head: THREE.Mesh;
};

function findMorphMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((obj) => {
    if (!found && obj instanceof THREE.Mesh && obj.morphTargetDictionary) {
      found = obj;
    }
  });
  return found;
}

export async function initFaceFigureScene(
  canvas: HTMLCanvasElement
): Promise<FaceFigureHandle> {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(0.5, 1, 1);
  scene.add(keyLight);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);

  // facecap.glb requires both of these (EXT_meshopt_compression,
  // KHR_texture_basisu) — a plain GLTFLoader can't read it without them.
  // No setTranscoderPath() call: KTX2Loader falls back to a `new URL(...,
  // import.meta.url)` reference to its own bundled transcoder, which Vite
  // resolves and hashes automatically (avoids shipping a second copy).
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.detectSupport(renderer);

  const gltfLoader = new GLTFLoader()
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder);

  const gltf = await gltfLoader.loadAsync(MODEL_PATH);
  const root = gltf.scene.children[0] ?? gltf.scene;
  scene.add(root);

  const head = findMorphMesh(root);
  if (!head || !head.morphTargetDictionary || !head.morphTargetInfluences) {
    throw new Error("顔モデルにモーフターゲットが見つかりませんでした");
  }

  // Frame the camera from the head mesh's actual (post-decompress) bounding
  // box rather than guessed coordinates — the model's authored scale/offset
  // isn't something we control or want to hardcode against.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.4;
  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  return { renderer, scene, camera, root, head };
}

// MediaPipe's blendshape category names follow Apple's ARKit naming
// (e.g. "mouthSmileLeft"), while facecap.glb's morph targets use a
// shortened form for paired shapes (e.g. "mouthSmile_L") but keep a few
// directional ones ("jawLeft", "mouthLeft") unshortened. Trying the exact
// name first, then the shortened form, covers both without a lookup table.
function resolveMorphTargetIndex(
  dictionary: { [name: string]: number },
  categoryName: string
): number | undefined {
  if (categoryName in dictionary) return dictionary[categoryName];
  const shortened = categoryName.replace(/Left$/, "_L").replace(/Right$/, "_R");
  if (shortened in dictionary) return dictionary[shortened];
  return undefined;
}

const decomposedPosition = new THREE.Vector3();
const decomposedQuaternion = new THREE.Quaternion();
const decomposedScale = new THREE.Vector3();

export function updateFaceFigure(
  handle: FaceFigureHandle,
  categories: Category[] | undefined,
  matrixData: number[] | undefined
): void {
  const { head, root } = handle;
  const dictionary = head.morphTargetDictionary;
  const influences = head.morphTargetInfluences;
  if (categories && dictionary && influences) {
    for (const category of categories) {
      const index = resolveMorphTargetIndex(dictionary, category.categoryName);
      if (index !== undefined) {
        influences[index] = category.score;
      }
    }
  }

  if (matrixData && matrixData.length === 16) {
    const matrix = new THREE.Matrix4().fromArray(matrixData);
    matrix.decompose(decomposedPosition, decomposedQuaternion, decomposedScale);
    root.quaternion.copy(decomposedQuaternion);
  }

  handle.renderer.render(handle.scene, handle.camera);
}

export function disposeFaceFigure(handle: FaceFigureHandle): void {
  handle.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.dispose();
    }
  });
  handle.renderer.dispose();
}
