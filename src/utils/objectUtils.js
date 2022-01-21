import { ObjectHeader, Polygon, PolygonHeader, Vertex } from "../structs";

const readObjectFromBufferAtOffset = (buffer, offset) => {
	let currentOffset = offset;

	const header = ObjectHeader.readStructs(buffer, offset, 1)[0];
	currentOffset += ObjectHeader.byteLength;

	const vertices = Vertex.readStructs(buffer, currentOffset, header.vertexCount);
	currentOffset += Vertex.byteLength * header.vertexCount;

	const polygons = [...Array(header.polygonCount)].map(_ => {
		const polygonHeader = PolygonHeader.readStructs(buffer, currentOffset, 1)[0];

		const polygonType = Polygon[polygonHeader.type];
		const polygon = polygonType.readStructs(buffer, currentOffset, 1)[0];
		currentOffset += polygonType.byteLength;

		return polygon;
	});

	return {
		header: header,
		vertices: vertices,
		polygons: polygons,
		byteLength: currentOffset
	};
};


export const createObjectsFromBuffer = buffer =>
	[...Array(buffer.byteLength)].reduce(({ objects, offset }, _) => {
		if (buffer.byteLength === offset) {
			return { objects, offset };
		}
		const object = readObjectFromBufferAtOffset(buffer, offset);

		return {
			objects: [...objects, object],
			offset: offset + object.byteLength,
		}
	}, {
		objects: [],
		offset: 0
	})
