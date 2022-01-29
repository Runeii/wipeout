import { Object3D } from "three";
import { MeshBasicMaterial } from "three";
import { Color } from "three";
import { Vector2 } from "three";
import { Vector3 } from "three";
import { Mesh, PlaneBufferGeometry } from "three";
import { Face3, Geometry } from "three/examples/jsm/deprecated/Geometry";
import { POLYGON_TYPE, TrackFace, TrackTexture, TrackVertex } from "../structs";
import { loadBinaries } from "./assetUtils";
import { createCameraSpline } from "./cameraUtils";
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

const addTextures = (face, trackTexture) => {
	if (!trackTexture) {
		return face;
	}

	const { flags, tile } = trackTexture;

	return { ...face, flags, tile }
}

const createFace = (face, trackTexture) => {
	const { color, flags, indices, tile: materialIndex } = addTextures(face, trackTexture);
	const adjustedColor = flags && TrackFace.FLAGS.BOOST ? new Color(0.25, 0.25, 2) : int32ToColor(color);

	return [
		new Face3(indices[0], indices[1], indices[2], null, adjustedColor, materialIndex),
		new Face3(indices[2], indices[3], indices[0], null, adjustedColor, materialIndex),
	]
}

const createFaceVertexUvs = (trackTexture) => {
	const { flags } = trackTexture ?? {};
	const flipX = (flags && TrackFace.FLAGS.FLIP) ? 1 : 0;

	return [
		[
			new Vector2(1 - flipX, 1),
			new Vector2(0 + flipX, 1),
			new Vector2(0 + flipX, 0)
		],
		[
			new Vector2(0 + flipX, 0),
			new Vector2(1 - flipX, 0),
			new Vector2(1 - flipX, 1)
		],
	];
}

const createTrackGeometry = (facesFile, trackTextureBuffer, verticesBuffer) => {
	// Vertices
	const vertexCount = verticesBuffer.byteLength / TrackVertex.byteLength;
	const rawVertices = TrackVertex.readStructs(verticesBuffer, 0, vertexCount);
	const vertices = rawVertices.map(({ x, y, z }) => new Vector3(x, -y, -z))

	// Faces & Textures
	var faceCount = facesFile.byteLength / TrackFace.byteLength;
	const trackTextureCount = trackTextureBuffer ? trackTextureBuffer.byteLength / TrackTexture.byteLength : null;
	const trackTextures = trackTextureBuffer ? TrackTexture.readStructs(trackTexture, 0, trackTextureCount) : [];

	// rawFaces returns face objects without conversion to Face3 obj
	const faces = TrackFace.readStructs(facesFile, 0, faceCount);
	const { builtFaces, faceVertexUvs } = faces.reduce((result, face, i) => (
		{
			...result,
			builtFaces: [
				...result.builtFaces,
				...createFace(face, trackTextures?.[i])
			],
			faceVertexUvs: [
				...result.faceVertexUvs,
				...createFaceVertexUvs(trackTextures?.[i])
			],
		}
	), { builtFaces: [], faceVertexUvs: [] })

	const geometry = new Geometry();
	geometry.faces = builtFaces
	geometry.faceVertexUvs = [faceVertexUvs]
	geometry.vertices = vertices;

	return { bufferGeometry: geometry.toBufferGeometry(), rawGeometry: { faces, vertices } };
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
	const { faces, sections, textures, textureIndex, trackTexture, vertices } = await loadBinaries(urls);

	const materials = compressedTexturesToMaterials(
		textures,
		{
			isTrack: true,
			textureIndex
		}
	);

	const { bufferGeometry, rawGeometry } = createTrackGeometry(faces, trackTexture, vertices);
	return {
		cameraSpline: createCameraSpline(sections, rawGeometry),
		id: Math.random() * 1000,
		geometry: bufferGeometry,
		materials,
		position: new Vector3(0, 0, 0),
	};
}