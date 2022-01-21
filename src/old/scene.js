import { Scene } from 'three';
import { PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { TRACKS_WIPEOUT2097 } from './CONSTANTS';
import { loadTrack } from './wipeout';

export let scene = null;
export let sprites = [];
let camera;
let renderer;

let cameraSpline;

let sceneMaterial
let trackMaterial

let startTime
let ticks

export const setCameraSpline = spline => {
	cameraSpline = spline;
}

const setupCamera = () => {
	camera = new PerspectiveCamera(84, window.innerWidth / window.innerHeight, 64, 2048576);
	camera.currentLookAt = new Vector3(0, 0, 0);
	camera.roll = 0;
	camera.rotation.order = 'YZX';
}

const clearScene = () => {
	scene = new Scene();
	sprites = [];

	sceneMaterial = {};
	trackMaterial = null;

	setupCamera();

	startTime = Date.now();
	ticks = 0;
};

const resize = () => {
	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize(width, height);
}

export const addWorld = async (index = 0) => {
	const track = TRACKS_WIPEOUT2097[index]
	clearScene();
	await loadTrack(track.path, track.hasTEXFile);
	console.log('complete')
	animate();
}

let index = 0
window.setInterval(() => {
	addWorld(index);
	index++
}, 5000);

export const animate = () => {
	requestAnimationFrame(animate);
	var time = Date.now();

	//	// Update weapon tile color 
	//	if (this.weaponTileMaterial) {
	//		this.updateWeaponMaterial(time);
	//	}

	if (cameraSpline) {
		var elapsedTime = time - startTime;
		var elapsedTicks = elapsedTime / 1000 * 60;

		// Fixed time step loop (60hz)
		while (ticks < elapsedTicks) {
			updateSplineCamera();
			ticks++;
		}
	}
	console.log(window.sky)
	const colors = ['red', 'blue', 'yellow', 'green']
	document.documentElement.style.backgroundColor = colors[Math.round(Math.random * colors.length)];
	//this.rotateSpritesToCamera(camera);
	renderer.render(scene, camera);
};

export const updateSplineCamera = () => {
	var damping = 0.90;
	var time = ticks * 1000 / 60;

	var loopTime = cameraSpline.points.length * 100;

	// Camera position along the spline
	var tmod = (time % loopTime) / loopTime;
	var cameraPos = cameraSpline.getPointAt(tmod).clone();

	camera.position.multiplyScalar(damping)
		.add(cameraPos.clone().add({ x: 0, y: 600, z: 0 }).multiplyScalar(1 - damping));

	// Camera lookAt along the spline
	var tmodLookAt = ((time + 800) % loopTime) / loopTime;
	var lookAtPos = cameraSpline.getPointAt(tmodLookAt).clone();
	camera.currentLookAt = camera.currentLookAt.multiplyScalar(damping)
		.add(lookAtPos.clone().multiplyScalar(1 - damping));
	camera.lookAt(camera.currentLookAt);

	// Roll into corners - there's probably an easier way to do this. This 
	// takes the angle between the current camera position and the current
	// lookAt, applies some damping and rolls the camera along its view vector
	var cn = cameraPos.sub(camera.position);
	var tn = lookAtPos.sub(camera.currentLookAt);
	var roll = (Math.atan2(cn.z, cn.x) - Math.atan2(tn.z, tn.x));
	roll += (roll > Math.PI)
		? -Math.PI * 2
		: (roll < -Math.PI) ? Math.PI * 2 : 0;

	camera.roll = camera.roll * 0.95 + (roll) * 0.1;
	camera.up = (new Vector3(0, 1, 0)).applyAxisAngle(
		camera.position.clone().sub(camera.currentLookAt).normalize(),
		camera.roll * 0.25
	);
}