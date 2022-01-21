import { Object3D } from "three";
import { MeshBasicMaterial } from "three";
import { Color } from "three";
import { Vector2 } from "three";
import { Vector3 } from "three";
import { Mesh, PlaneBufferGeometry } from "three";
import { Face3, Geometry } from "three/examples/jsm/deprecated/Geometry";
import { POLYGON_TYPE } from "../structs";
import { loadBinaries } from "./assetUtils";
import { int32ToColor } from "./mathUtils";
import { createObjectsFromBuffer } from "./objectUtils";
import { compressedTexturesToMaterials } from "./textureUtils";

const sprites = []
const createModelFromObject = (object, sceneMaterials) => {
	var model = new Object3D();
	var geometry = new Geometry();

	model.position.set(object.header.position.x, -object.header.position.y, -object.header.position.z);

	const position = object.header.position.x, -object.header.position.y, -object.header.position.z;
	// Load vertices
	for (var i = 0; i < object.vertices.length; i++) {
		geometry.vertices.push(new Vector3(object.vertices[i].x, -object.vertices[i].y, -object.vertices[i].z));
	}

	var whiteColor = new Color(1, 1, 1);
	var nullVector = new Vector2(0, 0);

	// Create faces
	for (var i = 0; i < object.polygons.length; i++) {
		var p = object.polygons[i];

		// Sprite
		if (
			p.header.type === POLYGON_TYPE.SPRITE_BOTTOM_ANCHOR ||
			p.header.type === POLYGON_TYPE.SPRITE_TOP_ANCHOR
		) {
			var v = geometry.vertices[p.index];
			var color = int32ToColor(p.color);
			var yOffset = p.header.type === POLYGON_TYPE.SPRITE_BOTTOM_ANCHOR
				? p.height / 2
				: -p.height / 2;

			// We can't use THREE.Sprite here, because they rotate to the camera on
			// all axis. We just want rotation around the Y axis, so we do it manually.
			var spriteMaterial = new MeshBasicMaterial({ map: sceneMaterials[p.texture].map, color: color, alphaTest: 0.5 });
			var spriteMesh = new Mesh(new PlaneBufferGeometry(p.width, p.height), spriteMaterial);

			var sprite = new Object3D();
			sprite.position.set(v.x, v.y + yOffset, v.z);
			sprite.add(spriteMesh);
			model.add(sprite);

			// We have to collect sprites separately, so we can go through all of them 
			// and rotate them to the camera before rendering the frame
			sprites.push(sprite);
		}

		// Tris or Quad
		else if (p.indices) {
			var materialIndex = sceneMaterials[length - 1];
			var c = [whiteColor, whiteColor, whiteColor, whiteColor];
			var uv = [nullVector, nullVector, nullVector, nullVector];

			// Textured
			if (typeof (p.texture) !== 'undefined') {
				materialIndex = p.texture;

				var img = sceneMaterials[materialIndex].map.image;
				for (var j = 0; j < p.uv.length; j++) {
					uv[j] = new Vector2(p.uv[j].u / img.width, 1 - p.uv[j].v / img.height);
				}
			}

			// Face or Vertex color?
			if (p.color || p.colors) {
				for (var j = 0; j < p.indices.length; j++) {
					c[j] = int32ToColor(p.color || p.colors[j]);
				}
			}

			geometry.faceVertexUvs[0].push([uv[2], uv[1], uv[0]]);
			geometry.faces.push(new Face3(p.indices[2], p.indices[1], p.indices[0], null, [c[2], c[1], c[0]], materialIndex));

			// Push extra UV and Face for Quads
			if (p.indices.length === 4) {
				geometry.faceVertexUvs[0].push([uv[2], uv[3], uv[1]]);
				geometry.faces.push(new Face3(p.indices[2], p.indices[3], p.indices[1], null, [c[2], c[3], c[1]], materialIndex));
			}
		}
	}

	//	var mesh = new Mesh(geometry.toBufferGeometry(), sceneMaterials);
	//	model.add(mesh);

	return [position, geometry];
};


export const createModels = async (urls) => {
	const { objects: objectsBuffer, textures } = await loadBinaries(urls);
	const materials = compressedTexturesToMaterials(textures);

	const { objects } = createObjectsFromBuffer(objectsBuffer);
	const models = objects.map(object => createModelFromObject(object, materials));
	console.log(models)
	return models;
}