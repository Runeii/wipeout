import React from 'react'
import { render, events } from '@react-three/fiber'
import App from './App';
import { PerspectiveCamera } from 'three';

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 64, 2048576);
camera.position.set(0, 10000, 50000);
camera.rotation.order = 'YZX';

const renderApp = () => render(
	<App />,
	document.getElementById('target'),
	{
		camera,
		events,
		size: {
			width: window.innerWidth,
			height: window.innerHeight
		},
	}
);

window.addEventListener('resize', renderApp)

renderApp();

