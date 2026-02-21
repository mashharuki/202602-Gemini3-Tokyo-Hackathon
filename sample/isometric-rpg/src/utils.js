import * as THREE from 'three';

/**
 * @param {string} text 
 */
export function updateStatus(text) {
  document.getElementById('status-text').innerText = text;
}

/**
 * @param {THREE.Vector3} coords 
 * @returns Returns the key for the object map given a set of coordinates
 */
export function getKey(coords) {
  return `${coords.x}-${coords.y}-${coords.z}`;
}

/**
 * 
 * @param {string} text 
 * @returns {THREE.SpriteMaterial}
 */
export function createTextMaterial(text) {
  const size = 512;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  context.font = '100px Arial';
  context.textBaseline = 'middle';
  context.textAlign = 'center';

  context.strokeStyle = 'black';
  context.lineWidth = 4;
  context.fillStyle = 'white';

  context.strokeText(text, size / 2, size / 2);
  context.fillText(text, size / 2, size / 2);

  return new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas)
  });
}