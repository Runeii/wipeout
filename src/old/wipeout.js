import * as THREE from 'three';
import { Face3, Geometry } from 'three/examples/jsm/deprecated/Geometry.js';
import { HermiteCurve3 } from './hermite';
import { scene, setCameraSpline, sprites } from './scene';

// ----------------------------------------------------------------------------
// Read 3D Objects from a PRM File

// ----------------------------------------------------------------------------
// Create a ThreeJS Model from a single PRM 3D Object

const createModelFromObject = function (object, spriteCollection, sceneMaterials) {
	var model = new THREE.Object3D();
	var geometry = new Geometry();

	model.position.set(object.header.position.x, -object.header.position.y, -object.header.position.z);

	// Load vertices
	for (var i = 0; i < object.vertices.length; i++) {
		geometry.vertices.push(new THREE.Vector3(object.vertices[i].x, -object.vertices[i].y, -object.vertices[i].z));
	}

	var whiteColor = new THREE.Color(1, 1, 1);
	var nullVector = new THREE.Vector2(0, 0);

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
			var spriteMaterial = new THREE.MeshBasicMaterial({ map: sceneMaterials[p.texture].map, color: color, alphaTest: 0.5 });
			var spriteMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(p.width, p.height), spriteMaterial);

			var sprite = new THREE.Object3D();
			sprite.position.set(v.x, v.y + yOffset, v.z);
			sprite.add(spriteMesh);
			model.add(sprite);

			// We have to collect sprites separately, so we can go through all of them 
			// and rotate them to the camera before rendering the frame
			spriteCollection.push(sprite);
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
					uv[j] = new THREE.Vector2(p.uv[j].u / img.width, 1 - p.uv[j].v / img.height);
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

	var mesh = new THREE.Mesh(geometry.toBufferGeometry(), sceneMaterials);
	model.add(mesh);
	return model;
};


// ----------------------------------------------------------------------------
// Unpack TIM images from a compressed CMP File (LZ77)

const unpackImages = function (buffer) {
	var data = new DataView(buffer);

	// Read the file header
	var numberOfFiles = data.getUint32(0, true);
	var packedDataOffset = (numberOfFiles + 1) * 4;

	var unpackedLength = 0;
	for (var i = 0; i < numberOfFiles; i++) {
		unpackedLength += data.getUint32((i + 1) * 4, true);
	}


	// Unpack
	var src = new Uint8Array(buffer, packedDataOffset);
	var dst = new Uint8Array(unpackedLength);
	var wnd = new Uint8Array(0x2000);

	var srcPos = 0,
		dstPos = 0,
		wndPos = 1,
		curBit = 0,
		curByte = 0,
		bitMask = 0x80;

	var readBitfield = function (size) {
		var value = 0;
		while (size > 0) {
			if (bitMask === 0x80) {
				curByte = src[srcPos++];
			}

			if (curByte & bitMask) {
				value |= size;
			}

			size >>= 1;

			bitMask >>= 1;
			if (bitMask === 0) {
				bitMask = 0x80;
			}
		}

		return value;
	};

	while (true) {
		if (srcPos > src.byteLength || dstPos > unpackedLength) {
			break;
		}

		if (bitMask === 0x80) {
			curByte = src[srcPos++];
		}

		curBit = (curByte & bitMask);

		bitMask >>= 1;
		if (bitMask === 0) {
			bitMask = 0x80;
		}

		if (curBit) {
			wnd[wndPos & 0x1fff] = dst[dstPos] = readBitfield(0x80);
			wndPos++;
			dstPos++;
		}
		else {
			var position = readBitfield(0x1000);
			if (position === 0) {
				break;
			}

			var length = readBitfield(0x08) + 2;
			for (var i = 0; i <= length; i++) {
				wnd[wndPos & 0x1fff] = dst[dstPos] = wnd[(i + position) & 0x1fff];
				wndPos++;
				dstPos++;
			}
		}
	}

	// Split unpacked data into separate buffer for each file
	var fileOffset = 0;
	var files = [];
	for (var i = 0; i < numberOfFiles; i++) {
		var fileLength = data.getUint32((i + 1) * 4, true);
		files.push(dst.buffer.slice(fileOffset, fileOffset + fileLength));
		fileOffset += fileLength;

	}

	return files;
};


// ----------------------------------------------------------------------------
// Render a TIM image into a 2D canvas

