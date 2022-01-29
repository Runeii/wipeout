import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";

const updateCameraPosition = (camera, loopTime, spline, time, damping) => {
	const modifiedTime = (time % loopTime) / loopTime;

	const position = spline.getPointAt(modifiedTime).clone();

	camera.position.multiplyScalar(damping)
	camera.position.add(position.clone().add({ x: 0, y: 600, z: 0 }).multiplyScalar(1 - damping));
	return position;
}

const updateCameraRoll = (camera, position, viewTarget) => {
	// Roll into corners - there's probably an easier way to do this. This 
	// takes the angle between the current camera position and the current
	// lookAt, applies some damping and rolls the camera along its view vector
	var cn = position.sub(camera.position);
	var tn = viewTarget.sub(camera.currentLookAt);
	var roll = (Math.atan2(cn.z, cn.x) - Math.atan2(tn.z, tn.x));
	roll += (roll > Math.PI)
		? -Math.PI * 2
		: (roll < -Math.PI) ? Math.PI * 2 : 0;
	camera.roll = camera.roll * 0.95 + (roll) * 0.1;

	return
}

const updateCameraTarget = (camera, loopTime, spline, time, damping) => {
	const modifiedTime = ((time + 800) % loopTime) / loopTime;

	const viewTarget = spline.getPointAt(modifiedTime).clone();
	camera.currentLookAt = camera.currentLookAt.multiplyScalar(damping)
	camera.currentLookAt.add(viewTarget.clone().multiplyScalar(1 - damping));
	camera.lookAt(camera.currentLookAt);
	return viewTarget;
}

const Camera = ({ cameraSpline }) => {
	const { camera } = useThree();

	useEffect(() => {
		if (!camera) {
			return;
		}
		camera.currentLookAt = new Vector3(0, 0, 0);
		camera.roll = 0;
		camera.rotation.order = 'YZX';
	}, [camera]);

	useFrame(({ clock }) => {
		if (!cameraSpline) {
			return;
		}

		var damping = 0.90;
		const time = clock.getElapsedTime() * 1000;
		var loopTime = cameraSpline.points.length * 100;

		const position = updateCameraPosition(camera, loopTime, cameraSpline, time, damping);
		const viewTarget = updateCameraTarget(camera, loopTime, cameraSpline, time, damping);
		updateCameraRoll(camera, position, viewTarget);
	})
	return null;
}
export default Camera;