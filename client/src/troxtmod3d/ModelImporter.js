// src/troxtmod3d/ModelImporter.js
// ETHERWORLD RP — ModelImporter v4.1 (GLB/FBX/JSON/URL)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class ModelImporter {
  static gltfLoader = null;
  static fbxLoader = null;

  static getGltf() {
    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      this.gltfLoader.setDRACOLoader(draco);
    }
    return this.gltfLoader;
  }

  static getFbx() {
    if (!this.fbxLoader) this.fbxLoader = new FBXLoader();
    return this.fbxLoader;
  }

  static async parseModelFile(file) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const fileSizeFormatted = `${sizeMb} Mo`;

    if (ext === 'json') return this.parseJsonFile(file, fileSizeFormatted);

    const arrayBuffer = await file.arrayBuffer();
    if (ext === 'glb' || ext === 'gltf') return this.parseGLTF(arrayBuffer, file.name, fileSizeFormatted, ext);
    if (ext === 'fbx') return this.parseFBX(arrayBuffer, file.name, fileSizeFormatted);

    throw new Error(`Format non supporté: .${ext}. Utilisez .glb, .gltf, .fbx ou .json.`);
  }

  static async parseFromURL(url) {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'glb';
    const fileName = url.split('/').pop() || 'remote_model';

    return new Promise((resolve, reject) => {
      const loader = ext === 'fbx' ? this.getFbx() : this.getGltf();
      loader.load(
        url,
        (result) => {
          const scene = result.scene || result;
          const animations = result.animations || [];
          const stats = this.analyzeObject(scene);
          resolve({
            sceneOrMesh: scene,
            animations,
            metadata: {
              fileName, fileSizeFormatted: 'remote', format: 'url', source: url,
              ...stats,
              animations: animations.map((clip) => ({
                name: clip.name || 'Animation',
                duration: parseFloat(clip.duration.toFixed(2)),
                tracksCount: clip.tracks.length,
              })),
            },
          });
        },
        undefined,
        (err) => reject(new Error(`URL load failed: ${err?.message || err}`))
      );
    });
  }

  static parseGLTF(buffer, fileName, fileSizeFormatted, format) {
    return new Promise((resolve, reject) => {
      this.getGltf().parse(
        buffer, '',
        (gltf) => {
          const stats = this.analyzeObject(gltf.scene);
          const animations = gltf.animations || [];
          resolve({
            sceneOrMesh: gltf.scene,
            animations,
            metadata: {
              fileName, fileSizeFormatted, format, ...stats,
              animations: animations.map((clip) => ({
                name: clip.name || 'Animation',
                duration: parseFloat(clip.duration.toFixed(2)),
                tracksCount: clip.tracks.length,
              })),
            },
          });
        },
        (error) => reject(new Error(`Erreur GLTF/GLB: ${error?.message || error}`))
      );
    });
  }

  static parseFBX(buffer, fileName, fileSizeFormatted) {
    return new Promise((resolve, reject) => {
      try {
        const object = this.getFbx().parse(buffer, '');
        const stats = this.analyzeObject(object);
        const animations = object.animations || [];
        resolve({
          sceneOrMesh: object,
          animations,
          metadata: {
            fileName, fileSizeFormatted, format: 'fbx', ...stats,
            animations: animations.map((clip) => ({
              name: clip.name || 'FBX Animation',
              duration: parseFloat(clip.duration.toFixed(2)),
              tracksCount: clip.tracks.length,
            })),
          },
        });
      } catch (err) {
        reject(new Error(`Erreur FBX: ${err?.message || err}`));
      }
    });
  }

  static async parseJsonFile(file, fileSizeFormatted) {
    const text = await file.text();
    const data = JSON.parse(text);
    let charState = null;
    if (data.character && typeof data.character.name === 'string') charState = data.character;
    else if (data.name && typeof data.skin === 'number') charState = data;
    if (!charState) throw new Error('JSON invalide (pas de CharacterState).');
    const dummyGroup = new THREE.Group();
    dummyGroup.name = `imported_preset_${charState.name}`;
    return {
      sceneOrMesh: dummyGroup,
      animations: [],
      characterState: charState,
      metadata: {
        fileName: file.name, fileSizeFormatted, format: 'json',
        triangleCount: 0, vertexCount: 0, meshCount: 0, boneCount: 0, animations: [],
      },
    };
  }

  static analyzeObject(root) {
    let triangles = 0, vertices = 0, meshCount = 0, boneCount = 0;
    root.traverse((node) => {
      if (node.isMesh) {
        meshCount++;
        const geo = node.geometry;
        if (geo) {
          if (geo.index) triangles += geo.index.count / 3;
          else if (geo.attributes.position) triangles += geo.attributes.position.count / 3;
          if (geo.attributes.position) vertices += geo.attributes.position.count;
        }
      } else if (node.isBone) boneCount++;
    });
    return {
      triangleCount: Math.round(triangles),
      vertexCount: Math.round(vertices),
      meshCount,
      boneCount,
    };
  }
}