const readImage = function (buffer) {
	var data = new DataView(buffer);
	var file = ImageFileHeader.readStructs(buffer, 0, 1)[0];
	var offset = ImageFileHeader.byteLength;

	var palette = null;
	if (
		file.type === IMAGE_TYPE.PALETTED_4_BPP ||
		file.type === IMAGE_TYPE.PALETTED_8_BPP
	) {
		palette = new Uint16Array(buffer, offset, file.paletteColors);
		offset += file.paletteColors * 2;
	}
	offset += 4; // skip data size

	var pixelsPerShort = 1;
	if (file.type === IMAGE_TYPE.PALETTED_8_BPP) {
		pixelsPerShort = 2;
	}
	else if (file.type === IMAGE_TYPE.PALETTED_4_BPP) {
		pixelsPerShort = 4;
	}

	var dim = ImagePixelHeader.readStructs(buffer, offset, 1)[0];
	offset += ImagePixelHeader.byteLength;

	var width = dim.width * pixelsPerShort,
		height = dim.height;

	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	var ctx = canvas.getContext('2d');
	var pixels = ctx.createImageData(width, height);

	var putPixel = function (dst, offset, color) {
		dst[offset + 0] = (color & 0x1f) << 3; // R
		dst[offset + 1] = ((color >> 5) & 0x1f) << 3; // G
		dst[offset + 2] = ((color >> 10) & 0x1f) << 3; // B
		dst[offset + 3] = color === 0 ? 0 : 0xff; // A
	}

	var entries = dim.width * dim.height;
	if (file.type === IMAGE_TYPE.TRUE_COLOR_16_BPP) {
		for (var i = 0; i < entries; i++) {
			var c = data.getUint16(offset + i * 2, true);
			putPixel(pixels.data, i * 4, c);
		}
	}
	else if (file.type === IMAGE_TYPE.PALETTED_8_BPP) {
		for (var i = 0; i < entries; i++) {
			var p = data.getUint16(offset + i * 2, true);

			putPixel(pixels.data, i * 8 + 0, palette[p & 0xff]);
			putPixel(pixels.data, i * 8 + 4, palette[(p >> 8) & 0xff]);
		}
	}
	else if (file.type === IMAGE_TYPE.PALETTED_4_BPP) {
		for (var i = 0; i < entries; i++) {
			var p = data.getUint16(offset + i * 2, true);

			putPixel(pixels.data, i * 16 + 0, palette[p & 0xf]);
			putPixel(pixels.data, i * 16 + 4, palette[(p >> 4) & 0xf]);
			putPixel(pixels.data, i * 16 + 8, palette[(p >> 8) & 0xf]);
			putPixel(pixels.data, i * 16 + 12, palette[(p >> 12) & 0xf]);
		}
	}

	ctx.putImageData(pixels, 0, 0);
	return canvas;
};


// ----------------------------------------------------------------------------
// Create a single ThreeJS MeshFaceMaterial with the given images
// ----------------------------------------------------------------------------
// Add objects from the PRM and CMP files to the scene

const createScene = function (files, scale = 1) {
	var rawImages = files.textures ? unpackImages(files.textures) : [];
	var images = rawImages.map(readImage.bind(this));

	const sceneMaterials = createMeshFaceMaterial(images, THREE.VertexColors, THREE.FrontSide);

	var objects = readObjects(files.objects);
	for (var i = 0; i < objects.length; i++) {
		var model = createModelFromObject(objects[i], sprites, sceneMaterials);
		if (modify && modify.scale) {
			model.scale.set(modify.scale, modify.scale, modify.scale);
		}
		scene.add(model);
	}
	return model;
};


// ----------------------------------------------------------------------------
// Add a track from TRV, TRF, CMP and TTF files to the scene

const createTrack = function (files) {
	var rawImages = unpackImages(files.textures);
	var images = rawImages.map(readImage.bind(this));

	// Load Track Texture Index
	var indexEntries = files.textureIndex.byteLength / TrackTextureIndex.byteLength;
	var textureIndex = TrackTextureIndex.readStructs(files.textureIndex, 0, indexEntries);

	// Extract the big (near) versions of these textures only. The near 
	// version is composed of 4x4 32px tiles.
	var composedImages = [];
	for (var i = 0; i < textureIndex.length; i++) {
		var idx = textureIndex[i];

		var composedImage = document.createElement('canvas');
		composedImage.width = 128;
		composedImage.height = 128;
		var ctx = composedImage.getContext('2d');

		for (var x = 0; x < 4; x++) {
			for (var y = 0; y < 4; y++) {
				var image = images[idx.near[y * 4 + x]];
				ctx.drawImage(image, x * 32, y * 32)
			}
		}
		composedImages.push(composedImage);
	}


	const trackMaterial = createMeshFaceMaterial(composedImages, THREE.FaceColors, THREE.DoubleSide);

	var model = new THREE.Object3D();
	var geometry = new Geometry();

	// Load vertices
	var vertexCount = files.vertices.byteLength / TrackVertex.byteLength;
	var rawVertices = TrackVertex.readStructs(files.vertices, 0, vertexCount);

	for (var i = 0; i < rawVertices.length; i++) {
		geometry.vertices.push(new THREE.Vector3(rawVertices[i].x, -rawVertices[i].y, -rawVertices[i].z));
	}

	// Load Faces
	var faceCount = files.faces.byteLength / TrackFace.byteLength;
	var faces = TrackFace.readStructs(files.faces, 0, faceCount);

	// Load track texture file (WO2097/WOXL only)
	if (files.trackTexture) {
		var trackTextureCount = files.trackTexture.byteLength / TrackTexture.byteLength;
		var trackTextures = TrackTexture.readStructs(files.trackTexture, 0, trackTextureCount);

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
			color = new THREE.Color(0.25, 0.25, 2);
		}

		geometry.faces.push(new Face3(f.indices[0], f.indices[1], f.indices[2], null, color, materialIndex));
		geometry.faces.push(new Face3(f.indices[2], f.indices[3], f.indices[0], null, color, materialIndex));

		var flipx = (f.flags & TrackFace.FLAGS.FLIP) ? 1 : 0;
		geometry.faceVertexUvs[0].push([
			new THREE.Vector2(1 - flipx, 1),
			new THREE.Vector2(0 + flipx, 1),
			new THREE.Vector2(0 + flipx, 0)
		]);
		geometry.faceVertexUvs[0].push([
			new THREE.Vector2(0 + flipx, 0),
			new THREE.Vector2(1 - flipx, 0),
			new THREE.Vector2(1 - flipx, 1)
		]);
	}

	var mesh = new THREE.Mesh(geometry.toBufferGeometry(), trackMaterial);
	model.add(mesh);
	scene.add(model);


	createCameraSpline(files.sections, faces, geometry.vertices);
};


