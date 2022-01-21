import { NearestFilter, NoColors } from "three";
import { Texture } from "three";
import { MeshBasicMaterial } from "three";
import { ImageFileHeader, ImagePixelHeader, IMAGE_TYPE } from "../structs";

// TODO: Rewrite
const renderTIMToCanvas = (buffer) => {
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


const unpackImages = (buffer) => {
	if (!buffer) {
		return [];
	}

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

const createMeshFaceMaterial = (images, vertexColors, side) => {
	const basicMaterial = new MeshBasicMaterial();
	basicMaterial.vertexColors = vertexColors;

	const materials = images.map((image, i) => {
		if (images[i].byteLength === 0) {
			return basicMaterial;
		}

		const texture = new Texture(images[i]);
		texture.minFilter = NearestFilter;
		texture.magFilter = NearestFilter;
		texture.needsUpdate = true;

		const material = new MeshBasicMaterial({ map: texture });
		material.vertexColors = vertexColors;

		const isWeapontile = i === 3 && vertexColors === FaceColors;

		if (isWeapontile) {
			material.vertexColors = NoColors;
			material.name = 'weaponTile'
		}

		material.side = side;
		material.alphaTest = 0.5;

		return material;
	})

	materials.push(basicMaterial) - 1;

	return materials;
};

export const compressedTexturesToMaterials = textures => {
	if (!textures) {
		return [];
	}

	const rawImages = unpackImages(textures);
	const images = rawImages.map(image => renderTIMToCanvas(image));
	const materials = createMeshFaceMaterial(images);
	return materials;
}