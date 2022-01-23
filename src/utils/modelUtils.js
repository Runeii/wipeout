import { Object3D } from "three";
import { MeshBasicMaterial } from "three";
import { Color } from "three";
import { Vector2 } from "three";
import { Vector3 } from "three";
import { Mesh, PlaneBufferGeometry } from "three";
import { Face3, Geometry } from "three/examples/jsm/deprecated/Geometry";
import { POLYGON_TYPE, TrackFace, TrackTexture, TrackVertex } from "../structs";
import { loadBinaries } from "./assetUtils";
import { int32ToColor } from "./mathUtils";
import { createObjectsFromBuffer } from "./objectUtils";
import { compressedTexturesToMaterials } from "./textureUtils";

const createGeometry = (object, materials) => {
	const vertices = object.vertices.map(({ x, y, z }) => new Vector3(x, -y, -z));

	const whiteColor = new Color(1, 1, 1);
	const nullVector = new Vector2(0, 0);

	const BLANK_UV = [nullVector, nullVector, nullVector, nullVector];
	const BLANK_COLOR = [whiteColor, whiteColor, whiteColor, whiteColor];

	const components = object.polygons.reduce((result, { color, colors, header, indices, texture, uv }) => {
		if (!indices) {
			return result;
		}

		const materialIndex = texture ?? null;
		const isQuad = indices.length === 4;
		const img = materials?.[materialIndex]?.map.image;
		const uvs = img ? uv.map(({ u, v }) => new Vector2(u / img.width, 1 - v / img.height)) : BLANK_UV;

		const c = (color || colors) ? indices.map((_, i) => int32ToColor(color || colors[i])) : BLANK_COLOR;
		const newUv = [uvs[2], uvs[1], uvs[0]];
		const newColor = [c[2], c[1], c[0]];
		const newFace = [indices[2], indices[1], indices[0], null, newColor, materialIndex];

		const quadUv = [uvs[2], uvs[3], uvs[1]];
		const quadColor = [c[2], c[3], c[1]];
		const quadFace = [indices[2], indices[3], indices[1], null, quadColor, materialIndex];

		return {
			faces: [
				...result.faces,
				newFace,
				...(isQuad ? [quadFace] : [])
			],
			vertexUvs: [
				...result.vertexUvs,
				newUv,
				...(isQuad ? [quadUv] : [])
			],
		}
	}, { faces: [], vertexUvs: [] })

	const { faces, vertexUvs } = components;

	const geometry = new Geometry();
	geometry.faceVertexUvs = [vertexUvs];
	geometry.vertices = vertices;

	if (faces.length === 0) {
		return null;
	}
	geometry.faces = faces.map((face) => new Face3(...face));

	return geometry.toBufferGeometry();
};

const createTrackGeometry = (facesFile, trackTexture, vertices) => {
	var geometry = new Geometry();

	// Load vertices
	var vertexCount = vertices.byteLength / TrackVertex.byteLength;
	var rawVertices = TrackVertex.readStructs(vertices, 0, vertexCount);

	for (var i = 0; i < rawVertices.length; i++) {
		geometry.vertices.push(new Vector3(rawVertices[i].x, -rawVertices[i].y, -rawVertices[i].z));
	}

	// Load Faces
	var faceCount = facesFile.byteLength / TrackFace.byteLength;
	var faces = TrackFace.readStructs(facesFile, 0, faceCount);

	// Load track texture file (WO2097/WOXL only)
	if (trackTexture) {
		var trackTextureCount = trackTexture.byteLength / TrackTexture.byteLength;
		var trackTextures = TrackTexture.readStructs(trackTexture, 0, trackTextureCount);

		// Copy data from TEX to TRF structure
		for (var i = 0; i < faces.length; i++) {
			var f = faces[i];
			var t = trackTextures[i];

			f.tile = t.tile;
			f.flags = t.flags;
		}
	}

	for (var i = 0; i < faces.length; i++) {
		var f = faces[i];

		var color = int32ToColor(f.color);
		var materialIndex = f.tile;

		if (f.flags & TrackFace.FLAGS.BOOST) {
			//render boost tile as bright blue
			color = new Color(0.25, 0.25, 2);
		}

		geometry.faces.push(new Face3(f.indices[0], f.indices[1], f.indices[2], null, color, materialIndex));
		geometry.faces.push(new Face3(f.indices[2], f.indices[3], f.indices[0], null, color, materialIndex));

		var flipx = (f.flags & TrackFace.FLAGS.FLIP) ? 1 : 0;
		geometry.faceVertexUvs[0].push([
			new Vector2(1 - flipx, 1),
			new Vector2(0 + flipx, 1),
			new Vector2(0 + flipx, 0)
		]);
		geometry.faceVertexUvs[0].push([
			new Vector2(0 + flipx, 0),
			new Vector2(1 - flipx, 0),
			new Vector2(1 - flipx, 1)
		]);
	}

	return geometry.toBufferGeometry();
}

const getPosition = object => [object.header.position.x, -object.header.position.y, -object.header.position.z];

export const createModel = async (urls) => {
	const { objects: objectsBuffer, textures } = await loadBinaries(urls);

	const materials = compressedTexturesToMaterials(textures);

	const { objects } = createObjectsFromBuffer(objectsBuffer);

	return objects.map(object => ({
		id: Math.random() * 1000,
		geometry: createGeometry(object, materials),
		materials,
		position: getPosition(object),
	}));
}

export const createTrack = async (urls) => {
	const { faces, textures, textureIndex, trackTexture, vertices } = await loadBinaries(urls);
	console.log(faces, trackTexture, vertices)

	const materials = compressedTexturesToMaterials(
		textures,
		{
			isTrack: true,
			textureIndex
		}
	);

	return {
		id: Math.random() * 1000,
		geometry: createTrackGeometry(faces, trackTexture, vertices),
		materials,
		position: new Vector3(0, 0, 0),
	};
}