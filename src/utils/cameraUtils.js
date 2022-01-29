import { Vector3 } from "three";
import { HermiteCurve3 } from "../old/hermite";
import { TrackSection } from "../structs";


const getSectionCentrePosition = (section, faces, vertices, index) => {
	const { firstFace, numFaces } = section;

	const position = new Vector3();
	const vertexCount = faces.slice(firstFace, firstFace + numFaces - 1)
		.reduce((result, face, j) => {
			if (index === 0) {
				console.log(j, numFaces);
			}
			if (!face.flags) {
				return result;
			}

			face.indices.forEach(i => {
				position.add(vertices[i])
				if (index === 0) {
					console.log(vertices[i], position, face.indices.length, i)
				}
			});
			return result + face.indices.length
		}, 0);

	position.divideScalar(vertexCount)

	if (index === 0) {
		console.log(position)
	}
	return position;
}


export const createCameraSpline = (buffer, { faces, vertices }) => {
	const sectionCount = buffer.byteLength / TrackSection.byteLength;
	const sections = TrackSection.readStructs(buffer, 0, sectionCount);

	const lapOnePoints = sections.reduce(({ points, jumpIndexes, nextIndex }, section, index) => {
		if (index < nextIndex || nextIndex === 0) {
			return { points, jumpIndexes, nextIndex };
		}

		const isJump = !!(section.flags && TrackSection.FLAGS.JUMP);

		const point = getSectionCentrePosition(section, faces, vertices, index);
		const updatedPoints = [...points, point];

		return {
			points: updatedPoints,
			jumpIndexes: [...jumpIndexes, ...(isJump ? [updatedPoints.length] : [])],
			nextIndex: section.next,
		}
	}, { points: [], jumpIndexes: [], nextIndex: null })


	const cameraSpline = new HermiteCurve3(lapOnePoints.points, 0.5, 0.0);

	cameraSpline.__arcLengthDivisions = 20000;

	return cameraSpline;
	//	const lapTwoPoints = sections.reduce((result, section, i) => {
	//		const { waitForIndex } = result;
	//
	//		if (nextIndex && i < nextIndex) {
	//			return result;
	//		}
	//
	//		const { flags, nextJunction } = section;
	//		const isJump = flags && TrackSection.FLAGS.JUMP;
	//
	//		const point = getSectionCentrePosition(section, faces, vertices);
	//
	//		const nextIndex = nextJunction != -1 && sections[nextJunction].flags && Wipeout.TrackSection.FLAGS.JUNCTION_START
	//			? nextJunction
	//			: null;
	//
	//		return [point, isJump, waitForIndex]
	//	})
	//
	//
	//	var cameraPoints = [];
	//	var jumpIndexes = [];
	//
	//	//extend path near jumps by adding tangent vector
	//	for (var i = 0; i < jumpIndexes.length; i++) {
	//		var index = jumpIndexes[i];
	//
	//		var jumpPoint = cameraPoints[index];
	//		var tangent = jumpPoint.clone().sub(cameraPoints[(index + cameraPoints.length - 1) % cameraPoints.length]);
	//		var lengthNext = cameraPoints[(index + 1) % cameraPoints.length].clone().sub(jumpPoint).length();
	//
	//		jumpPoint.add(tangent.setLength(lengthNext / 4));
	//	}
	//
	//	this.cameraSpline = new HermiteCurve3(cameraPoints, 0.5, 0.0);
	//
	//	// Increase arc length subdivisions to get constant camera speed during jumps.
	//	// This prevent camera going too fast due imprecise length distance estimations.
	//	this.cameraSpline.__arcLengthDivisions = 20000;
}