// ----------------------------------------------------------------------------
// Extract a camera from the track section file (.TRS)

const createCameraSpline = function (buffer, faces, vertices) {
	var sectionCount = buffer.byteLength / TrackSection.byteLength;
	var sections = TrackSection.readStructs(buffer, 0, sectionCount);

	var cameraPoints = [];
	var jumpIndexes = [];

	// First curve, always skip junctions
	var index = 0;
	do {
		var s = sections[index];
		if (s.flags & TrackSection.FLAGS.JUMP)
			jumpIndexes.push(cameraPoints.length);

		var pos = getSectionPosition(s, faces, vertices);
		cameraPoints.push(pos);

		index = s.next;
	} while (index > 0 && index < sections.length);

	// Second curve, take junctions when possible
	index = 0;
	do {
		var s = sections[index];
		if (s.flags & TrackSection.FLAGS.JUMP)
			jumpIndexes.push(cameraPoints.length);

		var pos = getSectionPosition(s, faces, vertices);
		cameraPoints.push(pos);

		// Get next section, look for junctions
		if (s.nextJunction != -1 && (sections[s.nextJunction].flags & TrackSection.FLAGS.JUNCTION_START)) {
			index = s.nextJunction;
		}
		else {
			index = s.next;
		}
	} while (index > 0 && index < sections.length);

	//extend path near jumps by adding tangent vector
	for (var i = 0; i < jumpIndexes.length; i++) {
		var index = jumpIndexes[i];

		var jumpPoint = cameraPoints[index];
		var tangent = jumpPoint.clone().sub(cameraPoints[(index + cameraPoints.length - 1) % cameraPoints.length]);
		var lengthNext = cameraPoints[(index + 1) % cameraPoints.length].clone().sub(jumpPoint).length();

		jumpPoint.add(tangent.setLength(lengthNext / 4));
	}

	const cameraSpline = new HermiteCurve3(cameraPoints, 0.5, 0.0);

	// Increase arc length subdivisions to get constant camera speed during jumps.
	// This prevent camera going too fast due imprecise length distance estimations.
	cameraSpline.__arcLengthDivisions = 20000;

	setCameraSpline(cameraSpline);
	// Draw the Camera Spline
	// scene.add( new THREE.Mesh(
	// 	new THREE.TubeGeometry(cameraSpline, cameraPoints.length, 50, 5, true), 
	// 	new THREE.MeshBasicMaterial({color: 0xff00ff})
	// ));
};


// ----------------------------------------------------------------------------
// Get track section center position from track vertices

const getSectionPosition = function (section, faces, vertices) {
	var verticescount = 0;
	var position = new THREE.Vector3();
	for (var i = section.firstFace; i < section.firstFace + section.numFaces; i++) {
		var face = faces[i];
		if (face.flags & TrackFace.FLAGS.TRACK) {
			for (var j = 0; j < face.indices.length; j++) {
				var vertex = vertices[face.indices[j]];
				position.add(vertex);
				verticescount++;
			}
		}
	}

	position.divideScalar(verticescount);
	return position;
}



export const loadTrack = async (path, loadTEXFile) => {
	const files = await loadBinaries({
		textures: path + '/SCENE.CMP',
		objects: path + '/SCENE.PRM'
	});
	createScene(files);

	const skyFiles = await loadBinaries({
		textures: path + '/SKY.CMP',
		objects: path + '/SKY.PRM'
	});

	window.sky = createScene(skyFiles, { scale: 48 });


	var trackFiles = {
		textures: path + '/LIBRARY.CMP',
		textureIndex: path + '/LIBRARY.TTF',
		vertices: path + '/TRACK.TRV',
		faces: path + '/TRACK.TRF',
		sections: path + '/TRACK.TRS'
	};

	if (loadTEXFile) {
		trackFiles.trackTexture = path + '/TRACK.TEX';
	}

	const track = await loadBinaries(trackFiles);
	createTrack(track);
};

